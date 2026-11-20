"use client";

import { App, Alert, Button, Empty, Popconfirm, Spin, Typography, theme } from "antd";
import { useEffect, useState } from "react";
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

function displayPerson(name: string, id: string) {
  const trimmed = name.trim();
  if (!trimmed || trimmed === id || isUuid(trimmed)) return "";
  return trimmed;
}

function mentionsFromNote(note: ApiNote): MentionRef[] {
  return note.mentionedUserIds.flatMap((id, index) => {
    if (!isUuid(id)) return [];
    const name = note.mentionedUserNames[index]?.trim();
    if (!name || isUuid(name)) return [];
    return [{ id, displayName: name }];
  });
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
    <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: ds.fontSize.bodySm, lineHeight: 1.45 }}>
      {segments.map((segment, index) =>
        segment.kind === "mention" ? (
          <span key={`${segment.id}-${index}`} className="crm-mention">
            @{segment.displayName}
          </span>
        ) : (
          <span key={`text-${index}`}>{segment.text}</span>
        ),
      )}
    </div>
  );
}

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
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const timeLabel = (iso: string) => {
    const age = relativeAge(iso);
    if (age.unit === "justNow") return t("time.justNow");
    if (age.unit === "minutes") return t("time.minutesAgo", { n: age.n });
    if (age.unit === "hours") return t("time.hoursAgo", { n: age.n });
    if (age.unit === "days") return t("time.daysAgo", { n: age.n });
    return formatDisplayDateTime(iso);
  };

  const publish = async (content: string, mentions: MentionRef[]) => {
    const payload = buildOrderNotePayload({
      orderId,
      content,
      mentionedUserIds: mentionIdsInText(content, mentions),
    });
    if (!payload.content) {
      message.warning(t("order.discussionContentRequired"));
      return;
    }
    setPosting(true);
    try {
      const created = withSelectedNames(await notesApi.create(payload), mentions);
      setNotes((prev) => sortNotesNewestFirst([created, ...prev.filter((item) => item.id !== created.id)]));
      setProblem(null);
      setComposerKey((key) => key + 1);
      message.success(t("order.discussionSent"));
      refreshInbox();
    } catch (err) {
      message.error(
        writeFailure(err, t("order.discussionWriteForbidden"), t("order.discussionUnavailable"), t("order.discussionSaveFailed")),
      );
    } finally {
      setPosting(false);
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

  const problemMessage =
    problem === "forbidden"
      ? t("order.discussionForbidden")
      : problem === "missing"
        ? t("order.discussionUnavailable")
        : problem === "error"
          ? t("order.discussionLoadError")
          : null;

  const chronological = [...notes].reverse();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <style>{`.crm-mention { color: ${ds.primary}; font-weight: 700; }`}</style>
      {problemMessage ? (
        <Alert
          type={problem === "error" ? "error" : problem === "forbidden" ? "warning" : "info"}
          showIcon
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

      {loading ? (
        <div style={{ padding: 24, textAlign: "center" }}>
          <Spin />
        </div>
      ) : notes.length === 0 && !problem ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("order.discussionEmpty")} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {chronological.map((note) => {
            const author = displayPerson(note.authorName, note.authorUserId) || "—";
            const mine = Boolean(currentUserId && note.authorUserId === currentUserId);
            const mentions = mentionsFromNote(note);
            const editing = editingId === note.id;
            return (
              <article key={note.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <PersonAvatar name={author} seed={note.authorUserId || author} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Typography.Text strong style={{ fontSize: ds.fontSize.bodySm, display: "block" }}>
                    {author}
                  </Typography.Text>
                  {editing ? (
                    <div style={{ marginTop: 6 }}>
                      <MentionComposer
                        canCompose
                        submitting={busyId === note.id}
                        authorName={authorName || author}
                        initialContent={note.content}
                        initialMentions={mentions}
                        autoFocus
                        showAvatar={false}
                        onSubmit={(content, picked) => saveEdit(note, content, picked)}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "inline-block",
                        maxWidth: "100%",
                        marginTop: 2,
                        padding: "8px 12px",
                        borderRadius: 18,
                        background: token.colorFillTertiary,
                      }}
                    >
                      <CommentText content={note.content} mentions={mentions} />
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      alignItems: "center",
                      marginTop: 4,
                      paddingInline: 4,
                    }}
                  >
                    <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }} title={formatDisplayDateTime(note.createdAt)}>
                      {timeLabel(note.createdAt)}
                      {noteWasEdited(note) ? ` · ${t("order.discussionEdited")}` : ""}
                    </Typography.Text>
                    {mine && !editing ? (
                      <>
                        <Button
                          type="link"
                          size="small"
                          style={{ padding: 0, height: "auto", fontSize: ds.fontSize.caption }}
                          disabled={posting || busyId === note.id}
                          onClick={() => setEditingId(note.id)}
                        >
                          {t("common.edit")}
                        </Button>
                        <Popconfirm
                          title={t("order.discussionDeleteTitle")}
                          description={t("order.discussionDeleteBody")}
                          okText={t("common.delete")}
                          cancelText={t("common.cancel")}
                          okButtonProps={{ danger: true }}
                          onConfirm={() => remove(note)}
                        >
                          <Button
                            type="link"
                            size="small"
                            danger
                            style={{ padding: 0, height: "auto", fontSize: ds.fontSize.caption }}
                            disabled={posting || busyId === note.id}
                          >
                            {t("common.delete")}
                          </Button>
                        </Popconfirm>
                      </>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {problem === "forbidden" ? null : (
        <MentionComposer
          key={composerKey}
          canCompose={canCompose}
          submitting={posting}
          authorName={authorName}
          onSubmit={publish}
        />
      )}
    </div>
  );
}
