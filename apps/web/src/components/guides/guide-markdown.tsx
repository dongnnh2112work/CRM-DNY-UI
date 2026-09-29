"use client";

import { theme } from "antd";
import type { ReactNode } from "react";

type CalloutKind = "tip" | "warn" | "note";

type MapNode = { label: string; children: MapNode[] };

type Block =
  | { type: "h"; level: 1 | 2 | 3; text: string; id: string }
  | { type: "p"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "figure"; alt: string; src: string; caption?: string }
  | { type: "callout"; kind: CalloutKind; text: string }
  | { type: "flow"; rows: string[][] }
  | { type: "map"; nodes: MapNode[] };

function headingId(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

function parseMap(raw: string): MapNode[] {
  const roots: MapNode[] = [];
  const stack: { level: number; node: MapNode }[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const spaces = line.match(/^ */)?.[0].length ?? 0;
    const level = Math.floor(spaces / 2);
    const node: MapNode = { label: line.trim(), children: [] };
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    if (!stack.length) roots.push(node);
    else stack[stack.length - 1].node.children.push(node);
    stack.push({ level, node });
  }
  return roots;
}

function parse(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  const skipBlank = () => {
    while (i < lines.length && !lines[i].trim()) i += 1;
  };

  while (i < lines.length) {
    if (!lines[i].trim()) {
      i += 1;
      continue;
    }
    const line = lines[i];

    if (line.startsWith("```flow") || line.startsWith("```map")) {
      const kind = line.startsWith("```map") ? "map" : "flow";
      i += 1;
      const body: string[] = [];
      while (i < lines.length && lines[i].trim() !== "```") {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      if (kind === "map") blocks.push({ type: "map", nodes: parseMap(body.join("\n")) });
      else {
        blocks.push({
          type: "flow",
          rows: body
            .map((row) => row.split("→").map((step) => step.trim()).filter(Boolean))
            .filter((row) => row.length > 0),
        });
      }
      continue;
    }

    if (line.startsWith(":::")) {
      const kind = (line.slice(3).trim() || "note") as CalloutKind;
      i += 1;
      const body: string[] = [];
      while (i < lines.length && lines[i].trim() !== ":::") {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      const safe: CalloutKind = kind === "tip" || kind === "warn" ? kind : "note";
      blocks.push({ type: "callout", kind: safe, text: body.join("\n").trim() });
      continue;
    }

    if (line.startsWith("### ")) {
      const text = line.slice(4).trim();
      blocks.push({ type: "h", level: 3, text, id: headingId(text) });
      i += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      const text = line.slice(3).trim();
      blocks.push({ type: "h", level: 2, text, id: headingId(text) });
      i += 1;
      continue;
    }
    if (line.startsWith("# ")) {
      const text = line.slice(2).trim();
      blocks.push({ type: "h", level: 1, text, id: headingId(text) });
      i += 1;
      continue;
    }

    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (image) {
      i += 1;
      skipBlank();
      let caption: string | undefined;
      if (i < lines.length && /^Hình\s+\d/.test(lines[i].trim())) {
        caption = lines[i].trim();
        i += 1;
      }
      blocks.push({ type: "figure", alt: image[1], src: image[2], caption });
      continue;
    }

    if (/^(?:- |\d+\. )/.test(line)) {
      const ordered = /^\d+\. /.test(line);
      const items: string[] = [];
      while (i < lines.length && /^(?:- |\d+\. )/.test(lines[i])) {
        items.push(lines[i].replace(/^(?:- |\d+\. )/, ""));
        i += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("```") &&
      !lines[i].startsWith(":::") &&
      !lines[i].startsWith("![") &&
      !/^(?:- |\d+\. )/.test(lines[i])
    ) {
      para.push(lines[i].trim());
      i += 1;
    }
    const text = para.join(" ");
    if (/^Hình\s+\d/.test(text)) blocks.push({ type: "figure", alt: "", src: "", caption: text });
    else if (text) blocks.push({ type: "p", text });
  }

  return blocks;
}

function inline(text: string, keyPrefix: string): ReactNode[] {
  const re = /(\*\*[^*]+\*\*|==[^=]+==)/g;
  const out: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let n = 0;
  while ((match = re.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      out.push(<strong key={`${keyPrefix}-b-${n}`}>{token.slice(2, -2)}</strong>);
    } else {
      out.push(
        <mark key={`${keyPrefix}-m-${n}`} className="guide-mark">
          {token.slice(2, -2)}
        </mark>,
      );
    }
    last = match.index + token.length;
    n += 1;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Flow({ rows }: { rows: string[][] }) {
  const { token } = theme.useToken();
  return (
    <div className="guide-diagram">
      {rows.map((row, rowIndex) => (
        <div key={row.join("-")} className="guide-flow">
          {row.map((step, stepIndex) => (
            <span key={`${rowIndex}-${step}`} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              {stepIndex > 0 ? <span style={{ color: token.colorPrimary, fontWeight: 700 }}>→</span> : null}
              <span
                style={{
                  background: stepIndex === row.length - 1 ? "rgba(0,117,222,0.12)" : token.colorFillSecondary,
                  color: token.colorText,
                  border: `1px solid ${stepIndex === row.length - 1 ? token.colorPrimary : token.colorBorder}`,
                  borderRadius: 999,
                  padding: "4px 12px",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {step}
              </span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

const MAP_COLORS = ["#0075de", "#2a9d99", "#7c5cbf", "#dd5b00"];

function MapBranch({ nodes, depth }: { nodes: MapNode[]; depth: number }) {
  const { token } = theme.useToken();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {nodes.map((node) => (
        <div key={node.label} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span
            style={{
              background: depth === 0 ? MAP_COLORS[0] : token.colorBgContainer,
              color: depth === 0 ? "#fff" : token.colorText,
              border: `1px solid ${MAP_COLORS[Math.min(depth, MAP_COLORS.length - 1)]}`,
              borderRadius: 999,
              padding: "4px 12px",
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {node.label}
          </span>
          {node.children.length ? (
            <div
              style={{
                borderLeft: `2px solid ${MAP_COLORS[Math.min(depth + 1, MAP_COLORS.length - 1)]}`,
                paddingLeft: 10,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <MapBranch nodes={node.children} depth={depth + 1} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function Callout({ kind, text }: { kind: CalloutKind; text: string }) {
  const { token } = theme.useToken();
  const meta =
    kind === "tip"
      ? { label: "Gợi ý", color: token.colorSuccess, bg: token.colorSuccessBg }
      : kind === "warn"
        ? { label: "Chú ý", color: token.colorWarning, bg: token.colorWarningBg }
        : { label: "Ghi chú", color: token.colorPrimary, bg: token.colorPrimaryBg };
  return (
    <div
      style={{
        borderLeft: `4px solid ${meta.color}`,
        background: meta.bg,
        borderRadius: 8,
        padding: "10px 12px",
        margin: "12px 0",
      }}
    >
      <div style={{ color: meta.color, fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{meta.label}</div>
      {text.split("\n").map((row) => (
        <div key={row} style={{ fontSize: 14 }}>
          {inline(row, row)}
        </div>
      ))}
    </div>
  );
}

function Figure({ block }: { block: Extract<Block, { type: "figure" }> }) {
  const { token } = theme.useToken();
  const caption = block.caption?.match(/^(Hình\s+[\d.]+)\.?\s*(.*)$/);
  return (
    <figure style={{ margin: "12px 0 20px", minWidth: 0 }}>
      {block.src ? (
        <img
          src={block.src}
          alt={block.alt}
          style={{
            width: "100%",
            maxWidth: "100%",
            height: "auto",
            display: "block",
            borderRadius: 12,
            border: `1px solid ${token.colorBorder}`,
          }}
        />
      ) : null}
      {block.caption ? (
        <figcaption style={{ marginTop: 8, textAlign: "center", fontSize: 13, color: token.colorTextSecondary }}>
          {caption ? (
            <>
              <span style={{ color: token.colorPrimary, fontWeight: 700 }}>{caption[1]}.</span>
              {caption[2] ? ` ${caption[2]}` : ""}
            </>
          ) : (
            block.caption
          )}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function GuideMarkdown({ source }: { source: string }) {
  const { token } = theme.useToken();
  const blocks = parse(source);
  const outline = blocks.filter((block): block is Extract<Block, { type: "h" }> => block.type === "h" && block.level > 1);

  return (
    <article className="guide-article">
      {blocks.map((block, index) => {
        if (block.type === "h" && block.level === 1) {
          return (
            <h1 key={block.id} id={block.id} style={{ margin: "0 0 12px", fontSize: 24, lineHeight: 1.3 }}>
              {block.text}
            </h1>
          );
        }
        return null;
      })}
      {outline.length ? (
        <nav
          aria-label="Mục lục bài"
          style={{
            background: token.colorFillQuaternary,
            border: `1px solid ${token.colorBorder}`,
            borderRadius: 12,
            padding: "10px 14px",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: token.colorTextSecondary, marginBottom: 6 }}>Nội dung</div>
          {outline.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              style={{
                display: "block",
                paddingLeft: item.level === 3 ? 16 : 0,
                fontSize: 14,
                lineHeight: 1.7,
                color: token.colorPrimary,
              }}
            >
              {item.text}
            </a>
          ))}
        </nav>
      ) : null}
      {blocks.map((block, index) => {
        if (block.type === "h" && block.level === 1) return null;
        if (block.type === "h") {
          const Tag = block.level === 2 ? "h2" : "h3";
          return (
            <Tag
              key={block.id}
              id={block.id}
              style={{
                margin: block.level === 2 ? "22px 0 8px" : "14px 0 6px",
                fontSize: block.level === 2 ? 18 : 15,
                lineHeight: 1.35,
                borderLeft: block.level === 2 ? `3px solid ${token.colorPrimary}` : undefined,
                paddingLeft: block.level === 2 ? 8 : 0,
              }}
            >
              {block.text}
            </Tag>
          );
        }
        if (block.type === "figure") return <Figure key={`fig-${index}`} block={block} />;
        if (block.type === "callout") return <Callout key={`call-${index}`} kind={block.kind} text={block.text} />;
        if (block.type === "flow") return <Flow key={`flow-${index}`} rows={block.rows} />;
        if (block.type === "map") {
          return (
            <div key={`map-${index}`} className="guide-diagram" style={{ margin: "12px 0 16px" }}>
              <MapBranch nodes={block.nodes} depth={0} />
            </div>
          );
        }
        if (block.type === "list") {
          const Tag = block.ordered ? "ol" : "ul";
          return (
            <Tag key={`list-${index}`} style={{ marginTop: 0, paddingLeft: 22 }}>
              {block.items.map((item, itemIndex) => (
                <li key={`${itemIndex}-${item}`} style={{ marginBottom: 4 }}>
                  {inline(item, `li-${index}-${itemIndex}`)}
                </li>
              ))}
            </Tag>
          );
        }
        return (
          <p key={`p-${index}`} style={{ margin: "0 0 10px" }}>
            {inline(block.text, `p-${index}`)}
          </p>
        );
      })}
    </article>
  );
}
