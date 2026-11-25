"use client";

import { App, Alert, Button, Empty, Popconfirm, Spin, theme } from "antd";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { MentionComposer, PersonAvatar } from "@/components/orders/mention-composer";
import { ds } from "@/lib/design-tokens";
import { formatDisplayDateTime } from "@/lib/format-date";
import { ApiError } from "@/lib/http/errors";
import { apiErrorMessage, isUuid } from "@/lib/http/message";
import { useNotifications } from "@/lib/notifications-store";
import { useSession } from "@/lib/session/session-provider";
import { useT } from "@/lib/use-t";
import { notesApi } from "@/modules/notes/api";
import { mentionIdsInText, relativeAge, splitMentionTokens, type MentionRef } from "@/modules/notes/mentions";
import {
  buildOrderNotePayload,
  buildOrderNoteUpdate,
  httpProblem,
  noteWasEdited,
  sortNotesNewestFirst,
  type ApiNote,
  type HttpProblem,
} from "@/modules/notes/model";
import { noteMentions, threadNotes, type NoteThread } from "@/modules/notes/threads";

const ROOT_AVATAR = 32;
const REPLY_AVATAR = 24;

function displayPerson(name: string, id: string) {
  const trimmed = name.trim();
  if (!trimmed || trimmed === id || isUuid(trimmed)) return "";
  return trimmed;
}

function withSelectedNames(note: ApiNote, selected: readonly MentionRef[]): ApiNote {
  const serverNames = note.mentionedUserNames.some((name) => name.trim() && !isUuid(name.trim()));
  if (serverNames) return note;
  const byId = new Map(selected.map((user) => [user.id, user.displayName]));
  return {
    ...note,
    mentionedUserNames: note.mentionedUserIds.map((id) => byId.get(id) ?? ""),
  };
}

function writeFailure(err: unknown, denied: string, missing: string, fallback: string) {
  const problem = httpProblem(err);
  if (problem === "forbidden") return denied;
  if (problem === "missing") return missing;
  if (err instanceof ApiError || err instanceof Error) return apiErrorMessage(err, fallback);
  return fallback;
}

function CommentText({ content, mentions }: { content: string; mentions: readonly MentionRef[] }) {
  const segments = splitMentionTokens(content, mentions);
  return (
    <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {segments.map((segment, index) =>
        segment.kind === "mention" ? (
          <span key={`${segment.id}-${index}`} className="crm-mention">
            @{segment.displayName}
          </span>
        ) : (
          <span key={`text-${index}`}>{segment.text}</span>
        ),
      )}
    </span>
  );
}

function BranchRow({
  last,
  line,
  curve = 14,
  children,
}: {
  last: boolean;
  line: string;
  curve?: number;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "stretch" }}>
      <div aria-hidden style={{ width: ROOT_AVATAR, flex: "0 0 32px", display: "flex", justifyContent: "center" }}>
        <div style={{ position: "relative", width: 2, background: last ? "transparent" : line }}>
          <span
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 22,
              height: curve,
              borderLeft: `2px solid ${line}`,
              borderBottom: `2px solid ${line}`,
              borderBottomLeftRadius: 10,
              pointerEvents: "none",
            }}
          />
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, padding: last ? "2px 0 0 6px" : "2px 0 8px 6px" }}>{children}</div>
    </div>
  );
}

type ReplyDraft = { rootId: string; noteId: string; mention: MentionRef | null };
type PostTarget = "dock" | "reply";

export function OrderDiscussion({ orderId, canCompose }: { orderId: string; canCompose: boolean }) {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { user } = useSession();
  const { refreshInbox } = useNotifications();
  const currentUserId = user?.id ?? null;
  const authorName = user?.displayName || user?.email || "";
  const [notes, setNotes] = useState<ApiNote[]>([]);
  const [problem, setProblem] = useState<HttpProblem | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${orderId}:${reloadToken}`;
  const loading = loadedKey !== requestKey;
  const [composerKey, setComposerKey] = useState(0);
  const [posting, setPosting] = useState<PostTarget | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reply, setReply] = useState<ReplyDraft | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const pendingScrollId = useRef<string | null>(null);
  const replyAnchorRef = useRef<HTMLDivElement>(null);
  const postingRef = useRef(false);

  const light = token.colorBgContainer === "#ffffff";
  const bubbleBg = light ? "#f0f2f5" : token.colorFillSecondary;
  const line = light ? "#cfd3d8" : token.colorBorder;

  useEffect(() => {
    const key = `${orderId}:${reloadToken}`;
    let cancelled = false;
    notesApi
      .listForOrder(orderId)
      .then((rows) => {
        if (cancelled) return;
        setNotes(rows);
        setProblem(null);
        setLoadedKey(key);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setNotes([]);
        setProblem(httpProblem(err));
        setLoadedKey(key);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, reloadToken]);

  useLayoutEffect(() => {
    const node = listRef.current;
    if (!node || loading) return;
    const pending = pendingScrollId.current;
    if (pending) {
      pendingScrollId.current = null;
      const target = node.querySelector<HTMLElement>(`[data-note-id="${CSS.escape(pending)}"]`);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
      return;
    }
    if (!stickRef.current) return;
    const previous = node.style.scrollBehavior;
    node.style.scrollBehavior = "auto";
    node.scrollTop = node.scrollHeight;
    node.style.scrollBehavior = previous;
  }, [loading, notes]);

  useEffect(() => {
    if (!reply) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scroll = () => replyAnchorRef.current?.scrollIntoView({ block: "end", behavior: reduce ? "auto" : "smooth" });
    scroll();
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(scroll);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [reply]);

  const timeLabel = (iso: string) => {
    const age = relativeAge(iso);
    if (age.unit === "justNow") return t("time.justNow");
    if (age.unit === "minutes") return t("time.minutesAgo", { n: age.n });
    if (age.unit === "hours") return t("time.hoursAgo", { n: age.n });
    if (age.unit === "days") return t("time.daysAgo", { n: age.n });
    return formatDisplayDateTime(iso);
  };

  const publish = async (content: string, mentions: MentionRef[], source: PostTarget) => {
    if (postingRef.current) return;
    const payload = buildOrderNotePayload({
      orderId,
      content,
      mentionedUserIds: mentionIdsInText(content, mentions),
    });
    if (!payload.content) {
      message.warning(t("order.discussionContentRequired"));
      return;
    }
    postingRef.current = true;
    setPosting(source);
    try {
      const created = withSelectedNames(await notesApi.create(payload), mentions);
      pendingScrollId.current = created.id;
      setNotes((prev) => sortNotesNewestFirst([created, ...prev.filter((item) => item.id !== created.id)]));
      setProblem(null);
      setReply(null);
      setComposerKey((key) => key + 1);
      message.success(t("order.discussionSent"));
      refreshInbox();
    } catch (err) {
      message.error(
        writeFailure(err, t("order.discussionWriteForbidden"), t("order.discussionUnavailable"), t("order.discussionSaveFailed")),
      );
    } finally {
      postingRef.current = false;
      setPosting(null);
    }
  };

  const saveEdit = async (note: ApiNote, content: string, mentions: MentionRef[]) => {
    const body = buildOrderNoteUpdate({
      content,
      mentionedUserIds: mentionIdsInText(content, mentions),
    });
    if (!body.content) {
      message.warning(t("order.discussionContentRequired"));
      return;
    }
    setBusyId(note.id);
    try {
      const updated = await notesApi.update(note.id, body);
      const next = withSelectedNames(
        updated ?? {
          ...note,
          content: body.content,
          mentionedUserIds: body.mentionedUserIds,
          updatedAt: new Date().toISOString(),
        },
        mentions,
      );
      setNotes((prev) => sortNotesNewestFirst(prev.map((item) => (item.id === note.id ? next : item))));
      setEditingId(null);
      message.success(t("order.discussionUpdated"));
      refreshInbox();
    } catch (err) {
      message.error(
        writeFailure(err, t("order.discussionWriteForbidden"), t("order.discussionUnavailable"), t("order.discussionSaveFailed")),
      );
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (note: ApiNote) => {
    setBusyId(note.id);
    try {
      await notesApi.remove(note.id);
      setNotes((prev) => prev.filter((item) => item.id !== note.id));
      if (editingId === note.id) setEditingId(null);
      if (reply && (reply.rootId === note.id || reply.noteId === note.id)) setReply(null);
      message.success(t("order.discussionDeleted"));
    } catch (err) {
      message.error(
        writeFailure(
          err,
          t("order.discussionWriteForbidden"),
          t("order.discussionUnavailable"),
          t("order.discussionDeleteFailed"),
        ),
      );
    } finally {
      setBusyId(null);
    }
  };

  const openReply = (rootId: string, note: ApiNote) => {
    const name = displayPerson(note.authorName, note.authorUserId);
    const mention = name && isUuid(note.authorUserId) ? { id: note.authorUserId, displayName: name } : null;
    setEditingId(null);
    setReply((current) => (current?.noteId === note.id ? null : { rootId, noteId: note.id, mention }));
  };

  const problemMessage =
    problem === "forbidden"
      ? t("order.discussionForbidden")
      : problem === "missing"
        ? t("order.discussionUnavailable")
        : problem === "error"
          ? t("order.discussionLoadError")
          : null;

  const threads = threadNotes(notes);

  const renderComment = (note: ApiNote, rootId: string) => {
    const author = displayPerson(note.authorName, note.authorUserId) || "—";
    const mine = Boolean(currentUserId && note.authorUserId === currentUserId);
    const mentions = noteMentions(note);
    const editing = editingId === note.id;
    const replyingHere = reply?.noteId === note.id;
    return (
      <div data-note-id={note.id} style={{ minWidth: 0 }}>
        {editing ? (
          <MentionComposer
            purpose="edit"
            canCompose
            submitting={busyId === note.id}
            frozen={posting !== null}
            authorName={authorName || author}
            initialContent={note.content}
            initialMentions={mentions}
            autoFocus
            showAvatar={false}
            onSubmit={(content, picked) => saveEdit(note, content, picked)}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div
            style={{
              display: "inline-block",
              maxWidth: "100%",
              padding: "8px 12px",
              borderRadius: 18,
              background: bubbleBg,
              color: token.colorText,
              fontSize: ds.fontSize.bodySm,
              lineHeight: "20px",
            }}
          >
            <span style={{ fontWeight: 600 }}>{author}</span> <CommentText content={note.content} mentions={mentions} />
          </div>
        )}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            marginTop: 2,
            paddingLeft: 12,
            minHeight: 28,
          }}
        >
          <span title={formatDisplayDateTime(note.createdAt)} style={{ fontSize: 12, fontWeight: 600, lineHeight: "16px", color: token.colorTextSecondary }}>
            {timeLabel(note.createdAt)}
            {noteWasEdited(note) ? ` · ${t("order.discussionEdited")}` : ""}
          </span>
          {canCompose ? (
            <button
              type="button"
              className={replyingHere ? "crm-discussion-action is-active" : "crm-discussion-action"}
              aria-pressed={replyingHere}
              disabled={posting !== null || busyId === note.id}
              onClick={() => openReply(rootId, note)}
            >
              {t("order.discussionReply")}
            </button>
          ) : null}
          {mine && !editing ? (
            <>
              <button
                type="button"
                className="crm-discussion-action"
                disabled={posting !== null || busyId === note.id}
                onClick={() => {
                  setReply(null);
                  setEditingId(note.id);
                }}
              >
                {t("common.edit")}
              </button>
              <Popconfirm
                title={t("order.discussionDeleteTitle")}
                description={t("order.discussionDeleteBody")}
                okText={t("common.delete")}
                cancelText={t("common.cancel")}
                okButtonProps={{ danger: true }}
                onConfirm={() => remove(note)}
              >
                <button type="button" className="crm-discussion-action is-danger" disabled={posting !== null || busyId === note.id}>
                  {t("common.delete")}
                </button>
              </Popconfirm>
            </>
          ) : null}
        </div>
      </div>
    );
  };

  const renderThread = (thread: NoteThread) => {
    const hasBranch = thread.replies.length > 0 || reply?.rootId === thread.note.id;
    return (
      <article key={thread.note.id} style={{ minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <div style={{ width: ROOT_AVATAR, flex: "0 0 32px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <PersonAvatar
              name={displayPerson(thread.note.authorName, thread.note.authorUserId) || "?"}
              seed={thread.note.authorUserId || thread.note.authorName}
              size={ROOT_AVATAR}
            />
            {hasBranch ? <div style={{ width: 2, flex: 1, marginTop: 4, borderRadius: 1, background: line }} /> : null}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>{renderComment(thread.note, thread.note.id)}</div>
        </div>
        {thread.replies.map((replyNote, index) => {
          const last = index === thread.replies.length - 1 && reply?.rootId !== thread.note.id;
          const name = displayPerson(replyNote.authorName, replyNote.authorUserId) || "?";
          return (
            <BranchRow key={replyNote.id} last={last} line={line}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <PersonAvatar name={name} seed={replyNote.authorUserId || name} size={REPLY_AVATAR} />
                <div style={{ flex: 1, minWidth: 0 }}>{renderComment(replyNote, thread.note.id)}</div>
              </div>
            </BranchRow>
          );
        })}
        {reply?.rootId === thread.note.id ? (
          <BranchRow last line={line} curve={22}>
            <div ref={replyAnchorRef} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <div style={{ height: 40, display: "flex", alignItems: "center", flex: "0 0 auto" }}>
                <PersonAvatar name={authorName || "?"} seed={authorName || currentUserId || "?"} size={REPLY_AVATAR} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <MentionComposer
                  key={reply.noteId}
                  purpose="reply"
                  canCompose={canCompose}
                  submitting={posting === "reply"}
                  frozen={posting === "dock"}
                  authorName={authorName}
                  showAvatar={false}
                  autoFocus
                  placeholder={t("order.discussionReplyPlaceholder")}
                  initialContent={reply.mention ? `@${reply.mention.displayName} ` : ""}
                  initialMentions={reply.mention ? [reply.mention] : []}
                  onSubmit={(content, picked) => publish(content, picked, "reply")}
                  onCancel={() => setReply(null)}
                />
              </div>
            </div>
          </BranchRow>
        ) : null}
      </article>
    );
  };

  return (
    <div>
      <style>{`
        .crm-mention { color: ${ds.primary}; font-weight: 700; }
        .crm-discussion-list {
          max-height: 420px;
          overflow-y: auto;
          scroll-behavior: smooth;
          overscroll-behavior: contain;
          scrollbar-width: thin;
          scrollbar-color: ${line} transparent;
        }
        @media (prefers-reduced-motion: reduce) {
          .crm-discussion-list { scroll-behavior: auto; }
        }
        .crm-discussion-action {
          border: 0;
          background: transparent;
          padding: 4px 2px;
          min-height: 28px;
          font-size: 12px;
          font-weight: 700;
          line-height: 16px;
          color: ${token.colorTextSecondary};
          cursor: pointer;
        }
        .crm-discussion-action:hover { text-decoration: underline; }
        .crm-discussion-action:focus-visible {
          outline: 2px solid ${ds.focusRing};
          outline-offset: 2px;
          border-radius: 4px;
        }
        .crm-discussion-action:disabled { opacity: 0.45; cursor: default; text-decoration: none; }
        .crm-discussion-action.is-active { color: ${ds.primary}; }
        .crm-discussion-action.is-danger { color: ${ds.danger}; }
      `}</style>
      {problemMessage ? (
        <Alert
          type={problem === "error" ? "error" : problem === "forbidden" ? "warning" : "info"}
          showIcon
          style={{ marginBottom: 12 }}
          title={problemMessage}
          action={
            problem === "forbidden" ? undefined : (
              <Button size="small" onClick={() => setReloadToken((value) => value + 1)}>
                {t("order.discussionRetry")}
              </Button>
            )
          }
        />
      ) : null}

      <div
        ref={listRef}
        className="crm-discussion-list"
        role="log"
        aria-label={t("order.discussionTab")}
        aria-busy={loading}
        onScroll={() => {
          const node = listRef.current;
          if (!node) return;
          stickRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
        }}
      >
        {loading ? (
          <div style={{ padding: 24, textAlign: "center" }}>
            <Spin />
          </div>
        ) : notes.length === 0 && !problem ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("order.discussionEmpty")} style={{ margin: "8px 0 12px" }} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{threads.map(renderThread)}</div>
        )}
      </div>

      {problem === "forbidden" ? null : (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
          <MentionComposer
            key={composerKey}
            purpose="post"
            canCompose={canCompose}
            submitting={posting === "dock"}
            frozen={posting === "reply"}
            authorName={authorName}
            onSubmit={(content, picked) => publish(content, picked, "dock")}
          />
        </div>
      )}
    </div>
  );
}
