"use client";

import { Typography } from "antd";

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

/** Đủ cho bài hướng dẫn: tiêu đề, đoạn, danh sách, ảnh. */
export function GuideMarkdown({ source }: { source: string }) {
  const blocks = source.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  return (
    <div style={{ maxWidth: 760 }}>
      {blocks.map((block, index) => {
        const image = block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (image) {
          return (
            <figure key={index} style={{ margin: "16px 0 20px" }}>
              <img
                src={image[2]}
                alt={image[1]}
                style={{
                  width: "100%",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              />
            </figure>
          );
        }
        if (block.startsWith("# ")) {
          return (
            <Typography.Title key={index} level={3} style={{ marginTop: 0 }}>
              {block.slice(2)}
            </Typography.Title>
          );
        }
        if (block.startsWith("## ")) {
          return (
            <Typography.Title key={index} level={5} style={{ marginTop: 8 }}>
              {block.slice(3)}
            </Typography.Title>
          );
        }
        const lines = block.split("\n");
        const list = lines.every((line) => /^(\d+\. |- )/.test(line));
        if (list) {
          const ordered = lines[0].match(/^\d+\. /);
          const items = lines.map((line) => line.replace(/^(\d+\. |- )/, ""));
          const Tag = ordered ? "ol" : "ul";
          return (
            <Tag key={index} style={{ marginTop: 0, paddingLeft: 20 }}>
              {items.map((item) => (
                <li key={item} style={{ marginBottom: 4 }}>
                  {inline(item)}
                </li>
              ))}
            </Tag>
          );
        }
        return (
          <Typography.Paragraph key={index} style={{ marginBottom: 12 }}>
            {inline(block.replace(/\n/g, " "))}
          </Typography.Paragraph>
        );
      })}
    </div>
  );
}
