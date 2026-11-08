"use client";

import { Fragment, type ReactNode } from "react";

/**
 * 聊天消息的轻量 markdown 渲染。
 *
 * 后端返回的是「markdown + 自研富文本标签」的混合串，例如：
 *
 *   ## 标题
 *   **加粗** <Cite refs={["turn1"]} /> <badge color="success">关注</badge>
 *   | 列 | 列 |
 *   <row align=start gap={3}><AsyncImage query="..." /></row>
 *
 * 之前这些原样显示成文本。这里只做两件事：
 * 1. 把 markdown 的常见语法渲染成元素
 * 2. 把不认得的富文本标签**丢掉**（<Cite> 转成小角标数字，其余整体移除）
 *
 * 刻意不引第三方 markdown 库：这个格式是自研的，通用库也消化不了那些
 * 标签；而且以 React 元素输出，全程不碰 innerHTML，没有 XSS 面。
 */

// ── 富文本标签：先剥离，避免它们干扰 markdown 解析 ─────────────

/** <Cite refs={["a","b"]}/> 以及 <Link ref="x" title="y"/> 的占位标记 */
const CITE_RE = /<Cite\b[^>]*\/>/g;
const LINK_RE = /<Link\b([^>]*)\/>/g;

/** 只去标签、保留内部文字的容器（<row>/<box> 是排版，正文在里面） */
const WRAPPER_TAGS = ["row", "box", "text", "badge", "mark"];

/** 整体移除的标签：图片占位，没有可读正文 */
const DROP_TAGS = ["AsyncImage"];

type Fragment_ = { kind: "text" | "cite" | "link"; value: string; title?: string };

/**
 * 把原始串切成「普通文本 / 引用角标 / 链接」三类片段。
 * 容器标签只去壳，正文保留；图片占位整体丢弃。
 */
function splitRichTags(raw: string): Fragment_[] {
  let s = raw;

  // 容器标签：只去壳，内容原样留下
  for (const tag of WRAPPER_TAGS) {
    s = s.replace(new RegExp("<" + tag + "(\s[^>]*)?>", "g"), "");
    s = s.replace(new RegExp("</" + tag + ">", "g"), "");
  }

  // 图片占位：整体丢弃
  for (const tag of DROP_TAGS) {
    s = s.replace(new RegExp("<" + tag + "(\s[^>]*)?/>", "g"), "");
    s = s.replace(
      new RegExp("<" + tag + "(\s[^>]*)?>[\s\S]*?</" + tag + ">", "g"),
      "",
    );
  }

  // 兜底：其余残留的自研标签一律去掉，不让尖括号漏到用户眼前
  s = s.replace(/<\/?(?!Cite\b|Link\b)[a-zA-Z][^>]{0,240}>/g, "");

  const out: Fragment_[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  // <Cite .../> 按出现顺序编号
  let citeNo = 0;
  const marks: { at: number; len: number; frag: Fragment_ }[] = [];

  CITE_RE.lastIndex = 0;
  while ((m = CITE_RE.exec(s)) !== null) {
    citeNo += 1;
    marks.push({ at: m.index, len: m[0].length, frag: { kind: "cite", value: String(citeNo) } });
  }

  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(s)) !== null) {
    if (s.slice(Math.max(0, m.index - 8), m.index).includes("</")) continue;
    const attrs = m[1] || "";
    const title = /title\s*=\s*"([^"]*)"/.exec(attrs)?.[1] ?? "链接";
    marks.push({ at: m.index, len: m[0].length, frag: { kind: "link", value: title, title } });
  }

  marks.sort((a, b) => a.at - b.at);
  for (const mk of marks) {
    if (mk.at < last) continue;
    if (mk.at > last) out.push({ kind: "text", value: s.slice(last, mk.at) });
    out.push(mk.frag);
    last = mk.at + mk.len;
  }
  if (last < s.length) out.push({ kind: "text", value: s.slice(last) });
  if (out.length === 0) out.push({ kind: "text", value: "" });
  return out;
}

// ── 行内 markdown ────────────────────────────────────────────

const INLINE_RE =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(\[[^\]\n]+\]\([^)\s]+\))/g;

/** 渲染一行里的行内语法：代码、粗体、斜体、链接 */
function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  let i = 0;

  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));

    const tok = m[0];
    if (m[1]) {
      nodes.push(
        <code key={`${keyBase}-c${i}`} className="chat-md-code">
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (m[2]) {
      nodes.push(
        <strong key={`${keyBase}-b${i}`}>{tok.slice(2, -2)}</strong>,
      );
    } else if (m[3]) {
      nodes.push(<em key={`${keyBase}-i${i}`}>{tok.slice(1, -1)}</em>);
    } else if (m[4]) {
      const mm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok);
      if (mm) {
        nodes.push(
          <a
            key={`${keyBase}-a${i}`}
            href={mm[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="chat-md-link"
          >
            {mm[1]}
          </a>,
        );
      } else {
        nodes.push(tok);
      }
    }
    last = m.index + tok.length;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// ── 块级解析 ────────────────────────────────────────────────

type Block =
  | { type: "p"; text: string }
  | { type: "h"; level: number; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "code"; text: string }
  | { type: "hr" }
  | { type: "table"; head: string[]; rows: string[][] };

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

/** 表格分隔行，如 |---|---| */
function isTableDivider(line: string): boolean {
  return /^\s*\|?[\s:-]*-[\s|:-]*\|?\s*$/.test(line) && line.includes("-");
}

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 空行
    if (!line.trim()) {
      i += 1;
      continue;
    }

    // 代码块
    if (line.trimStart().startsWith("```")) {
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1; // 跳过结束围栏
      blocks.push({ type: "code", text: buf.join("\n") });
      continue;
    }

    // 分隔线
    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }

    // 标题
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push({ type: "h", level: h[1].length, text: h[2].trim() });
      i += 1;
      continue;
    }

    // 表格：当前行有 | 且下一行是分隔行
    if (line.includes("|") && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const head = splitTableRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      blocks.push({ type: "table", head, rows });
      continue;
    }

    // 引用
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      blocks.push({ type: "quote", text: buf.join("\n") });
      continue;
    }

    // 无序列表
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i += 1;
        // 续行：缩进且非新项
        while (
          i < lines.length &&
          lines[i].trim() &&
          !/^\s*[-*+]\s+/.test(lines[i]) &&
          /^\s{2,}/.test(lines[i])
        ) {
          items[items.length - 1] += " " + lines[i].trim();
          i += 1;
        }
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // 有序列表
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
        i += 1;
        while (
          i < lines.length &&
          lines[i].trim() &&
          !/^\s*\d+[.)]\s+/.test(lines[i]) &&
          /^\s{2,}/.test(lines[i])
        ) {
          items[items.length - 1] += " " + lines[i].trim();
          i += 1;
        }
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // 段落：读到空行或下一个块开始
    {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim()) {
        const l = lines[i];
        if (
          /^(#{1,6})\s+/.test(l) ||
          l.trimStart().startsWith("```") ||
          /^\s*[-*+]\s+/.test(l) ||
          /^\s*\d+[.)]\s+/.test(l) ||
          /^\s*>\s?/.test(l)
        ) {
          break;
        }
        buf.push(l);
        i += 1;
      }
      if (buf.length) blocks.push({ type: "p", text: buf.join("\n") });
    }
  }

  return blocks;
}

// ── 组装 ────────────────────────────────────────────────────

/** 把一段含富文本标签的文本渲染成节点（行内） */
function renderRichText(text: string, keyBase: string): ReactNode[] {
  const frags = splitRichTags(text);
  const nodes: ReactNode[] = [];
  frags.forEach((f, idx) => {
    if (f.kind === "cite") {
      nodes.push(
        <sup key={`${keyBase}-cite${idx}`} className="chat-md-cite">
          [{f.value}]
        </sup>,
      );
    } else if (f.kind === "link") {
      nodes.push(
        <span key={`${keyBase}-lk${idx}`} className="chat-md-reflink">
          {f.value}
        </span>,
      );
    } else if (f.value) {
      nodes.push(...renderInline(f.value, `${keyBase}-t${idx}`));
    }
  });
  return nodes;
}

/** 渲染一条聊天消息的内容 */
export default function ChatMarkdown({ content }: { content: string }) {
  if (!content) return null;

  // 纯用户消息没有富文本标签时也走同一条路径，表现一致
  const blocks = parseBlocks(content);

  return (
    <div className="chat-md whitespace-pre-wrap break-words">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "h": {
            const cls =
              b.level <= 2
                ? "chat-md-h1"
                : b.level === 3
                  ? "chat-md-h2"
                  : "chat-md-h3";
            return (
              <div key={i} className={cls}>
                {renderRichText(b.text, `h${i}`)}
              </div>
            );
          }
          case "ul":
            return (
              <ul key={i} className="chat-md-ul">
                {b.items.map((it, j) => (
                  <li key={j}>{renderRichText(it, `u${i}-${j}`)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="chat-md-ol">
                {b.items.map((it, j) => (
                  <li key={j}>{renderRichText(it, `o${i}-${j}`)}</li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote key={i} className="chat-md-quote">
                {renderRichText(b.text, `q${i}`)}
              </blockquote>
            );
          case "code":
            return (
              <pre key={i} className="chat-md-pre">
                <code>{b.text}</code>
              </pre>
            );
          case "hr":
            return <hr key={i} className="chat-md-hr" />;
          case "table":
            return (
              <div key={i} className="chat-md-table-wrap">
                <table className="chat-md-table">
                  <thead>
                    <tr>
                      {b.head.map((c, j) => (
                        <th key={j}>{renderRichText(c, `th${i}-${j}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, ri) => (
                      <tr key={ri}>
                        {r.map((c, ci) => (
                          <td key={ci}>{renderRichText(c, `td${i}-${ri}-${ci}`)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "p":
          default:
            return (
              <p key={i} className="chat-md-p">
                {renderRichText(b.text, `p${i}`)}
              </p>
            );
        }
      })}
    </div>
  );
}

export { Fragment };
