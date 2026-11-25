"use client";

import { LoadingOutlined, SendOutlined } from "@ant-design/icons";
import { Button, Spin, theme } from "antd";
import { memo, useEffect, useId, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ds } from "@/lib/design-tokens";
import { useT } from "@/lib/use-t";
import { httpProblem, type HttpProblem } from "@/modules/notes/model";
import { activeMentionQuery, splitMentionTokens, type MentionRef } from "@/modules/notes/mentions";
import { usersDirectoryApi, type DirectoryUser } from "@/modules/users/directory";

const AVATAR_COLORS = ["#0075de", "#2a9d99", "#391c57", "#dd5b00", "#213183"];

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0]?.slice(0, 1) ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.slice(0, 1) ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

export function avatarColor(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash + char.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash] ?? AVATAR_COLORS[0];
}

export function PersonAvatar({ name, seed, size = 32 }: { name: string; seed?: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: ds.radius.full,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: avatarColor(seed || name),
        color: "#fff",
        fontSize: size <= 28 ? 11 : 12,
        fontWeight: 700,
        flex: "0 0 auto",
      }}
    >
      {initials(name)}
    </span>
  );
}

type CaretQuery = { node: Text; start: number; caret: number; query: string };
type Handlers = { input: () => void; keyDown: (event: KeyboardEvent) => void };

function isMention(node: Node | null): node is HTMLElement {
  return node instanceof HTMLElement && Boolean(node.dataset.mentionId);
}

function placeCaret(node: Node, offset: number) {
  const range = document.createRange();
  const max = node.nodeType === Node.TEXT_NODE ? (node.textContent?.length ?? 0) : (node as HTMLElement).childNodes.length;
  range.setStart(node, Math.max(0, Math.min(offset, max)));
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function createMentionSpan(user: MentionRef) {
  const span = document.createElement("span");
  span.dataset.mentionId = user.id;
  span.dataset.mentionName = user.displayName;
  span.contentEditable = "false";
  span.className = "crm-mention";
  span.textContent = `@${user.displayName}`;
  return span;
}

export function fillMentionEditor(root: HTMLElement, content: string, users: readonly MentionRef[]) {
  root.replaceChildren();
  for (const segment of splitMentionTokens(content, users)) {
    if (segment.kind === "mention") {
      root.appendChild(createMentionSpan(segment));
      continue;
    }
    const lines = segment.text.split("\n");
    lines.forEach((line, index) => {
      if (index > 0) root.appendChild(document.createElement("br"));
      if (line) root.appendChild(document.createTextNode(line));
    });
  }
}

export function readMentionEditor(root: HTMLElement): { content: string; mentions: MentionRef[] } {
  let content = "";
  const mentions: MentionRef[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      content += node.textContent ?? "";
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.dataset.mentionId && node.dataset.mentionName) {
      content += `@${node.dataset.mentionName}`;
      mentions.push({ id: node.dataset.mentionId, displayName: node.dataset.mentionName });
      return;
    }
    if (node.tagName === "BR") {
      content += "\n";
      return;
    }
    const block = node.tagName === "DIV" || node.tagName === "P";
    if (block && content && !content.endsWith("\n")) content += "\n";
    node.childNodes.forEach(walk);
  };
  root.childNodes.forEach(walk);
  return { content, mentions };
}

function queryFromSelection(root: HTMLElement): CaretQuery | null {
  const selection = window.getSelection();
  if (!selection?.isCollapsed || !selection.anchorNode || !root.contains(selection.anchorNode)) return null;
  if (selection.anchorNode.nodeType !== Node.TEXT_NODE) return null;
  const node = selection.anchorNode as Text;
  const before = (node.textContent ?? "").slice(0, selection.anchorOffset);
  const active = activeMentionQuery(before);
  if (!active) return null;
  return { node, start: active.start, caret: selection.anchorOffset, query: active.query };
}

function adjacentMention(direction: "before" | "after"): HTMLElement | null {
  const selection = window.getSelection();
  if (!selection?.isCollapsed || !selection.anchorNode) return null;
  const node = selection.anchorNode;
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    const atEdge = direction === "before" ? selection.anchorOffset === 0 : selection.anchorOffset === text.length;
    if (!atEdge) return null;
    let sibling = direction === "before" ? node.previousSibling : node.nextSibling;
    while (sibling && sibling.nodeType === Node.TEXT_NODE && !(sibling.textContent ?? "").length) {
      sibling = direction === "before" ? sibling.previousSibling : sibling.nextSibling;
    }
    return isMention(sibling) ? sibling : null;
  }
  if (node instanceof HTMLElement) {
    const child = node.childNodes[selection.anchorOffset + (direction === "before" ? -1 : 0)] ?? null;
    return isMention(child) ? child : null;
  }
  return null;
}

function removeMention(node: HTMLElement, side: "before" | "after") {
  const parent = node.parentNode;
  if (!parent) return;
  const anchor = side === "before" ? node.nextSibling : node.previousSibling;
  node.remove();
  if (anchor?.nodeType === Node.TEXT_NODE) {
    placeCaret(anchor, side === "before" ? 0 : (anchor.textContent?.length ?? 0));
    return;
  }
  const text = document.createTextNode("");
  parent.appendChild(text);
  placeCaret(text, 0);
}

function insertPlain(text: string) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  placeCaret(node, node.textContent?.length ?? 0);
}

function insertNewline() {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const breakLine = document.createElement("br");
  range.insertNode(breakLine);
  const tail = document.createTextNode("");
  breakLine.after(tail);
  placeCaret(tail, 0);
}

function insertMention(target: CaretQuery, user: MentionRef) {
  const text = target.node.textContent ?? "";
  const before = text.slice(0, target.start);
  const after = text.slice(target.caret);
  const parent = target.node.parentNode;
  if (!parent) return;
  const lead = document.createTextNode(before);
  const span = createMentionSpan(user);
  const needsSpace = after === "" || (!after.startsWith(" ") && !after.startsWith("\n"));
  const tail = document.createTextNode(needsSpace ? ` ${after}` : after);
  parent.insertBefore(lead, target.node);
  parent.insertBefore(span, target.node);
  parent.insertBefore(tail, target.node);
  target.node.remove();
  placeCaret(tail, needsSpace || after.startsWith(" ") ? 1 : 0);
}

function caretRect(editor: HTMLElement) {
  const box = editor.getBoundingClientRect();
  const selection = window.getSelection();
  if (!selection?.rangeCount || !selection.anchorNode || !editor.contains(selection.anchorNode)) return box;
  const range = selection.getRangeAt(0).cloneRange();
  range.collapse(true);
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  range.insertNode(marker);
  const rect = marker.getBoundingClientRect();
  marker.remove();
  const near = rect.height > 0 && rect.top >= box.top - 24 && rect.top <= box.bottom + 24;
  return near ? rect : box;
}

const MentionEditor = memo(function MentionEditor({
  editorRef,
  placeholder,
  label,
  handlersRef,
  onFocus,
  onBlur,
}: {
  editorRef: RefObject<HTMLDivElement | null>;
  placeholder: string;
  label: string;
  handlersRef: RefObject<Handlers>;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    const onInput = () => handlersRef.current?.input();
    const onKeyDown = (event: KeyboardEvent) => handlersRef.current?.keyDown(event);
    const onPaste = (event: ClipboardEvent) => {
      event.preventDefault();
      insertPlain(event.clipboardData?.getData("text/plain") ?? "");
      handlersRef.current?.input();
    };
    root.addEventListener("input", onInput);
    root.addEventListener("keydown", onKeyDown);
    root.addEventListener("paste", onPaste);
    return () => {
      root.removeEventListener("input", onInput);
      root.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("paste", onPaste);
    };
  }, [editorRef, handlersRef]);

  return (
    <div
      ref={editorRef}
      className="crm-mention-input is-empty"
      contentEditable
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      data-placeholder={placeholder}
      suppressContentEditableWarning
      onFocus={onFocus}
      onBlur={onBlur}
      style={{
        flex: "1 1 auto",
        minWidth: 0,
        minHeight: 22,
        maxHeight: 120,
        overflowY: "auto",
        outline: "none",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        fontSize: ds.fontSize.bodySm,
        lineHeight: "22px",
      }}
    />
  );
});

export function MentionComposer({
  canCompose,
  submitting,
  authorName,
  initialContent = "",
  initialMentions = [],
  onSubmit,
  onCancel,
  autoFocus = false,
  showAvatar = true,
  avatarSize = 32,
  purpose = "post",
  placeholder,
  frozen = false,
}: {
  canCompose: boolean;
  submitting: boolean;
  authorName: string;
  initialContent?: string;
  initialMentions?: readonly MentionRef[];
  onSubmit: (content: string, mentions: MentionRef[]) => Promise<void> | void;
  onCancel?: () => void;
  autoFocus?: boolean;
  showAvatar?: boolean;
  avatarSize?: number;
  /** post and reply keep the send icon inside the pill. edit uses Save / Cancel. */
  purpose?: "post" | "reply" | "edit";
  placeholder?: string;
  /** Another composer is submitting. Blocks input without a spinner. */
  frozen?: boolean;
}) {
  const t = useT();
  const { token } = theme.useToken();
  const listId = useId();
  const editorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const queryRef = useRef<CaretQuery | null>(null);
  const handlersRef = useRef<Handlers>({ input: () => undefined, keyDown: () => undefined });
  const seedRef = useRef({ content: initialContent, mentions: initialMentions });
  const [hasText, setHasText] = useState(initialContent.trim().length > 0);
  const [menuQuery, setMenuQuery] = useState<string | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [options, setOptions] = useState<DirectoryUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [problem, setProblem] = useState<HttpProblem | null>(null);
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const requestId = useRef(0);
  const active = options.length === 0 ? 0 : Math.min(index, options.length - 1);
  const fieldPlaceholder = placeholder ?? (purpose === "reply" ? t("order.discussionReplyPlaceholder") : t("order.discussionPlaceholder"));
  const editing = purpose === "edit";

  useEffect(() => {
    const root = editorRef.current;
    if (!root || !canCompose) return;
    fillMentionEditor(root, seedRef.current.content, seedRef.current.mentions);
    root.classList.toggle("is-empty", readMentionEditor(root).content.trim().length === 0);
  }, [canCompose]);

  useEffect(() => {
    if (autoFocus && canCompose) editorRef.current?.focus();
  }, [autoFocus, canCompose]);

  const sync = () => {
    const root = editorRef.current;
    if (!root) return;
    const { content } = readMentionEditor(root);
    setHasText(content.trim().length > 0);
    root.classList.toggle("is-empty", content.trim().length === 0);
    root.setAttribute("aria-controls", listId);
    const found = queryFromSelection(root);
    const nextRect = caretRect(root);
    queryRef.current = queryFromSelection(root) ?? found;
    root.setAttribute("aria-expanded", found ? "true" : "false");
    if (!found) {
      setMenuQuery(null);
      return;
    }
    setMenuQuery((current) => {
      if (current !== found.query) setIndex(0);
      return found.query;
    });
    setRect(nextRect);
  };

  const choose = (user: DirectoryUser) => {
    const root = editorRef.current;
    const stored = queryRef.current;
    const target = stored && stored.node.isConnected ? stored : root ? queryFromSelection(root) : null;
    if (!target || !root) return;
    insertMention(target, { id: user.id, displayName: user.displayName });
    setMenuQuery(null);
    root.focus();
    sync();
  };

  const submit = () => {
    const root = editorRef.current;
    if (!root || submitting || frozen || !canCompose) return;
    const read = readMentionEditor(root);
    if (!read.content.trim()) return;
    void onSubmit(read.content, read.mentions);
  };

  useEffect(() => {
    handlersRef.current = {
    input: sync,
    keyDown: (event) => {
      if (event.isComposing) return;
      const open = menuQuery !== null;
      if (open && event.key === "ArrowDown" && options.length > 0) {
        event.preventDefault();
        setIndex((current) => Math.min(options.length - 1, current + 1));
        return;
      }
      if (open && event.key === "ArrowUp" && options.length > 0) {
        event.preventDefault();
        setIndex((current) => Math.max(0, current - 1));
        return;
      }
      if (open && event.key === "Escape") {
        event.preventDefault();
        setMenuQuery(null);
        return;
      }
      if (!open && event.key === "Escape" && onCancel) {
        event.preventDefault();
        onCancel();
        return;
      }
      if (open && ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab")) {
        event.preventDefault();
        const user = options[active];
        if (user) choose(user);
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submit();
        return;
      }
      if (event.key === "Enter" && event.shiftKey) {
        event.preventDefault();
        insertNewline();
        sync();
        return;
      }
      if (event.key === "Backspace") {
        const mention = adjacentMention("before");
        if (!mention) return;
        event.preventDefault();
        removeMention(mention, "before");
        sync();
        return;
      }
      if (event.key === "Delete") {
        const mention = adjacentMention("after");
        if (!mention) return;
        event.preventDefault();
        removeMention(mention, "after");
        sync();
      }
    },
  };
  });

  useEffect(() => {
    if (menuQuery === null || !canCompose) return;
    const ticket = ++requestId.current;
    const handle = window.setTimeout(() => {
      setSearching(true);
      usersDirectoryApi
        .search(menuQuery.trim())
        .then((rows) => {
          if (ticket !== requestId.current) return;
          setOptions(rows);
          setProblem(null);
        })
        .catch((err: unknown) => {
          if (ticket !== requestId.current) return;
          setOptions([]);
          setProblem(httpProblem(err));
        })
        .finally(() => {
          if (ticket === requestId.current) setSearching(false);
        });
    }, 220);
    return () => window.clearTimeout(handle);
  }, [canCompose, menuQuery]);

  useEffect(() => {
    if (menuQuery === null) return;
    const reposition = () => {
      const root = editorRef.current;
      if (root) setRect(caretRect(root));
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [menuQuery]);

  useEffect(() => {
    menuRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, options]);

  useEffect(() => {
    const root = editorRef.current;
    if (root) root.contentEditable = submitting || frozen ? "false" : "true";
  }, [frozen, submitting]);

  const emptyLabel =
    problem === "forbidden"
      ? t("order.discussionMentionDenied")
      : problem === "missing"
        ? t("order.discussionDirectoryUnavailable")
        : problem === "error"
          ? t("order.discussionMentionFailed")
          : t("order.discussionMentionEmpty");

  const menu =
    canCompose && menuQuery !== null && rect
      ? createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label={t("order.discussionMention")}
            onMouseDown={(event) => event.preventDefault()}
            style={{
              position: "fixed",
              left: Math.max(8, Math.min(rect.left, window.innerWidth - 288)),
              top:
                rect.bottom + 8 + Math.min(240, 48 + Math.max(options.length, 1) * 52) > window.innerHeight
                  ? Math.max(8, rect.top - 8 - Math.min(240, 48 + Math.max(options.length, 1) * 52))
                  : rect.bottom + 6,
              width: Math.min(280, window.innerWidth - 16),
              maxHeight: 240,
              overflowY: "auto",
              zIndex: 80,
              background: token.colorBgElevated,
              borderRadius: ds.radius.lg,
              boxShadow: token.boxShadowSecondary,
              border: `1px solid ${token.colorBorderSecondary}`,
              padding: 4,
            }}
          >
            {searching && options.length === 0 ? (
              <div style={{ padding: 12, textAlign: "center" }}>
                <Spin size="small" />
              </div>
            ) : options.length === 0 ? (
              <div style={{ padding: "10px 12px", color: token.colorTextSecondary, fontSize: ds.fontSize.bodySm }}>
                {emptyLabel}
              </div>
            ) : (
              options.map((user, optionIndex) => {
                const selected = optionIndex === active;
                return (
                  <div
                    key={user.id}
                    role="option"
                    aria-selected={selected}
                    data-active={selected ? "true" : "false"}
                    onMouseEnter={() => setIndex(optionIndex)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      choose(user);
                    }}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      padding: "8px 10px",
                      borderRadius: ds.radius.md,
                      background: selected ? "rgba(0, 117, 222, 0.10)" : undefined,
                      cursor: "pointer",
                    }}
                  >
                    <PersonAvatar name={user.displayName || user.email} seed={user.id} size={28} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontWeight: 600, fontSize: ds.fontSize.bodySm }}>
                        {user.displayName || user.email}
                      </span>
                      {user.email ? (
                        <span style={{ display: "block", color: token.colorTextSecondary, fontSize: ds.fontSize.caption }}>
                          {user.email}
                        </span>
                      ) : null}
                    </span>
                  </div>
                );
              })
            )}
          </div>,
          document.body,
        )
      : null;

  const hintOffset = showAvatar ? avatarSize + 8 : 0;
  const pillFill = token.colorBgContainer === "#ffffff" ? "#f0f2f5" : token.colorFillSecondary;

  return (
    <div className="crm-composer">
      <style>{`
        .crm-mention { color: ${ds.primary}; font-weight: 700; }
        .crm-mention-input.is-empty:before {
          content: attr(data-placeholder);
          color: ${token.colorTextPlaceholder};
          pointer-events: none;
          float: left;
          height: 0;
        }
        .crm-send-btn {
          width: 32px;
          height: 32px;
          border: 0;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          background: transparent;
          color: ${token.colorTextQuaternary};
          cursor: default;
          padding: 0;
          font-size: 16px;
        }
        .crm-send-btn.is-ready {
          background: ${ds.primary};
          color: #fff;
          cursor: pointer;
        }
        .crm-send-btn.is-ready:hover { background: ${ds.primaryActive}; }
        .crm-send-btn:focus-visible {
          outline: 2px solid ${ds.focusRing};
          outline-offset: 2px;
        }
        .crm-composer-hint {
          margin-top: 4px;
          padding-left: 14px;
          color: ${token.colorTextSecondary};
          font-size: 12px;
          line-height: 16px;
        }
      `}</style>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {showAvatar ? <PersonAvatar name={authorName || "?"} seed={authorName} size={avatarSize} /> : null}
        <div
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 4,
            minHeight: 40,
            borderRadius: 20,
            background: focused ? token.colorBgContainer : pillFill,
            border: `1px solid ${focused ? ds.primary : "transparent"}`,
            boxShadow: focused ? `0 0 0 3px ${ds.focusRing}` : "none",
            padding: editing ? "6px 14px" : "4px 4px 4px 14px",
          }}
        >
          {canCompose ? (
            <MentionEditor
              editorRef={editorRef}
              placeholder={fieldPlaceholder}
              label={fieldPlaceholder}
              handlersRef={handlersRef}
                onFocus={() => {
                  setFocused(true);
                  window.requestAnimationFrame(() => {
                    window.requestAnimationFrame(() => {
                      editorRef.current?.closest(".crm-composer")?.scrollIntoView({ block: "nearest" });
                    });
                  });
                }}
              onBlur={() => setFocused(false)}
            />
          ) : (
            <div style={{ flex: 1, color: token.colorTextSecondary, fontSize: ds.fontSize.bodySm, lineHeight: "22px" }}>
              {t("order.discussionNeedUpdate")}
            </div>
          )}
          {canCompose && !editing ? (
            <button
              type="button"
                className={hasText && !submitting && !frozen ? "crm-send-btn is-ready" : "crm-send-btn"}
                aria-label={t("order.discussionSend")}
                disabled={!hasText || submitting || frozen}
              onMouseDown={(event) => event.preventDefault()}
              onClick={submit}
            >
              {submitting ? <LoadingOutlined /> : <SendOutlined />}
            </button>
          ) : null}
        </div>
      </div>
      {canCompose && focused ? (
        <div className="crm-composer-hint" style={{ marginLeft: hintOffset }}>
          {t("order.discussionHint")}
        </div>
      ) : null}
      {editing && canCompose ? (
        <div style={{ display: "flex", gap: 8, marginTop: 8, marginLeft: hintOffset, paddingLeft: 14 }}>
          <Button size="small" onClick={onCancel} disabled={submitting || frozen}>
            {t("common.cancel")}
          </Button>
          <Button size="small" type="primary" loading={submitting} disabled={!hasText || submitting || frozen} onClick={submit}>
            {t("common.save")}
          </Button>
        </div>
      ) : null}
      {menu}
    </div>
  );
}
