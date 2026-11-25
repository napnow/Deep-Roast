/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { parsePromptReferences, type CanvasPromptReference } from "./canvas-prompt";

type Props = {
  value: string;
  references: CanvasPromptReference[];
  onChange: (value: string) => void;
  onSubmit?: () => void;
  onMentionStateChange?: (open: boolean) => void;
  placeholder?: string;
  ariaLabel?: string;
};

export default function CanvasPromptChipInput({ value, references, onChange, onSubmit, onMentionStateChange, placeholder, ariaLabel = "节点提示词" }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef(value);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const tokens = useMemo(() => parsePromptReferences(value, references), [references, value]);
  const candidates = useMemo(() => {
    if (mentionQuery === null) return [];
    const query = mentionQuery.trim().toLowerCase();
    return references.filter(item => !query || `${item.label} ${item.title}`.toLowerCase().includes(query)).slice(0, 8);
  }, [mentionQuery, references]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || (document.activeElement === editor && value === lastEmitted.current)) return;
    editor.replaceChildren();
    for (const token of tokens) {
      if (token.type === "text") editor.append(document.createTextNode(token.value));
      else editor.append(createChip(token.reference));
    }
    lastEmitted.current = value;
  }, [tokens, value]);

  useEffect(() => { onMentionStateChange?.(mentionQuery !== null && candidates.length > 0); }, [candidates.length, mentionQuery, onMentionStateChange]);

  function emit(next: string) {
    lastEmitted.current = next;
    onChange(next);
  }

  function syncFromEditor() {
    const editor = editorRef.current;
    if (!editor) return;
    emit(serializeEditor(editor));
    const text = textBeforeCaret(editor);
    const match = /@([^\s@]*)$/.exec(text);
    setMentionQuery(match ? match[1] : null);
    setActiveIndex(0);
  }

  function selectMention(reference: CanvasPromptReference) {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (range) {
      const text = textBeforeCaret(editor);
      const match = /@([^\s@]*)$/.exec(text);
      if (match) {
        const start = Math.max(0, range.startOffset - match[0].length);
        if (range.startContainer.nodeType === Node.TEXT_NODE) {
          range.setStart(range.startContainer, start);
          range.deleteContents();
        }
      }
      const chip = createChip(reference);
      const space = document.createTextNode(" ");
      range.insertNode(space);
      range.insertNode(chip);
      range.setStartAfter(space);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    setMentionQuery(null);
    emit(serializeEditor(editor));
    editor.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (mentionQuery !== null && candidates.length) {
      if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex(index => (index + 1) % candidates.length); return; }
      if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex(index => (index - 1 + candidates.length) % candidates.length); return; }
      if (event.key === "Enter") { event.preventDefault(); selectMention(candidates[Math.min(activeIndex, candidates.length - 1)]); return; }
      if (event.key === "Escape") { event.preventDefault(); setMentionQuery(null); return; }
    }
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSubmit?.();
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      const selection = window.getSelection();
      if (selection?.rangeCount && selection.isCollapsed) {
        const target = adjacentChip(selection.getRangeAt(0), event.key === "Backspace");
        if (target) {
          event.preventDefault();
          target.remove();
          syncFromEditor();
        }
      }
    }
  }

  return <div className="canvas-prompt-chip-input">
    {!value.trim() && <span className="canvas-prompt-chip-input__placeholder">{placeholder}</span>}
    <div
      ref={editorRef}
      className="canvas-prompt-chip-input__editor"
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={ariaLabel}
      onInput={syncFromEditor}
      onPaste={event => {
        event.preventDefault();
        const plain = event.clipboardData.getData("text/plain");
        if (!plain) return;
        const selection = window.getSelection();
        if (!selection?.rangeCount) return;
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(plain);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        syncFromEditor();
      }}
      onKeyDown={handleKeyDown}
      onBlur={() => window.setTimeout(() => setMentionQuery(null), 120)}
    />
    {mentionQuery !== null && candidates.length > 0 && <div className="canvas-prompt-chip-input__menu" role="listbox" aria-label="引用候选">
      {candidates.map((candidate, index) => <button key={candidate.id} type="button" role="option" aria-selected={index === activeIndex} onMouseDown={event => { event.preventDefault(); selectMention(candidate); }}>
        {candidate.previewUrl ? <img src={candidate.previewUrl} alt="" aria-hidden /> : <span className="canvas-prompt-chip-input__icon">字</span>}
        <span><strong>{candidate.title}</strong><small>{candidate.kind === "image" ? "图片节点" : "文本节点"}</small></span>
      </button>)}
    </div>}
  </div>;
}

function createChip(reference: CanvasPromptReference) {
  const chip = document.createElement("span");
  chip.contentEditable = "false";
  chip.dataset.refLabel = reference.label;
  chip.className = "canvas-prompt-chip-input__chip";
  if (reference.previewUrl) {
    const image = document.createElement("img");
    image.src = reference.previewUrl;
    image.alt = reference.title;
    chip.append(image);
  }
  const label = document.createElement("span");
  label.textContent = reference.title.slice(0, 40);
  chip.title = reference.title;
  chip.append(label);
  return chip;
}

function serializeEditor(editor: HTMLElement) {
  let value = "";
  editor.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) value += node.textContent || "";
    else if (node instanceof HTMLElement && node.dataset.refLabel) value += `${node.dataset.refLabel} `;
    else if (node instanceof HTMLElement) value += serializeEditor(node);
  });
  return value.replace(/\uFEFF/g, "");
}

function textBeforeCaret(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return "";
  const range = selection.getRangeAt(0).cloneRange();
  range.setStart(editor, 0);
  return range.toString();
}

function adjacentChip(range: Range, previous: boolean) {
  const container = range.startContainer;
  const offset = range.startOffset;
  const sibling = container.nodeType === Node.TEXT_NODE
    ? (offset === (previous ? 0 : container.textContent?.length || 0) ? (previous ? container.previousSibling : container.nextSibling) : null)
    : container.childNodes[previous ? offset - 1 : offset];
  return sibling instanceof HTMLElement && Boolean(sibling.dataset.refLabel) ? sibling : null;
}
