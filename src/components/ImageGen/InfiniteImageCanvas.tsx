"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { addEdge, applyNodeChanges, Handle, MarkerType, Position, ReactFlow, useNodesState, type Connection, type Edge, type FinalConnectionState, type HandleType, type Node, type NodeProps, type ReactFlowInstance, type Viewport } from "@xyflow/react";
import { ApiError, apiJson, jsonBody } from "@/lib/client-api";
import type { CanvasLayout, CanvasNodeLayout } from "@/lib/canvas-layout";
import { clearLocalCanvasDraft, loadLocalCanvasDraft, sameCanvasContent, saveLocalCanvasDraft } from "@/lib/canvas-draft";
import type { ImageRecord } from "@/types";
import { canvasEdges, dedupeCanvasEdges, findConnectedPlaceholderIds, findLegacyAutoAddedCanvasIds, mergeCanvasItems, placeCanvasAdditions, replacePlaceholderConnections } from "./canvas-items";
import { getCanvasNodeSize } from "./canvas-geometry";
import CanvasPromptPanel, { type CanvasPromptPanelSettings } from "./CanvasPromptPanel";
import type { CanvasPromptReference } from "./canvas-prompt";
import { createCanvasGenerationQueue, type CanvasGenerationTask } from "./canvas-generation-queue";
import CanvasGenerationStatus from "./CanvasGenerationStatus";
import CanvasGenerationQueueSummary from "./CanvasGenerationQueueSummary";
import type { CanvasGenerateContext } from "@/lib/canvas-generation";

type CanvasGenerateHandler = (nodeId: string, prompt: string, references: CanvasPromptReference[], settings: CanvasPromptPanelSettings, targetImage: ImageRecord | null, context: CanvasGenerateContext) => void | string[] | Promise<void | string[]>;
type CanvasPromptGenerateHandler = (nodeId: string, prompt: string, references: CanvasPromptReference[], settings: CanvasPromptPanelSettings) => void | string[] | Promise<void | string[]>;

type ImageNodeData = {
  image: ImageRecord;
  isEmpty?: boolean;
  onPreview: (image: ImageRecord) => void;
  onEdit: (image: ImageRecord) => void;
  onContinueEditing: (image: ImageRecord) => void;
  onRemove: (id: string) => void;
  promptCandidates: CanvasPromptReference[];
  onGenerate?: CanvasPromptGenerateHandler;
  imageModels: string[];
  defaultImageModel: string;
  promptSettings?: Partial<CanvasPromptPanelSettings>;
  onClosePrompt: () => void;
  onStartManualConnection: (event: React.PointerEvent, nodeId: string, handleType: HandleType, handleId: string | null) => void;
  onStartKeyboardConnection: (nodeId: string, handleType: HandleType) => void;
  openLibrarySignal: number;
  promptInsertSignal?: { value: string; nonce: number };
  isSelected: boolean;
  isPromptOpen: boolean;
  generationTask?: CanvasGenerationTask;
  onCancelGeneration?: (nodeId: string) => void;
  onRetryGeneration?: (nodeId: string) => void;
  onDismissGeneration?: (nodeId: string) => void;
};
type ImageNode = Node<ImageNodeData, "image">;
type TextNodeData = {
  text: string;
  onChange: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onStartManualConnection: (event: React.PointerEvent, nodeId: string, handleType: HandleType, handleId: string | null) => void;
  onStartKeyboardConnection: (nodeId: string, handleType: HandleType) => void;
  promptCandidates: CanvasPromptReference[];
  onGenerate?: ImageNodeData["onGenerate"];
  imageModels: string[];
  defaultImageModel: string;
  promptSettings?: Partial<CanvasPromptPanelSettings>;
  onClosePrompt: () => void;
  openLibrarySignal: number;
  promptInsertSignal?: { value: string; nonce: number };
  isPromptOpen: boolean;
  generationTask?: CanvasGenerationTask;
  onCancelGeneration?: (nodeId: string) => void;
  onRetryGeneration?: (nodeId: string) => void;
  onDismissGeneration?: (nodeId: string) => void;
};
type TextNode = Node<TextNodeData, "text">;
type CanvasNode = ImageNode | TextNode;
type CanvasResponse = { layout: CanvasLayout | null; images: ImageRecord[] };
type SaveStatus = "loading" | "saved" | "saving" | "unsaved" | "error" | "conflict";
const initialViewport = { x: 30, y: 52, zoom: 1 };
const EMPTY_IMAGE_MODELS: string[] = [];
const EMPTY_IMAGE_IDS: string[] = [];
type CanvasTool = "pan" | "select";
interface PendingConnectionCreate {
  fromNodeId: string;
  fromHandleId: string | null;
  handleType: HandleType;
  screenX: number;
  screenY: number;
  flowX: number;
  flowY: number;
}
interface ManualConnection {
  fromNodeId: string;
  fromHandleId: string | null;
  handleType: HandleType;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}
interface KeyboardConnection {
  fromNodeId: string;
  handleType: HandleType;
}

function createCanvasNodeId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function createEmptyImageId() {
  return createCanvasNodeId();
}

function canvasReferenceLabel(kind: CanvasPromptReference["kind"], id: string, title: string) {
  const compactTitle = title.replace(/\s+/g, " ").trim() || (kind === "image" ? "图片节点" : "文本节点");
  return `@${compactTitle.slice(0, 28)}#${id.replaceAll("-", "").slice(0, 8)}`;
}

function isEmptyCanvasNode(node: CanvasNodeLayout) {
  return node.kind === "image" && node.placeholder === true;
}

function emptyImageRecord(id: string): ImageRecord {
  return { id, prompt: "", model: "gpt-image-2", size: "1024x1024", imageUrl: "", thumbUrl: "" } as ImageRecord;
}

function mergeCanvasImageNodes(previous: Array<{ id: string; x: number; y: number; placeholder?: boolean }>, ids: string[]) {
  const placeholderIds = new Set(previous.filter(node => node.placeholder).map(node => node.id));
  return mergeCanvasItems(previous, ids).map(node => ({
    ...node,
    kind: "image" as const,
    ...(placeholderIds.has(node.id) ? { placeholder: true } : {}),
  }));
}

function CanvasIcon({ name }: { name: "fit" | "focus" | "hand" | "pointer" | "trash" | "text" | "undo" | "redo" | "image" | "settings" | "export" | "palette" | "eraser" }) {
  if (name === "hand") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 11V6.5a1.5 1.5 0 0 0-3 0V11m0-5.5v-2a1.5 1.5 0 0 0-3 0v3m0-1.5a1.5 1.5 0 0 0-3 0v3m0-2a1.5 1.5 0 0 0-3 0v5.2l-1.2-1.1a1.6 1.6 0 0 0-2.3 2.2l4 4.3A6.5 6.5 0 0 0 11.2 22H14a6 6 0 0 0 6-6v-3a1.5 1.5 0 0 0-3 0v-1a1.5 1.5 0 0 0-3 0" /></svg>;
  if (name === "pointer") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 3 14 9-6.2 1.1L10 19 5 3Z" /></svg>;
  if (name === "focus") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" /><circle cx="12" cy="12" r="3" /></svg>;
  if (name === "text") return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h6" /></svg>;
  if (name === "trash") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16m-10 4v6m4-6v6M9 7l1-3h4l1 3m3 0-1 13H7L6 7" /></svg>;
  if (name === "undo") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 7 4 12l5 5" /><path d="M5 12h8a6 6 0 0 1 6 6" /></svg>;
  if (name === "redo") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 7 5 5-5 5" /><path d="M19 12h-8a6 6 0 0 0-6 6" /></svg>;
  if (name === "image") return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8" cy="9" r="1.5" /><path d="m4 17 5-5 3 3 2-2 6 6" /></svg>;
  if (name === "settings") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h9m4 0h3M4 17h3m4 0h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></svg>;
  if (name === "export") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 16V4m0 0-4 4m4-4 4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></svg>;
  if (name === "palette") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 4a8 8 0 1 0 0 16h1.5a1.5 1.5 0 0 0 0-3H12a1.5 1.5 0 0 1 0-3h4a4 4 0 0 0 4-4 6 6 0 0 0-2-4.5A8 8 0 0 0 12 4Z" /><circle cx="7.5" cy="10" r=".8" /><circle cx="10" cy="7.5" r=".8" /><circle cx="14" cy="7.5" r=".8" /></svg>;
  if (name === "eraser") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 17 8.8-8.8a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8L11 21H5a2 2 0 0 1-1.4-3.4L7 14" /><path d="m13 9 4 4" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5" /></svg>;
}

function ConnectionCreateMenu({ pending, onCreateText, onCreateImage, onClose }: {
  pending: PendingConnectionCreate;
  onCreateText: () => void;
  onCreateImage: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button[data-create-option]")?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as globalThis.Node)) onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("keydown", escape);
    };
  }, [onClose]);

  return <section
    ref={ref}
    className="canvas-connection-create"
    role="menu"
    aria-label="从连接处创建节点"
    style={{ left: pending.screenX, top: pending.screenY }}
    onPointerDown={event => event.stopPropagation()}
    onMouseDown={event => event.stopPropagation()}
  >
    <header><span>从这里继续</span><button type="button" onClick={onClose} aria-label="关闭节点菜单">×</button></header>
    <button type="button" role="menuitem" data-create-option onClick={onCreateText}>
      <span className="canvas-connection-create__icon" aria-hidden="true"><CanvasIcon name="text" /></span>
      <span><strong>文本节点</strong><small>承接上一节点，继续输入提示词</small></span>
    </button>
    <button type="button" role="menuitem" data-create-option onClick={onCreateImage}>
      <span className="canvas-connection-create__icon" aria-hidden="true"><CanvasIcon name="fit" /></span>
      <span><strong>图片节点</strong><small>创建空白图片节点并输入提示词</small></span>
    </button>
  </section>;
}

function KeyboardConnectionMenu({ connection, nodes, onSelect, onClose }: {
  connection: KeyboardConnection;
  nodes: CanvasNode[];
  onSelect: (targetNodeId: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("[data-keyboard-target]")?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onClose]);
  const targets = nodes.filter(node => node.id !== connection.fromNodeId);
  return <section ref={ref} className="canvas-keyboard-connection" role="dialog" aria-label="选择连线目标节点" onPointerDown={event => event.stopPropagation()}>
    <header><strong>选择要连接的节点</strong><button type="button" onClick={onClose} aria-label="关闭连线目标选择">×</button></header>
    <div className="canvas-keyboard-connection__list">
      {targets.map(node => {
        const title = node.type === "text" ? node.data.text : node.data.image.prompt;
        return <button key={node.id} type="button" data-keyboard-target onClick={() => onSelect(node.id)}>
          <span>{node.type === "text" ? "文本" : "图片"}</span>
          <strong>{title || (node.type === "text" ? "文本节点" : "图片节点")}</strong>
        </button>;
      })}
    </div>
  </section>;
}

const ImageCanvasNode = memo(function ImageCanvasNode({ id, data, selected }: NodeProps<ImageNode>) {
  const { image } = data;
  const active = selected || data.isSelected;
  const nodeSize = getCanvasNodeSize(image.size);
  return (
    <article className={`infinite-image-node${active ? " is-selected" : ""}`} style={{ "--node-width": `${nodeSize.width}px`, "--node-height": `${nodeSize.height}px` } as CSSProperties}>
      <div className="canvas-connection-hitbox canvas-connection-hitbox--target" data-nodeid={id} data-handletype="target" role="button" tabIndex={0} aria-label="选择左侧连线端点" onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); data.onStartKeyboardConnection(id, "target"); } }} onPointerDownCapture={event => data.onStartManualConnection(event, id, "target", null)}><Handle type="target" position={Position.Left} isConnectable /></div>
      <div className="infinite-image-node__handle">
        <span className="infinite-image-node__grip" aria-hidden="true">⠿</span>
        <span>图像节点</span>
      </div>
      <button type="button" className={`infinite-image-node__preview nodrag${data.isEmpty ? " is-empty" : ""}`} onClick={event => { event.stopPropagation(); if (!data.isEmpty) data.onPreview(image); }} aria-label={data.isEmpty ? "空白图片节点" : `查看大图：${image.prompt}`}>
        {data.isEmpty ? <><CanvasIcon name="image" /><span>空图片节点</span></> : image.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.thumbUrl} alt={image.prompt} loading="lazy" draggable={false} />
        ) : <span>点击查看原图</span>}
      </button>
      <div className="infinite-image-node__footer">
        <span title={image.prompt}>{image.prompt || (data.isEmpty ? "输入提示词生成图片" : "未命名作品")}</span>
        {!data.isEmpty && <button type="button" className="nodrag" onClick={event => { event.stopPropagation(); data.onContinueEditing(image); }}>继续修改</button>}
        <button type="button" className="nodrag" aria-label={`移出画布：${image.prompt || "图片节点"}`} onClick={event => { event.stopPropagation(); data.onRemove(id); }}>移出</button>
      </div>
      {data.generationTask && data.onCancelGeneration && data.onRetryGeneration && data.onDismissGeneration && <CanvasGenerationStatus task={data.generationTask} promptSummary={image.prompt} onCancel={() => data.onCancelGeneration?.(id)} onRetry={() => data.onRetryGeneration?.(id)} onDismiss={() => data.onDismissGeneration?.(id)} />}
      <div className="canvas-connection-hitbox canvas-connection-hitbox--source" data-nodeid={id} data-handletype="source" role="button" tabIndex={0} aria-label="选择右侧连线端点" onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); data.onStartKeyboardConnection(id, "source"); } }} onPointerDownCapture={event => data.onStartManualConnection(event, id, "source", null)}><Handle type="source" position={Position.Right} isConnectable /></div>
      {data.isPromptOpen && data.onGenerate && <CanvasPromptPanel nodeId={id} initialPrompt={image.prompt} candidates={data.promptCandidates} initialSettings={data.promptSettings} models={data.imageModels} defaultModel={data.defaultImageModel} openLibrarySignal={data.openLibrarySignal} promptInsertSignal={data.promptInsertSignal} onGenerate={data.onGenerate} onClose={data.onClosePrompt} />}
    </article>
  );
});

const TextCanvasNode = memo(function TextCanvasNode({ id, data, selected }: NodeProps<TextNode>) {
  return (
    <article className={`infinite-text-node${selected ? " is-selected" : ""}`}>
      <div className="canvas-connection-hitbox canvas-connection-hitbox--target" data-nodeid={id} data-handletype="target" role="button" tabIndex={0} aria-label="选择左侧连线端点" onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); data.onStartKeyboardConnection(id, "target"); } }} onPointerDownCapture={event => data.onStartManualConnection(event, id, "target", null)}><Handle type="target" position={Position.Left} isConnectable /></div>
      <div className="infinite-text-node__handle">
        <span className="infinite-image-node__grip" aria-hidden="true">⠿</span>
        <span>文本节点</span>
        <button type="button" className="nodrag" aria-label="删除文本节点" onClick={event => { event.stopPropagation(); data.onRemove(id); }}>×</button>
      </div>
      <textarea className="nodrag" value={data.text} onChange={event => data.onChange(id, event.target.value)} aria-label="文本节点内容" maxLength={12000} placeholder="输入提示词" />
      {data.generationTask && data.onCancelGeneration && data.onRetryGeneration && data.onDismissGeneration && <CanvasGenerationStatus task={data.generationTask} promptSummary={data.text || "文本节点"} onCancel={() => data.onCancelGeneration?.(id)} onRetry={() => data.onRetryGeneration?.(id)} onDismiss={() => data.onDismissGeneration?.(id)} />}
      <div className="canvas-connection-hitbox canvas-connection-hitbox--source" data-nodeid={id} data-handletype="source" role="button" tabIndex={0} aria-label="选择右侧连线端点" onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); data.onStartKeyboardConnection(id, "source"); } }} onPointerDownCapture={event => data.onStartManualConnection(event, id, "source", null)}><Handle type="source" position={Position.Right} isConnectable /></div>
      {data.isPromptOpen && data.onGenerate && <CanvasPromptPanel nodeId={id} initialPrompt={data.text} candidates={data.promptCandidates} initialSettings={data.promptSettings} models={data.imageModels} defaultModel={data.defaultImageModel} openLibrarySignal={data.openLibrarySignal} promptInsertSignal={data.promptInsertSignal} onGenerate={data.onGenerate} onClose={data.onClosePrompt} />}
    </article>
  );
});
const nodeTypes = { image: ImageCanvasNode, text: TextCanvasNode };

export default function InfiniteImageCanvas({ accountId, images, onSelect, onPreview, onEdit, autoAddImages = true, addImageIds = EMPTY_IMAGE_IDS, onCanvasImageIdsChange, onGenerate, imageModels = EMPTY_IMAGE_MODELS, defaultImageModel = "gpt-image-2" }: {
  accountId: string;
  images: ImageRecord[];
  onSelect: (image: ImageRecord) => void;
  onPreview: (image: ImageRecord) => void;
  onEdit: (image: ImageRecord) => void;
  autoAddImages?: boolean;
  addImageIds?: string[];
  onCanvasImageIdsChange?: (ids: string[]) => void;
  onGenerate?: CanvasGenerateHandler;
  imageModels?: string[];
  defaultImageModel?: string;
}) {
  const handlers = useRef({ onPreview, onEdit });
  useEffect(() => { handlers.current = { onPreview, onEdit }; }, [onPreview, onEdit]);
  const preview = useCallback((image: ImageRecord) => handlers.current.onPreview(image), []);
  const edit = useCallback((image: ImageRecord) => handlers.current.onEdit(image), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [promptNodeId, setPromptNodeId] = useState<string | null>(null);
  const [openLibrarySignal, setOpenLibrarySignal] = useState(0);
  const [promptInsertSignal, setPromptInsertSignal] = useState<{ value: string; nonce: number }>();
  const [manualEdges, setManualEdges] = useState<Edge[]>([]);
  const [pendingConnectionCreate, setPendingConnectionCreate] = useState<PendingConnectionCreate | null>(null);
  const [keyboardConnection, setKeyboardConnection] = useState<KeyboardConnection | null>(null);
  const [manualConnection, setManualConnection] = useState<ManualConnection | null>(null);
  const [generationTasks, setGenerationTasks] = useState<CanvasGenerationTask[]>([]);
  const generationTasksRef = useRef<CanvasGenerationTask[]>([]);
  const generationQueue = useMemo(() => createCanvasGenerationQueue({ limit: 2, onChange: tasks => {
    setGenerationTasks(tasks);
  } }), []);
  useEffect(() => { generationTasksRef.current = generationTasks; }, [generationTasks]);
  useEffect(() => () => generationQueue.dispose(), [generationQueue]);
  useEffect(() => {
    const taskMap = new Map(generationTasks.map(task => [task.nodeId, task]));
    setNodes(previous => previous.map(node => {
      const task = taskMap.get(node.id);
      if (node.type === "text") return { ...node, data: { ...node.data, generationTask: task } };
      return { ...node, data: { ...node.data, generationTask: task } };
    }));
  }, [generationTasks, setNodes]);
  const manualConnectionActive = useRef(false);
  const suppressPaneClick = useRef(false);
  const [canvasTool, setCanvasTool] = useState<CanvasTool>("pan");
  const [zoom, setZoom] = useState(initialViewport.zoom);
  const [gridViewport, setGridViewport] = useState<Viewport>(initialViewport);
  const canvasRootRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<ReactFlowInstance<CanvasNode> | null>(null);
  const continueEditing = useCallback((image: ImageRecord) => {
    if (onGenerate) {
      setSelectedNodeId(image.id);
      setPromptNodeId(image.id);
      setNodes(previous => previous.map(node => ({ ...node, selected: node.id === image.id })));
      return;
    }
    edit(image);
  }, [edit, onGenerate, setNodes]);
  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  const manualEdgesRef = useRef(manualEdges);
  useEffect(() => { manualEdgesRef.current = manualEdges; }, [manualEdges]);
  const imagesRef = useRef(images);
  useEffect(() => { imagesRef.current = images; }, [images]);
  const [remoteImages, setRemoteImages] = useState<ImageRecord[]>([]);
  const remoteImagesRef = useRef(remoteImages);
  useEffect(() => { remoteImagesRef.current = remoteImages; }, [remoteImages]);
  const pendingPlaceholderRef = useRef(new Map<string, string>());
  const pendingAnchorRef = useRef(new Map<string, string>());
  const [placementRevision, setPlacementRevision] = useState(0);
  useEffect(() => {
    setRemoteImages(previous => {
      const merged = new Map(previous.map(image => [image.id, image]));
      images.forEach(image => merged.set(image.id, image));
      return [...merged.values()];
    });
  }, [images]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());
  const [status, setStatus] = useState<SaveStatus>("loading");
  const [ready, setReady] = useState(false);
  const [viewport, setViewport] = useState<Viewport>(initialViewport);
  const [viewportKey, setViewportKey] = useState(0);
  const viewportRef = useRef<Viewport>(initialViewport);
  const hiddenRef = useRef<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const updateHidden = useCallback((ids: string[]) => { hiddenRef.current = ids; setHiddenIds(ids); }, []);
  const revisionRef = useRef(0);
  const dirtyRef = useRef(0);
  const savedRef = useRef(0);
  const inFlight = useRef(false);
  const loadEpoch = useRef(0);
  const alive = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistRef = useRef<() => void>(() => {});
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshot = useCallback((): CanvasLayout => ({
    revision: revisionRef.current,
    nodes: nodesRef.current.map(node => node.type === "text"
      ? { id: node.id, kind: "text" as const, x: node.position.x, y: node.position.y, text: node.data.text }
      : { id: node.id, kind: "image" as const, x: node.position.x, y: node.position.y, ...(node.data.isEmpty ? { placeholder: true } : {}) }),
    connections: manualEdgesRef.current.flatMap(edge => typeof edge.source === "string" && typeof edge.target === "string"
      ? [{ id: edge.id, source: edge.source, target: edge.target }]
      : []),
    hiddenIds: hiddenRef.current,
    viewport: viewportRef.current,
  }), []);
  const retainDraft = useCallback(() => {
    if (dirtyRef.current !== savedRef.current || inFlight.current) saveLocalCanvasDraft(accountId, snapshot());
  }, [accountId, snapshot]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => persistRef.current(), 600);
  }, []);
  const changed = useCallback(() => {
    dirtyRef.current += 1;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(retainDraft, 0);
    setStatus(current => current === "conflict" ? current : "unsaved");
    schedule();
  }, [retainDraft, schedule]);
  const remove = useCallback((id: string, cancelTask = true) => {
    if (cancelTask) generationQueue.cancel(id);
    const target = nodesRef.current.find(node => node.id === id);
    if (target?.type === "image" && !target.data.isEmpty && !hiddenRef.current.includes(id)) updateHidden([...hiddenRef.current, id]);
    nodesRef.current = nodesRef.current.filter(node => node.id !== id);
    setNodes(nodesRef.current);
    setManualEdges(previous => {
      const next = previous.filter(edge => edge.source !== id && edge.target !== id);
      manualEdgesRef.current = next;
      return next;
    });
    setSelectedNodeId(current => current === id ? null : current);
    setPromptNodeId(current => current === id ? null : current);
    changed();
  }, [changed, generationQueue, setNodes, updateHidden]);
  const cancelGeneration = useCallback((nodeId: string) => {
    generationQueue.cancel(nodeId);
  }, [generationQueue]);
  const retryGeneration = useCallback((nodeId: string) => {
    generationQueue.retry(nodeId);
  }, [generationQueue]);
  const dismissGeneration = useCallback((nodeId: string) => {
    generationQueue.dismiss(nodeId);
  }, [generationQueue]);
  const updateText = useCallback((id: string, text: string) => {
    nodesRef.current = nodesRef.current.map(node => node.id === id && node.type === "text"
      ? { ...node, data: { ...node.data, text } }
      : node);
    setNodes(nodesRef.current);
    changed();
  }, [changed, setNodes]);
  const connectGeneratedNodes = useCallback((sourceId: string, generatedIds: string[]) => {
    if (!generatedIds.length) return;
    const next = generatedIds.reduce((edges, targetId) => {
      if (!targetId || targetId === sourceId || edges.some(edge => edge.source === sourceId && edge.target === targetId)) return edges;
      return addEdge({ source: sourceId, target: targetId, sourceHandle: null, targetHandle: null }, edges);
    }, manualEdgesRef.current);
    if (next === manualEdgesRef.current) return;
    manualEdgesRef.current = next;
    setManualEdges(next);
    changed();
  }, [changed]);
  const generateForNode = useCallback(async (nodeId: string, prompt: string, references: CanvasPromptReference[], settings: CanvasPromptPanelSettings) => {
    const node = nodesRef.current.find(candidate => candidate.id === nodeId);
    const targetImage = node?.type === "image" && !node.data.isEmpty ? node.data.image : null;
    if (!onGenerate) return;
    generationQueue.enqueue({
      nodeId,
      count: settings.count,
      run: async signal => {
        const generatedIds = await onGenerate(nodeId, prompt, references, settings, targetImage, { signal });
        const nodeStillPresent = nodesRef.current.some(current => current.id === nodeId);
        if (signal.aborted || !nodeStillPresent) {
          /* The node was removed or the task cancelled while the request was in flight.
             The work stays in the library, but late results must not recreate canvas nodes or edges. */
          return { completed: 0, failed: 0 };
        }
        if (Array.isArray(generatedIds)) {
          const sourceIds = manualEdgesRef.current.filter(edge => edge.target === nodeId).map(edge => edge.source);
          const sourceNode = nodesRef.current.find(current => current.id === nodeId);
          if (sourceNode?.type === "image" && sourceNode.data.isEmpty) {
            const [firstId] = generatedIds;
            if (firstId) {
              pendingPlaceholderRef.current.set(firstId, nodeId);
              generatedIds.forEach(id => pendingAnchorRef.current.set(id, nodeId));
              const retained = replacePlaceholderConnections(manualEdgesRef.current, nodeId, firstId);
              const next = generatedIds.reduce((edges, targetId) => sourceIds.reduce((result, sourceId) => {
                if (result.some(edge => edge.source === sourceId && edge.target === targetId)) return result;
                return addEdge({ source: sourceId, target: targetId, sourceHandle: null, targetHandle: null }, result);
              }, edges), retained);
              manualEdgesRef.current = next;
              setManualEdges(next);
              changed();
            }
          } else {
            const placeholderIds = findConnectedPlaceholderIds(
              nodesRef.current
                .filter((current): current is ImageNode => current.type === "image")
                .map(current => ({ id: current.id, placeholder: current.data.isEmpty === true })),
              manualEdgesRef.current,
              nodeId,
            );
            const filledCount = Math.min(placeholderIds.length, generatedIds.length);
            if (!filledCount) {
              generatedIds.forEach(id => pendingAnchorRef.current.set(id, nodeId));
              connectGeneratedNodes(nodeId, generatedIds);
            } else {
              let next = manualEdgesRef.current;
              for (let index = 0; index < filledCount; index += 1) {
                const generatedId = generatedIds[index];
                const placeholderId = placeholderIds[index];
                const incoming = next.filter(edge => edge.target === placeholderId);
                next = replacePlaceholderConnections(next, placeholderId, generatedId);
                for (const edge of incoming) {
                  next = addEdge({ source: edge.source, target: generatedId, sourceHandle: edge.sourceHandle ?? null, targetHandle: edge.targetHandle ?? null }, next);
                }
                pendingPlaceholderRef.current.set(generatedId, placeholderId);
              }
              const remainingIds = generatedIds.slice(filledCount);
              remainingIds.forEach(id => pendingAnchorRef.current.set(id, nodeId));
              next = remainingIds.reduce((edges, targetId) => addEdge({ source: nodeId, target: targetId, sourceHandle: null, targetHandle: null }, edges), next);
              manualEdgesRef.current = next;
              setManualEdges(next);
              changed();
            }
          }
          /* The library update can reach the canvas before these hints are recorded,
             so ask the layout effect to run again and correct the placement. */
          setPlacementRevision(revision => revision + 1);
          return { completed: generatedIds.length, failed: generatedIds.length ? 0 : 1, error: generatedIds.length ? undefined : "未生成图片" };
        }
        return { completed: 0, failed: 1, error: "未生成图片" };
      },
    });
    /* Results are connected by the queue job so queued tasks do not hold the prompt panel open. */
    return;
  }, [changed, connectGeneratedNodes, generationQueue, onGenerate]);
  const addManualConnection = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    const current = manualEdgesRef.current;
    if (current.some(edge => edge.source === connection.source && edge.target === connection.target)) return;
    const next = addEdge(connection, current);
    manualEdgesRef.current = next;
    setManualEdges(next);
    changed();
  }, [changed]);
  const beginKeyboardConnection = useCallback((nodeId: string, handleType: HandleType) => {
    setSelectedNodeId(nodeId);
    setKeyboardConnection({ fromNodeId: nodeId, handleType });
  }, []);
  const closeKeyboardConnection = useCallback(() => {
    const source = keyboardConnection;
    setKeyboardConnection(null);
    if (source) requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(
        `.canvas-connection-hitbox[data-nodeid="${CSS.escape(source.fromNodeId)}"][data-handletype="${source.handleType}"]`,
      )?.focus();
    });
  }, [keyboardConnection]);
  const completeKeyboardConnection = useCallback((targetNodeId: string) => {
    const source = keyboardConnection;
    if (!source || source.fromNodeId === targetNodeId) return;
    addManualConnection(source.handleType === "source"
      ? { source: source.fromNodeId, target: targetNodeId, sourceHandle: null, targetHandle: null }
      : { source: targetNodeId, target: source.fromNodeId, sourceHandle: null, targetHandle: null });
    closeKeyboardConnection();
  }, [addManualConnection, closeKeyboardConnection, keyboardConnection]);
  const beginManualConnection = useCallback((event: React.PointerEvent, nodeId: string, handleType: HandleType, handleId: string | null) => {
    if (event.button !== 0 || manualConnectionActive.current) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = canvasRootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startX = event.clientX - rect.left;
    const startY = event.clientY - rect.top;
    manualConnectionActive.current = true;
    setManualConnection({ fromNodeId: nodeId, fromHandleId: handleId, handleType, startX, startY, currentX: startX, currentY: startY });
    const move = (moveEvent: PointerEvent) => {
      if (!manualConnectionActive.current) return;
      setManualConnection(current => current ? { ...current, currentX: moveEvent.clientX - rect.left, currentY: moveEvent.clientY - rect.top } : current);
    };
    const cleanup = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", cancel);
      manualConnectionActive.current = false;
      setManualConnection(null);
    };
    const cancel = () => cleanup();
    const finish = (upEvent: PointerEvent) => {
      if (!manualConnectionActive.current) return;
      const hit = document.elementFromPoint(upEvent.clientX, upEvent.clientY)?.closest<HTMLElement>(".canvas-connection-hitbox");
      const targetNodeId = hit?.dataset.nodeid;
      const targetType = hit?.dataset.handletype as HandleType | undefined;
      const moved = Math.hypot(upEvent.clientX - event.clientX, upEvent.clientY - event.clientY) >= 12;
      cleanup();
      if (!moved) return;
      if (targetNodeId && targetType && targetType !== handleType && targetNodeId !== nodeId) {
        addManualConnection(handleType === "source"
          ? { source: nodeId, target: targetNodeId, sourceHandle: handleId, targetHandle: null }
          : { source: targetNodeId, target: nodeId, sourceHandle: null, targetHandle: handleId });
        return;
      }
      const flowPoint = flowRef.current?.screenToFlowPosition({ x: upEvent.clientX, y: upEvent.clientY }) ?? { x: (upEvent.clientX - rect.left - viewportRef.current.x) / viewportRef.current.zoom, y: (upEvent.clientY - rect.top - viewportRef.current.y) / viewportRef.current.zoom };
      suppressPaneClick.current = true;
      setPendingConnectionCreate({ fromNodeId: nodeId, fromHandleId: handleId, handleType, screenX: Math.max(12, Math.min(upEvent.clientX - rect.left, rect.width - 252)), screenY: Math.max(12, Math.min(upEvent.clientY - rect.top, rect.height - 178)), flowX: flowPoint.x, flowY: flowPoint.y });
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", finish);
    document.addEventListener("pointercancel", cancel);
  }, [addManualConnection]);
  const addTextNode = useCallback((text = "", position?: { x: number; y: number }) => {
    if (!ready || nodesRef.current.length >= 500) return null;
    const center = flowRef.current?.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }) ?? { x: 120, y: 120 };
    const id = createCanvasNodeId();
    const node: TextNode = {
      id,
      type: "text",
      position: position ?? { x: center.x - 140, y: center.y - 90 },
      dragHandle: ".infinite-text-node__handle",
      data: { text, onChange: updateText, onRemove: remove, onStartManualConnection: beginManualConnection, onStartKeyboardConnection: beginKeyboardConnection, promptCandidates: [], onGenerate: generateForNode, imageModels, defaultImageModel, promptSettings: { model: defaultImageModel }, onClosePrompt: () => setPromptNodeId(null), openLibrarySignal, promptInsertSignal, isPromptOpen: true, generationTask: generationTasksRef.current.find(task => task.nodeId === id), onCancelGeneration: cancelGeneration, onRetryGeneration: retryGeneration, onDismissGeneration: dismissGeneration },
    };
    nodesRef.current = [...nodesRef.current, node];
    setNodes(nodesRef.current);
    setSelectedNodeId(id);
    changed();
    return id;
  }, [beginKeyboardConnection, beginManualConnection, cancelGeneration, changed, defaultImageModel, dismissGeneration, generateForNode, imageModels, openLibrarySignal, promptInsertSignal, ready, remove, retryGeneration, setNodes, updateText]);
  const addEmptyImageNode = useCallback((position?: { x: number; y: number }) => {
    if (!ready || nodesRef.current.length >= 500) return null;
    const center = flowRef.current?.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }) ?? { x: 120, y: 120 };
    const id = createEmptyImageId();
    const node: ImageNode = {
      id,
      type: "image",
      position: position ?? { x: center.x - 160, y: center.y - 160 },
      dragHandle: ".infinite-image-node__handle",
      data: { image: emptyImageRecord(id), isEmpty: true, onPreview: preview, onEdit: edit, onContinueEditing: continueEditing, onRemove: remove, onStartManualConnection: beginManualConnection, onStartKeyboardConnection: beginKeyboardConnection, promptCandidates: [], onGenerate: generateForNode, imageModels, defaultImageModel, promptSettings: { model: defaultImageModel }, onClosePrompt: () => setPromptNodeId(null), openLibrarySignal, promptInsertSignal, isSelected: true, isPromptOpen: true, generationTask: generationTasksRef.current.find(task => task.nodeId === id), onCancelGeneration: cancelGeneration, onRetryGeneration: retryGeneration, onDismissGeneration: dismissGeneration },
    };
    nodesRef.current = [...nodesRef.current, node];
    setNodes(nodesRef.current);
    setSelectedNodeId(id);
    setPromptNodeId(id);
    changed();
    return id;
  }, [beginKeyboardConnection, beginManualConnection, cancelGeneration, changed, continueEditing, defaultImageModel, dismissGeneration, edit, generateForNode, imageModels, openLibrarySignal, preview, promptInsertSignal, ready, remove, retryGeneration, setNodes]);
  const connectCreatedNode = useCallback((newNodeId: string, pending: PendingConnectionCreate) => {
    const connection = pending.handleType === "source"
      ? { source: pending.fromNodeId, target: newNodeId, sourceHandle: pending.fromHandleId, targetHandle: null }
      : { source: newNodeId, target: pending.fromNodeId, sourceHandle: null, targetHandle: pending.fromHandleId };
    if (connection.source === connection.target || manualEdgesRef.current.some(edge => edge.source === connection.source && edge.target === connection.target)) return;
    const next = addEdge({ ...connection, type: "default" }, manualEdgesRef.current);
    manualEdgesRef.current = next;
    setManualEdges(next);
    setPendingConnectionCreate(null);
    changed();
  }, [changed]);
  const createConnectedText = useCallback(() => {
    if (!pendingConnectionCreate) return;
    const id = addTextNode("", { x: pendingConnectionCreate.flowX, y: pendingConnectionCreate.flowY });
    if (id) connectCreatedNode(id, pendingConnectionCreate);
  }, [addTextNode, connectCreatedNode, pendingConnectionCreate]);
  const chooseConnectedImage = useCallback(() => {
    if (!pendingConnectionCreate) return;
    const pending = pendingConnectionCreate;
    setPendingConnectionCreate(null);
    const id = addEmptyImageNode({ x: pending.flowX, y: pending.flowY });
    if (id) connectCreatedNode(id, pending);
  }, [addEmptyImageNode, connectCreatedNode, pendingConnectionCreate]);
  const records = useMemo(() => new Map(remoteImages.filter(image => !deletedIds.has(image.id)).map(image => [image.id, image])), [deletedIds, remoteImages]);
  useEffect(() => {
    const onDeleted = (event: Event) => {
      const id = (event as CustomEvent<unknown>).detail;
      if (typeof id !== "string") return;
      setDeletedIds(previous => new Set(previous).add(id));
      updateHidden(hiddenRef.current.filter(hidden => hidden !== id));
      nodesRef.current = nodesRef.current.filter(node => node.id !== id);
      setNodes(nodesRef.current);
      setSelectedNodeId(current => current === id ? null : current);
      setPromptNodeId(current => current === id ? null : current);
      setPendingConnectionCreate(null);
      setManualEdges(previous => {
        const next = previous.filter(edge => edge.source !== id && edge.target !== id);
        manualEdgesRef.current = next;
        return next;
      });
      changed();
    };
    window.addEventListener("deeproast:image-deleted", onDeleted);
    return () => window.removeEventListener("deeproast:image-deleted", onDeleted);
  }, [changed, setNodes, updateHidden]);
  const makeNodes = useCallback((positions: CanvasNodeLayout[], recordsMap: Map<string, ImageRecord>) => {
    const textPositions = positions.filter((item): item is Extract<CanvasNodeLayout, { kind: "text" }> => item.kind === "text");
    const promptCandidates: CanvasPromptReference[] = [
      ...[...recordsMap.values()].map(candidate => {
        const title = candidate.prompt || "未命名作品";
        return {
          id: candidate.id,
          label: canvasReferenceLabel("image", candidate.id, title),
          title,
          kind: "image" as const,
          previewUrl: candidate.thumbUrl || candidate.imageUrl,
          imageUrl: candidate.imageUrl,
        };
      }),
      ...textPositions.map(item => {
        const title = item.text || "文本节点";
        return {
          id: item.id,
          label: canvasReferenceLabel("text", item.id, title),
          title,
          kind: "text" as const,
          text: item.text,
        };
      }),
    ];
    return positions.flatMap<CanvasNode>(position => {
      if (position.kind === "text") {
        return [{
          id: position.id,
          type: "text",
          position: { x: position.x, y: position.y },
          dragHandle: ".infinite-text-node__handle",
          data: {
            text: position.text,
            onChange: updateText,
            onRemove: remove,
            onStartManualConnection: beginManualConnection,
            onStartKeyboardConnection: beginKeyboardConnection,
            promptCandidates,
            onGenerate: generateForNode,
            imageModels,
            defaultImageModel,
            promptSettings: { model: defaultImageModel },
            onClosePrompt: () => {
              setPromptNodeId(null);
              setNodes(previous => previous.map(node => ({ ...node, selected: false })));
            },
            openLibrarySignal,
            promptInsertSignal,
            isPromptOpen: position.id === promptNodeId,
            generationTask: generationTasksRef.current.find(task => task.nodeId === position.id),
            onCancelGeneration: cancelGeneration,
            onRetryGeneration: retryGeneration,
            onDismissGeneration: dismissGeneration,
          },
        }];
      }
      const image = recordsMap.get(position.id) ?? (isEmptyCanvasNode(position) ? emptyImageRecord(position.id) : undefined);
      return image ? [{
        id: position.id,
        type: "image",
        position: { x: position.x, y: position.y },
        dragHandle: ".infinite-image-node__handle",
        data: {
          image,
          isEmpty: isEmptyCanvasNode(position),
          onPreview: preview,
          onEdit: edit,
          onContinueEditing: continueEditing,
          onRemove: remove,
          onStartManualConnection: beginManualConnection,
          onStartKeyboardConnection: beginKeyboardConnection,
          isSelected: position.id === selectedNodeId,
          isPromptOpen: position.id === promptNodeId,
          openLibrarySignal,
          promptInsertSignal,
          promptCandidates,
          onGenerate: generateForNode,
          imageModels,
          defaultImageModel,
          promptSettings: {
            model: image.model || defaultImageModel,
            size: image.size || undefined,
          },
          generationTask: generationTasksRef.current.find(task => task.nodeId === position.id),
          onCancelGeneration: cancelGeneration,
          onRetryGeneration: retryGeneration,
          onDismissGeneration: dismissGeneration,
          onClosePrompt: () => {
            setPromptNodeId(null);
            setNodes(previous => previous.map(node => ({ ...node, selected: false })));
          },
        },
      }] : [];
    });
  }, [beginKeyboardConnection, beginManualConnection, cancelGeneration, continueEditing, defaultImageModel, dismissGeneration, edit, generateForNode, imageModels, openLibrarySignal, preview, promptInsertSignal, promptNodeId, remove, retryGeneration, selectedNodeId, setNodes, updateText]);

  // A returned record is authoritative; local history may be stale after deletion on another device.
  const resolveImages = useCallback(async (ids: string[]) => {
    const unique = [...new Set(ids)];
    const batches = await Promise.all(Array.from({ length: Math.ceil(unique.length / 1000) }, (_, index) =>
      apiJson<{ images: ImageRecord[] }>("/api/image-canvas", { method: "POST", ...jsonBody({ ids: unique.slice(index * 1000, (index + 1) * 1000) }) }),
    ));
    return batches.flatMap(batch => batch.images);
  }, []);
  const applyRemote = useCallback((data: CanvasResponse, extra: ImageRecord[], draft: CanvasLayout | null) => {
    const all = new Map(extra.filter(image => !deletedIds.has(image.id)).map(image => [image.id, image]));
    const cloudRevision = data.layout?.revision ?? 0;
    if (draft && data.layout && sameCanvasContent(draft, data.layout)) {
      clearLocalCanvasDraft(accountId);
      draft = null;
    }
    const source = draft ?? data.layout;
    const hidden = (source?.hiddenIds ?? []).filter(id => all.has(id));
    updateHidden(hidden);
    revisionRef.current = draft?.revision ?? cloudRevision;
    const savedNodes = (source?.nodes ?? []).filter(node => node.kind === "text" || all.has(node.id) || isEmptyCanvasNode(node));
    const savedImageNodes = savedNodes.filter(node => node.kind !== "text");
    const savedTextNodes = savedNodes.filter((node): node is Extract<CanvasNodeLayout, { kind: "text" }> => node.kind === "text");
    const linkedIds = new Set<string>();
    for (const connection of source?.connections ?? []) {
      linkedIds.add(connection.source);
      linkedIds.add(connection.target);
    }
    const legacyDroppedIds = new Set(!autoAddImages
      ? findLegacyAutoAddedCanvasIds(
          savedImageNodes.map(node => ({ id: node.id, x: node.x, y: node.y, placeholder: isEmptyCanvasNode(node) })),
          linkedIds,
        )
      : []);
    const restoredImageNodes = legacyDroppedIds.size
      ? savedImageNodes.filter(node => !legacyDroppedIds.has(node.id))
      : savedImageNodes;
    const candidateIds = autoAddImages
      ? [...new Set([...restoredImageNodes.map(node => node.id), ...all.keys()])]
      : restoredImageNodes.map(node => node.id);
    const candidates = candidateIds.filter(id => !hidden.includes(id)).slice(0, 500);
    const positions: CanvasNodeLayout[] = [
      ...mergeCanvasImageNodes(restoredImageNodes, candidates),
      ...savedTextNodes,
    ];
    const next = makeNodes(positions, all);
    nodesRef.current = next;
    setNodes(next);
    const nodeIds = new Set(positions.map(node => node.id));
    const connections = (source?.connections ?? []).filter(connection => nodeIds.has(connection.source) && nodeIds.has(connection.target));
    const restoredEdges: Edge[] = connections.map(connection => ({ ...connection, type: "smoothstep" }));
    manualEdgesRef.current = restoredEdges;
    setManualEdges(restoredEdges);
    setRemoteImages([...all.values()]);
    viewportRef.current = source?.viewport ?? initialViewport;
    setViewport(viewportRef.current);
    setZoom(viewportRef.current.zoom);
    setGridViewport(viewportRef.current);
    setViewportKey(key => key + 1);
    savedRef.current = 0;
    const hasNew = positions.some(position => !source?.nodes.some(node => node.id === position.id));
    const hasChanges = Boolean(draft) || hasNew || legacyDroppedIds.size > 0;
    dirtyRef.current = hasChanges ? 1 : 0;
    const conflict = Boolean(draft && draft.revision !== cloudRevision);
    setReady(true);
    setStatus(conflict ? "conflict" : hasChanges ? "unsaved" : "saved");
    if (hasChanges && !conflict) schedule();
  }, [accountId, autoAddImages, deletedIds, makeNodes, schedule, setNodes, updateHidden]);
  const applyRef = useRef(applyRemote);
  useEffect(() => { applyRef.current = applyRemote; }, [applyRemote]);

  const load = useCallback(async () => {
    const epoch = ++loadEpoch.current;
    setReady(false);
    setStatus("loading");
    try {
      const draft = loadLocalCanvasDraft(accountId);
      const data = await apiJson<CanvasResponse>("/api/image-canvas", { cache: "no-store" });
      const ids = [...data.images.map(image => image.id), ...imagesRef.current.map(image => image.id), ...(draft?.nodes.filter(node => !isEmptyCanvasNode(node)).map(node => node.id) ?? []), ...(draft?.hiddenIds ?? [])];
      const extra = await resolveImages(ids);
      if (alive.current && loadEpoch.current === epoch) applyRef.current(data, extra, draft);
    } catch {
      if (alive.current && loadEpoch.current === epoch) setStatus("error");
    }
  }, [accountId, resolveImages]);
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      retainDraft();
      alive.current = false;
      loadEpoch.current += 1;
      if (timer.current) clearTimeout(timer.current);
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [load, retainDraft]);

  useEffect(() => {
    const warnIfUnsaved = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current === savedRef.current && !inFlight.current) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnIfUnsaved);
    return () => window.removeEventListener("beforeunload", warnIfUnsaved);
  }, []);

  useEffect(() => {
    persistRef.current = () => {
    if (!alive.current || !ready || inFlight.current || dirtyRef.current === savedRef.current || status === "conflict" || status === "error") return;
    inFlight.current = true;
    const seq = dirtyRef.current;
    const body = snapshot();
    setStatus("saving");
    void apiJson<{ revision: number }>("/api/image-canvas", { method: "PUT", ...jsonBody(body) }).then(result => {
      if (!alive.current) return;
      revisionRef.current = result.revision;
      savedRef.current = seq;
      if (dirtyRef.current === seq) clearLocalCanvasDraft(accountId);
      else retainDraft();
      setStatus(dirtyRef.current === seq ? "saved" : "unsaved");
    }).catch(error => {
      if (!alive.current) return;
      if (error instanceof ApiError && error.code === "INVALID_CANVAS_IMAGE") {
        const raw = error.raw as { missingIds?: unknown } | undefined;
        const submitted = new Set([...body.nodes.map(node => node.id), ...body.hiddenIds]);
        const missing = Array.isArray(raw?.missingIds) ? raw.missingIds.filter((id): id is string => typeof id === "string" && submitted.has(id)) : [];
        if (missing.length) {
          const removed = new Set(missing);
          setDeletedIds(previous => new Set([...previous, ...missing]));
          updateHidden(hiddenRef.current.filter(id => !removed.has(id)));
          nodesRef.current = nodesRef.current.filter(node => !removed.has(node.id));
          setNodes(nodesRef.current);
          setManualEdges(previous => {
            const next = previous.filter(edge => !removed.has(String(edge.source)) && !removed.has(String(edge.target)));
            manualEdgesRef.current = next;
            return next;
          });
          dirtyRef.current += 1;
          retainDraft();
          setStatus("unsaved");
          return;
        }
      }
      setStatus(error instanceof ApiError && error.code === "CANVAS_CONFLICT" ? "conflict" : "error");
    }).finally(() => {
      inFlight.current = false;
      if (alive.current && dirtyRef.current !== savedRef.current) schedule();
    });
    };
  }, [accountId, ready, retainDraft, schedule, setNodes, snapshot, status, updateHidden]);

  // Revalidate on history updates and return to the tab without discarding local positions.
  useEffect(() => {
    if (!ready) return;
    let active = true;
    let generation = 0;
    const refresh = async () => {
      const current = ++generation;
      const epoch = loadEpoch.current;
      const imageNodeIds = nodesRef.current.filter(node => node.type !== "text").map(node => node.id);
    const ids = [...new Set([...imagesRef.current.map(image => image.id), ...remoteImagesRef.current.map(image => image.id), ...imageNodeIds.filter(id => !nodesRef.current.some(node => node.id === id && node.type === "image" && node.data.isEmpty)), ...hiddenRef.current])];
      try {
        const verified = await resolveImages(ids);
        if (!active || current !== generation || !alive.current || epoch !== loadEpoch.current) return;
        const available = new Set(verified.map(image => image.id));
        const missing = new Set(ids.filter(id => !available.has(id)));
        setRemoteImages(previous => {
          const merged = new Map(previous.filter(image => !missing.has(image.id)).map(image => [image.id, image]));
          verified.forEach(image => merged.set(image.id, image));
          return [...merged.values()];
        });
        if (missing.size) {
          setDeletedIds(previous => new Set([...previous, ...missing]));
          const hasRemoved = nodesRef.current.some(node => missing.has(node.id)) || hiddenRef.current.some(id => missing.has(id));
          if (hasRemoved) {
            nodesRef.current = nodesRef.current.filter(node => !missing.has(node.id));
            setNodes(nodesRef.current);
            setManualEdges(previous => {
              const next = previous.filter(edge => !missing.has(String(edge.source)) && !missing.has(String(edge.target)));
              manualEdgesRef.current = next;
              return next;
            });
            updateHidden(hiddenRef.current.filter(id => !missing.has(id)));
            changed();
          }
        }
      } catch { /* Keep current work and retry on the next focus or history update. */ }
    };
    void refresh();
    const onVisibility = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { active = false; window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", onVisibility); };
  }, [changed, images, ready, resolveImages, setNodes, updateHidden]);

  // History can acquire new works while the canvas stays mounted; retain saved
  // nodes outside the recent-history page and respect explicitly hidden IDs.
  useEffect(() => {
    if (!ready) return;
    const previous = nodesRef.current;
    const previousImages = previous.filter(node => node.type !== "text");
    const previousText = previous.filter((node): node is TextNode => node.type === "text");
    const ids = [...new Set([...previousImages.map(node => node.id), ...(autoAddImages ? [...records.keys()] : [])])].filter(id => (previousImages.some(node => node.id === id && node.type === "image" && node.data.isEmpty) || records.has(id)) && !hiddenRef.current.includes(id)).slice(0, 500 - previousText.length);
    const positions: CanvasNodeLayout[] = [
      ...mergeCanvasImageNodes(previousImages.map(node => ({ id: node.id, x: node.position.x, y: node.position.y, placeholder: node.type === "image" && node.data.isEmpty })), ids),
      ...previousText.map(node => ({ id: node.id, kind: "text" as const, x: node.position.x, y: node.position.y, text: node.data.text })),
    ];
    const next = makeNodes(positions, records);
    nodesRef.current = next;
    setNodes(next);
    if (next.some(node => !previous.some(old => old.id === node.id))) changed();
  }, [autoAddImages, changed, hiddenIds, makeNodes, ready, records, setNodes]);

  useEffect(() => {
    if (!ready || autoAddImages) return;
    const pendingHints = new Set([...pendingPlaceholderRef.current.keys(), ...pendingAnchorRef.current.keys()]);
    const additions = [...new Set([...addImageIds, ...pendingHints])]
      .filter(id => records.has(id) && (pendingHints.has(id) || !nodesRef.current.some(node => node.id === id)));
    if (!additions.length) return;
    const restored = hiddenRef.current.filter(id => !additions.includes(id));
    if (restored.length !== hiddenRef.current.length) updateHidden(restored);
    /* Hints are consumed before the state update: React may re-invoke the updater,
       and a second pass must keep every other node instead of collapsing the canvas
       down to the freshly generated image. */
    const placeholders = new Map<string, string>();
    const anchors = new Map<string, string>();
    for (const id of additions) {
      const placeholderId = pendingPlaceholderRef.current.get(id);
      const anchorId = pendingAnchorRef.current.get(id);
      if (placeholderId) placeholders.set(id, placeholderId);
      if (anchorId) anchors.set(id, anchorId);
      pendingPlaceholderRef.current.delete(id);
      pendingAnchorRef.current.delete(id);
    }
    setNodes(previous => {
      const previousImages = previous.filter(node => node.type !== "text");
      const previousText = previous.filter((node): node is TextNode => node.type === "text");
      const imageItems = placeCanvasAdditions(
        previousImages.map(node => ({ id: node.id, x: node.position.x, y: node.position.y, placeholder: node.type === "image" && node.data.isEmpty })),
        additions,
        { placeholders, anchors },
        previousText.map(node => ({ id: node.id, x: node.position.x, y: node.position.y })),
      );
      const positions: CanvasNodeLayout[] = [
        ...imageItems.map(item => ({ ...item, kind: "image" as const })),
        ...previousText.map(node => ({ id: node.id, kind: "text" as const, x: node.position.x, y: node.position.y, text: node.data.text })),
      ];
      const next = makeNodes(positions, records);
      return next;
    });
    changed();
  }, [addImageIds, autoAddImages, changed, makeNodes, placementRevision, ready, records, setNodes, updateHidden]);

  useEffect(() => {
    if (ready) onCanvasImageIdsChange?.(nodes.filter(node => node.type !== "text").map(node => node.id));
  }, [nodes, onCanvasImageIdsChange, ready]);

  const restore = useCallback((id: string) => {
    const image = records.get(id);
    if (!image || nodesRef.current.length >= 500) return;
    updateHidden(hiddenRef.current.filter(hidden => hidden !== id));
    setNodes(previous => {
      const previousImages = previous.filter(node => node.type !== "text");
      const previousText = previous.filter((node): node is TextNode => node.type === "text");
      const positions: CanvasNodeLayout[] = [
        ...mergeCanvasImageNodes(previousImages.map(node => ({ id: node.id, x: node.position.x, y: node.position.y, placeholder: node.type === "image" && node.data.isEmpty })), [...previousImages.map(node => node.id), id]),
        ...previousText.map(node => ({ id: node.id, kind: "text" as const, x: node.position.x, y: node.position.y, text: node.data.text })),
      ];
      const next = makeNodes(positions, records);
      nodesRef.current = next;
      return next;
    });
    changed();
  }, [changed, makeNodes, records, setNodes, updateHidden]);

  const changeNodes = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    nodesRef.current = applyNodeChanges(changes, nodesRef.current);
    onNodesChange(changes);
  }, [onNodesChange]);
  const discardLocal = useCallback(() => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    if (timer.current) clearTimeout(timer.current);
    savedRef.current = dirtyRef.current;
    clearLocalCanvasDraft(accountId);
    void load();
  }, [accountId, load]);
  const keepLocal = useCallback(async () => {
    try {
      const latest = await apiJson<CanvasResponse>("/api/image-canvas", { cache: "no-store" });
      if (!alive.current) return;
      revisionRef.current = latest.layout?.revision ?? 0;
      dirtyRef.current += 1;
      retainDraft();
      setStatus("unsaved");
      schedule();
    } catch {
      if (alive.current) setStatus("conflict");
    }
  }, [retainDraft, schedule]);
  const availableCount = [...records.keys()].filter(id => !hiddenIds.includes(id)).length;
  const imageNodeCount = nodes.filter(node => node.type !== "text").length;
  const overflow = Math.max(0, availableCount - imageNodeCount);
  const selectNode = useCallback((_event: React.MouseEvent, node: CanvasNode) => {
    setSelectedNodeId(node.id);
    setPromptNodeId(node.id);
    setPendingConnectionCreate(null);
    if (node.type === "image") {
      onSelect(node.data.image);
    }
  }, [onSelect]);
  const openPromptLibrary = useCallback(() => {
    const selectedNode = selectedNodeId && nodesRef.current.find(node => node.id === selectedNodeId);
    if (!selectedNode || !onGenerate) return;
    setPromptNodeId(selectedNode.id);
    setPromptInsertSignal({ value: selectedNode.type === "image" ? selectedNode.data.image.prompt : selectedNode.data.text, nonce: Date.now() });
    setOpenLibrarySignal(signal => signal + 1);
  }, [onGenerate, selectedNodeId]);
  const edges = useMemo<Edge[]>(() => dedupeCanvasEdges([
    ...manualEdges,
    ...canvasEdges(nodes.filter((node): node is ImageNode => node.type === "image").map(node => node.data.image)),
  ]).map(edge => {
    const active = Boolean(selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId));
    const color = active ? "#a44f32" : "#8f7f75";
    return {
      ...edge,
      type: "default",
      interactionWidth: 24,
      style: {
        stroke: color,
        strokeWidth: active ? 2.8 : 2.1,
        opacity: selectedNodeId && !active ? 0.38 : 0.9,
        filter: active ? "drop-shadow(0 0 5px rgba(164,79,50,.28))" : "drop-shadow(0 1px 0 rgba(255,255,255,.9))",
      },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 15, height: 15 },
      animated: active,
    };
  }), [manualEdges, nodes, selectedNodeId]);
  const connectNodes = useCallback((connection: Connection) => {
    addManualConnection(connection);
  }, [addManualConnection]);
  const finishConnection = useCallback((event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
    if (!state.fromNode || state.toNode) return;
    const point = "changedTouches" in event ? event.changedTouches[0] ?? event.touches[0] : event;
    if (!point) return;
    const dragDistance = Math.hypot(state.pointer.x - state.from.x, state.pointer.y - state.from.y);
    if (dragDistance < 12) return;
    const rect = canvasRootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const flowPoint = flowRef.current?.screenToFlowPosition({ x: point.clientX, y: point.clientY }) ?? {
      x: (point.clientX - rect.left - viewportRef.current.x) / viewportRef.current.zoom,
      y: (point.clientY - rect.top - viewportRef.current.y) / viewportRef.current.zoom,
    };
    setPendingConnectionCreate({
      fromNodeId: state.fromNode.id,
      fromHandleId: state.fromHandle.id ?? null,
      handleType: state.fromHandle.type,
      screenX: Math.max(12, Math.min(point.clientX - rect.left, rect.width - 252)),
      screenY: Math.max(12, Math.min(point.clientY - rect.top, rect.height - 178)),
      flowX: flowPoint.x,
      flowY: flowPoint.y,
    });
  }, []);
  const fitCanvas = useCallback(() => { void flowRef.current?.fitView({ padding: 0.2, maxZoom: 0.9, duration: 280 }); }, []);
  const focusSelected = useCallback(() => {
    if (selectedNodeId) void flowRef.current?.fitView({ nodes: [{ id: selectedNodeId }], padding: 1.1, maxZoom: 1.25, duration: 260 });
  }, [selectedNodeId]);
  const changeZoom = useCallback((value: number) => {
    setZoom(value);
    void flowRef.current?.zoomTo(value, { duration: 100 });
  }, []);
  const removeSelected = useCallback(() => {
    if (!selectedNodeId) return;
    remove(selectedNodeId);
    setSelectedNodeId(null);
    setPromptNodeId(null);
  }, [remove, selectedNodeId]);
  const moved = useCallback((_event: unknown, next: Viewport) => {
    const previous = viewportRef.current;
    viewportRef.current = next;
    setZoom(next.zoom);
    setGridViewport(next);
    if (ready && (previous.x !== next.x || previous.y !== next.y || previous.zoom !== next.zoom)) changed();
  }, [changed, ready]);
  const statusLabel = status === "loading" ? "正在加载" : status === "saving" ? "正在保存" : status === "unsaved" ? "等待保存" : status === "saved" ? "已同步" : status === "conflict" ? "需要处理冲突" : "同步失败";

  return (
    <div ref={canvasRootRef} id="infinite-image-canvas" className="infinite-image-canvas" aria-label="作品画布">
      <div className="canvas-grid-overlay" aria-hidden="true" style={{ backgroundPosition: `${gridViewport.x}px ${gridViewport.y}px`, backgroundSize: `${32 * gridViewport.zoom}px ${32 * gridViewport.zoom}px` }} />
      {manualConnection && <svg className="canvas-manual-connection" aria-hidden="true"><path d={`M ${manualConnection.startX} ${manualConnection.startY} C ${manualConnection.startX + 90} ${manualConnection.startY}, ${manualConnection.currentX - 90} ${manualConnection.currentY}, ${manualConnection.currentX} ${manualConnection.currentY}`} /></svg>}
      {ready && nodes.length > 0 && <ReactFlow key={viewportKey} nodes={nodes} edges={edges} onInit={instance => { flowRef.current = instance; }} onConnect={connectNodes} onConnectEnd={finishConnection} onNodesChange={changeNodes} onNodeDragStop={changed} onMove={(_event, next) => setGridViewport(previous => previous.x === next.x && previous.y === next.y && previous.zoom === next.zoom ? previous : next)} onMoveEnd={moved} onNodeClick={selectNode} onPaneClick={() => { if (suppressPaneClick.current) { suppressPaneClick.current = false; return; } setSelectedNodeId(null); setPromptNodeId(null); setPendingConnectionCreate(null); setNodes(previous => previous.map(node => ({ ...node, selected: false }))); }} nodeTypes={nodeTypes} defaultViewport={viewport} minZoom={0.2} maxZoom={2} panOnDrag={canvasTool === "pan"} selectionOnDrag={canvasTool === "select"} connectionLineStyle={{ stroke: "#a44f32", strokeWidth: 2.2, strokeDasharray: "5 5" }} onlyRenderVisibleElements nodesConnectable deleteKeyCode={null} proOptions={{ hideAttribution: false }} />}
      {ready && nodes.length === 0 && <div className="infinite-image-empty"><strong>画布暂无节点</strong><span>从左侧资产库加入一张作品开始创作</span></div>}
      <CanvasGenerationQueueSummary tasks={generationTasks} getLabel={nodeId => {
        const node = nodesRef.current.find(current => current.id === nodeId);
        return node?.type === "text" ? (node.data.text || "文本节点") : (node?.data.image.prompt || "图片节点");
      }} onCancel={cancelGeneration} onRetry={retryGeneration} />
      <div className="infinite-image-canvas__topline">
        <div className="infinite-image-canvas__title">
          <strong>作品画布</strong>
          <span className={`infinite-image-canvas__status is-${status}`} role="status" aria-live="polite"><i aria-hidden="true" />{statusLabel}</span>
        </div>
        <div className="infinite-image-canvas__node-actions">
          <button type="button" className="canvas-text-add" onClick={() => addTextNode()} disabled={nodes.length >= 500}>+ 文本节点</button>
          <span className="infinite-image-canvas__node-count">{nodes.length} 个节点</span>
        </div>
      </div>
      {(status === "error" || status === "conflict" || (autoAddImages && overflow > 0)) && <div className={`infinite-image-canvas__notice${status === "error" || status === "conflict" ? " is-error" : ""}`}>
        {status === "error" && <><span>画布同步失败，本机改动尚未保存。</span><button type="button" onClick={() => { if (!ready) void load(); else { setStatus("unsaved"); schedule(); } }}>重试</button></>}
        {status === "conflict" && <><span>其他设备更新了画布，本机改动尚未保存。</span><button type="button" onClick={() => { void keepLocal(); }}>保留本机布局</button><button type="button" onClick={discardLocal}>加载云端画布</button></>}
        {ready && autoAddImages && overflow > 0 && <span>画布最多显示 500 张，还有 {overflow} 张作品可在作品库查看。</span>}
      </div>}
      {pendingConnectionCreate && <ConnectionCreateMenu
        pending={pendingConnectionCreate}
        onCreateText={createConnectedText}
        onCreateImage={chooseConnectedImage}
        onClose={() => setPendingConnectionCreate(null)}
      />}
      {keyboardConnection && <KeyboardConnectionMenu
        connection={keyboardConnection}
        nodes={nodes}
        onSelect={completeKeyboardConnection}
        onClose={closeKeyboardConnection}
      />}
      {ready && hiddenIds.length > 0 && <details className="infinite-image-canvas__hidden">
        <summary>已移出画布（{hiddenIds.length}）</summary>
        {hiddenIds.map(id => {
          const image = records.get(id);
          return image && <button type="button" key={id} disabled={nodes.length >= 500} title={nodes.length >= 500 ? "请先移出一张画布作品" : undefined} onClick={() => restore(id)}>加回：{image.prompt || "未命名作品"}</button>;
        })}
      </details>}
      <div className="canvas-zoom-dock" onPointerDown={event => event.stopPropagation()}>
        <button type="button" className="canvas-dock-button" onClick={fitCanvas} aria-label="适应全部节点" title="适应全部节点"><CanvasIcon name="fit" /></button>
        <input type="range" min="20" max="200" step="1" value={Math.round(zoom * 100)} onChange={event => changeZoom(Number(event.target.value) / 100)} aria-label="画布缩放" aria-valuetext={`${Math.round(zoom * 100)}%`} />
        <span>{Math.round(zoom * 100)}%</span>
      </div>
      <div className="canvas-tool-dock" role="toolbar" aria-label="画布工具栏" aria-controls="infinite-image-canvas">
        <div role="group" aria-label="画布选择">
          <button type="button" className={`canvas-dock-button${canvasTool === "pan" ? " is-active" : ""}`} onClick={() => setCanvasTool("pan")} aria-label="平移画布" aria-pressed={canvasTool === "pan"} title="平移画布"><CanvasIcon name="hand" /></button>
          <button type="button" className={`canvas-dock-button${canvasTool === "select" ? " is-active" : ""}`} onClick={() => setCanvasTool("select")} aria-label="选择节点" aria-pressed={canvasTool === "select"} title="选择节点"><CanvasIcon name="pointer" /></button>
        </div>
        <span className="canvas-tool-dock__divider" role="separator" aria-orientation="vertical" />
        <div role="group" aria-label="历史操作">
          <button type="button" className="canvas-dock-button" disabled aria-label="撤销" title="撤销"><CanvasIcon name="undo" /></button>
          <button type="button" className="canvas-dock-button" disabled aria-label="重做" title="重做"><CanvasIcon name="redo" /></button>
          <button type="button" className="canvas-dock-button" onClick={focusSelected} disabled={!selectedNodeId} aria-label="聚焦选中的节点" title="聚焦选中的节点"><CanvasIcon name="focus" /></button>
        </div>
        <span className="canvas-tool-dock__divider" role="separator" aria-orientation="vertical" />
        <div role="group" aria-label="创建与生成">
          <button type="button" className="canvas-dock-button" onClick={() => addTextNode()} disabled={nodes.length >= 500} aria-label="添加文本节点" title="添加文本节点"><CanvasIcon name="text" /></button>
          <button type="button" className="canvas-dock-button" onClick={() => addEmptyImageNode()} disabled={nodes.length >= 500} aria-label="添加图片节点" title="添加图片节点"><CanvasIcon name="image" /></button>
          <button type="button" className="canvas-dock-button" onClick={openPromptLibrary} disabled={!selectedNodeId || !onGenerate} aria-label="打开提示词库" title="打开提示词库"><CanvasIcon name="settings" /></button>
        </div>
        <span className="canvas-tool-dock__divider" role="separator" aria-orientation="vertical" />
        <div role="group" aria-label="画布视图">
          <button type="button" className="canvas-dock-button" onClick={fitCanvas} aria-label="适应视图" title="适应视图"><CanvasIcon name="fit" /></button>
          <button type="button" className="canvas-dock-button" disabled aria-label="导出画布" title="导出画布"><CanvasIcon name="export" /></button>
          <button type="button" className="canvas-dock-button" disabled aria-label="画布主题" title="画布主题"><CanvasIcon name="palette" /></button>
        </div>
        <span className="canvas-tool-dock__divider" role="separator" aria-orientation="vertical" />
        <div role="group" aria-label="删除">
          <button type="button" className="canvas-dock-button is-danger" onClick={removeSelected} disabled={!selectedNodeId} aria-label="将选中节点移出画布" title="移出选中节点"><CanvasIcon name="trash" /></button>
          <button type="button" className="canvas-dock-button" onClick={() => { setSelectedNodeId(null); setPromptNodeId(null); }} aria-label="清除选择" title="清除选择"><CanvasIcon name="eraser" /></button>
        </div>
      </div>
    </div>
  );
}
