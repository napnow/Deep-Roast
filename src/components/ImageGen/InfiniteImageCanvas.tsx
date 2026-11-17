"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyNodeChanges, Background, Controls, Handle, Position, ReactFlow, useNodesState, type Node, type NodeProps, type Viewport } from "@xyflow/react";
import { ApiError, apiJson, jsonBody } from "@/lib/client-api";
import type { CanvasLayout } from "@/lib/canvas-layout";
import { clearLocalCanvasDraft, loadLocalCanvasDraft, sameCanvasContent, saveLocalCanvasDraft } from "@/lib/canvas-draft";
import type { ImageRecord } from "@/types";
import { canvasEdges, mergeCanvasItems } from "./canvas-items";

type ImageNodeData = {
  image: ImageRecord;
  onPreview: (image: ImageRecord) => void;
  onEdit: (image: ImageRecord) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
};
type ImageNode = Node<ImageNodeData, "image">;
type CanvasResponse = { layout: CanvasLayout | null; images: ImageRecord[] };
type SaveStatus = "loading" | "saved" | "saving" | "unsaved" | "error" | "conflict";
const initialViewport = { x: 30, y: 52, zoom: 1 };

const ImageCanvasNode = memo(function ImageCanvasNode({ id, data, selected }: NodeProps<ImageNode>) {
  const { image } = data;
  const move = (x: number, y: number) => data.onMove(id, x, y);
  return (
    <article className={`infinite-image-node${selected ? " is-selected" : ""}`}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <div className="infinite-image-node__handle">⠿ <span>拖动画面</span>
        <div className="infinite-image-node__moves nodrag" aria-label="移动作品">
          {[["上", 0, -30], ["左", -30, 0], ["下", 0, 30], ["右", 30, 0]].map(([label, x, y]) => <button key={label} type="button" aria-label={`向${label}移动作品`} onClick={event => { event.stopPropagation(); move(Number(x), Number(y)); }}>{label}</button>)}
        </div>
      </div>
      <button type="button" className="infinite-image-node__preview nodrag" onClick={event => { event.stopPropagation(); data.onPreview(image); }} aria-label={`查看大图：${image.prompt}`}>
        {image.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.thumbUrl} alt={image.prompt} loading="lazy" draggable={false} />
        ) : <span>点击查看原图</span>}
      </button>
      <div className="infinite-image-node__footer">
        <span title={image.prompt}>{image.prompt || "未命名作品"}</span>
        <button type="button" className="nodrag" onClick={event => { event.stopPropagation(); data.onEdit(image); }}>继续修改</button>
        <button type="button" className="nodrag" aria-label={`移出画布：${image.prompt || "未命名作品"}`} onClick={event => { event.stopPropagation(); data.onRemove(id); }}>移出</button>
      </div>
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </article>
  );
});
const nodeTypes = { image: ImageCanvasNode };

export default function InfiniteImageCanvas({ accountId, images, onSelect, onPreview, onEdit }: {
  accountId: string;
  images: ImageRecord[];
  onSelect: (image: ImageRecord) => void;
  onPreview: (image: ImageRecord) => void;
  onEdit: (image: ImageRecord) => void;
}) {
  const handlers = useRef({ onPreview, onEdit });
  useEffect(() => { handlers.current = { onPreview, onEdit }; }, [onPreview, onEdit]);
  const preview = useCallback((image: ImageRecord) => handlers.current.onPreview(image), []);
  const edit = useCallback((image: ImageRecord) => handlers.current.onEdit(image), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<ImageNode>([]);
  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  const imagesRef = useRef(images);
  useEffect(() => { imagesRef.current = images; }, [images]);
  const [remoteImages, setRemoteImages] = useState<ImageRecord[]>([]);
  const remoteImagesRef = useRef(remoteImages);
  useEffect(() => { remoteImagesRef.current = remoteImages; }, [remoteImages]);
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
    nodes: nodesRef.current.map(node => ({ id: node.id, x: node.position.x, y: node.position.y })),
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
  const moveNode = useCallback((id: string, x: number, y: number) => {
    nodesRef.current = nodesRef.current.map(node => node.id === id ? { ...node, position: { x: node.position.x + x, y: node.position.y + y } } : node);
    setNodes(nodesRef.current);
    changed();
  }, [changed, setNodes]);
  const remove = useCallback((id: string) => {
    if (!hiddenRef.current.includes(id)) updateHidden([...hiddenRef.current, id]);
    nodesRef.current = nodesRef.current.filter(node => node.id !== id);
    setNodes(nodesRef.current);
    changed();
  }, [changed, setNodes, updateHidden]);
  const records = useMemo(() => new Map(remoteImages.filter(image => !deletedIds.has(image.id)).map(image => [image.id, image])), [deletedIds, remoteImages]);
  useEffect(() => {
    const onDeleted = (event: Event) => {
      const id = (event as CustomEvent<unknown>).detail;
      if (typeof id !== "string") return;
      setDeletedIds(previous => new Set(previous).add(id));
      updateHidden(hiddenRef.current.filter(hidden => hidden !== id));
      nodesRef.current = nodesRef.current.filter(node => node.id !== id);
      setNodes(nodesRef.current);
      changed();
    };
    window.addEventListener("deeproast:image-deleted", onDeleted);
    return () => window.removeEventListener("deeproast:image-deleted", onDeleted);
  }, [changed, setNodes, updateHidden]);
  const makeNodes = useCallback((positions: { id: string; x: number; y: number }[], recordsMap: Map<string, ImageRecord>) => positions.flatMap(({ id, x, y }) => {
    const image = recordsMap.get(id);
    return image ? [{ id, type: "image" as const, position: { x, y }, dragHandle: ".infinite-image-node__handle", data: { image, onPreview: preview, onEdit: edit, onRemove: remove, onMove: moveNode } }] : [];
  }), [edit, moveNode, preview, remove]);

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
    const savedPositions = (source?.nodes ?? []).filter(node => all.has(node.id));
    const candidates = [...new Set([...savedPositions.map(node => node.id), ...all.keys()])].filter(id => !hidden.includes(id)).slice(0, 500);
    const positions = mergeCanvasItems(savedPositions, candidates);
    const next = makeNodes(positions, all);
    nodesRef.current = next;
    setNodes(next);
    setRemoteImages([...all.values()]);
    viewportRef.current = source?.viewport ?? initialViewport;
    setViewport(viewportRef.current);
    setViewportKey(key => key + 1);
    savedRef.current = 0;
    const hasNew = positions.some(position => !source?.nodes.some(node => node.id === position.id));
    const hasChanges = Boolean(draft) || hasNew;
    dirtyRef.current = hasChanges ? 1 : 0;
    const conflict = Boolean(draft && draft.revision !== cloudRevision);
    setReady(true);
    setStatus(conflict ? "conflict" : hasChanges ? "unsaved" : "saved");
    if (hasChanges && !conflict) schedule();
  }, [accountId, deletedIds, makeNodes, schedule, setNodes, updateHidden]);
  const applyRef = useRef(applyRemote);
  useEffect(() => { applyRef.current = applyRemote; }, [applyRemote]);

  const load = useCallback(async () => {
    const epoch = ++loadEpoch.current;
    setReady(false);
    setStatus("loading");
    try {
      const draft = loadLocalCanvasDraft(accountId);
      const data = await apiJson<CanvasResponse>("/api/image-canvas", { cache: "no-store" });
      const ids = [...data.images.map(image => image.id), ...imagesRef.current.map(image => image.id), ...(draft?.nodes.map(node => node.id) ?? []), ...(draft?.hiddenIds ?? [])];
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
      const ids = [...new Set([...imagesRef.current.map(image => image.id), ...remoteImagesRef.current.map(image => image.id), ...nodesRef.current.map(node => node.id), ...hiddenRef.current])];
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
    const ids = [...new Set([...previous.map(node => node.id), ...records.keys()])].filter(id => records.has(id) && !hiddenRef.current.includes(id)).slice(0, 500);
    const positions = mergeCanvasItems(previous.map(node => ({ id: node.id, x: node.position.x, y: node.position.y })), ids);
    const next = makeNodes(positions, records);
    nodesRef.current = next;
    setNodes(next);
    if (next.some(node => !previous.some(old => old.id === node.id))) changed();
  }, [changed, hiddenIds, makeNodes, ready, records, setNodes]);

  const restore = useCallback((id: string) => {
    const image = records.get(id);
    if (!image || nodesRef.current.length >= 500) return;
    updateHidden(hiddenRef.current.filter(hidden => hidden !== id));
    setNodes(previous => {
      const positions = mergeCanvasItems(previous.map(node => ({ id: node.id, x: node.position.x, y: node.position.y })), [...previous.map(node => node.id), id]);
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
  const overflow = Math.max(0, availableCount - nodes.length);
  const selectNode = useCallback((_event: React.MouseEvent, node: ImageNode) => onSelect(node.data.image), [onSelect]);
  const edges = useMemo(() => canvasEdges(nodes.map(node => node.data.image)), [nodes]);
  const moved = useCallback((_event: unknown, next: Viewport) => {
    const previous = viewportRef.current;
    viewportRef.current = next;
    if (ready && (previous.x !== next.x || previous.y !== next.y || previous.zoom !== next.zoom)) changed();
  }, [changed, ready]);

  return (
    <div className="infinite-image-canvas" aria-label="作品画布">
      {ready && nodes.length > 0 && <ReactFlow key={viewportKey} nodes={nodes} edges={edges} onNodesChange={changeNodes} onNodeDragStop={changed} onMoveEnd={moved} onNodeClick={selectNode} nodeTypes={nodeTypes} defaultViewport={viewport} minZoom={0.2} maxZoom={2} onlyRenderVisibleElements nodesConnectable={false} deleteKeyCode={null} proOptions={{ hideAttribution: false }}>
        <Background gap={24} size={1} color="#ded4ca" />
        <Controls showInteractive={false} />
      </ReactFlow>}
      {ready && nodes.length === 0 && <div className="infinite-image-empty">画布暂无作品，生成图片后会出现在这里</div>}
      <div className="infinite-image-canvas__status" role="status" aria-live="polite">
        {status === "loading" ? "正在加载画布…" : status === "saving" ? "正在保存画布…" : status === "unsaved" ? "画布有未保存的更改" : status === "saved" ? "画布已同步" : status === "conflict" ? "其他设备更新了画布，本机改动尚未保存。" : "画布同步失败，本机改动尚未保存。"}
        {status === "error" && <button type="button" onClick={() => { if (!ready) void load(); else { setStatus("unsaved"); schedule(); } }}>重试</button>}
        {status === "conflict" && <><button type="button" onClick={() => { void keepLocal(); }}>保留本机布局并覆盖云端</button><button type="button" onClick={discardLocal}>放弃本机更改并加载其他设备画布</button></>}
        {ready && overflow > 0 && <span>画布最多显示 500 张，还有 {overflow} 张作品可在作品库查看；移出画布中的作品后可显示更多。</span>}
      </div>
      {ready && hiddenIds.length > 0 && <details className="infinite-image-canvas__hidden">
        <summary>已移出画布（{hiddenIds.length}）</summary>
        {hiddenIds.map(id => {
          const image = records.get(id);
          return image && <button type="button" key={id} disabled={nodes.length >= 500} title={nodes.length >= 500 ? "请先移出一张画布作品" : undefined} onClick={() => restore(id)}>加回：{image.prompt || "未命名作品"}</button>;
        })}
      </details>}
      <div className="infinite-image-canvas__hint">拖动空白处移动画布 · 滚轮缩放 · 拖动卡片顶部移动作品</div>
    </div>
  );
}
