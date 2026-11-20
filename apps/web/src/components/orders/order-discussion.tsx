"use client";

import { App, Alert, Button, Empty, Input, Popconfirm, Select, Spin, Typography, theme } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { ds } from "@/lib/design-tokens";
import { formatDisplayDateTime } from "@/lib/format-date";
import { ApiError } from "@/lib/http/errors";
import { apiErrorMessage, isUuid } from "@/lib/http/message";
import { useNotifications } from "@/lib/notifications-store";
import { useSession } from "@/lib/session/session-provider";
import { useT } from "@/lib/use-t";
import { notesApi } from "@/modules/notes/api";
import {
  buildOrderNotePayload,
  buildOrderNoteUpdate,
  httpProblem,
  noteWasEdited,
  sortNotesNewestFirst,
  type ApiNote,
  type HttpProblem,
} from "@/modules/notes/model";
import { usersDirectoryApi, type DirectoryUser } from "@/modules/users/directory";

const NOTE_MAX = 4000;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0]?.slice(0, 1) ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.slice(0, 1) ?? "" : "";
  return `${first}${last}`.toUpperCase();
}

function displayPerson(name: string, id: string) {
  const trimmed = name.trim();
  if (!trimmed || trimmed === id || isUuid(trimmed)) return "";
  return trimmed;
}

function mentionLabels(note: ApiNote) {
  const labels: string[] = [];
  const count = Math.max(note.mentionedUserNames.length, note.mentionedUserIds.length);
  for (let index = 0; index < count; index += 1) {
    const name = note.mentionedUserNames[index]?.trim();
    if (!name || isUuid(name)) continue;
    labels.push(name);
  }
  return labels;
}

function withSelectedNames(note: ApiNote, selected: DirectoryUser[]): ApiNote {
  const serverNames = note.mentionedUserNames.some((name) => name.trim() && !isUuid(name.trim()));
  if (serverNames) return note;
  const byId = new Map(selected.map((user) => [user.id, user.displayName]));
  return {
    ...note,
    mentionedUserNames: note.mentionedUserIds.map((id) => byId.get(id) ?? ""),
  };
}

function mentionsFromNote(note: ApiNote): DirectoryUser[] {
  return note.mentionedUserIds.flatMap((id, index) => {
    if (!isUuid(id)) return [];
    const name = note.mentionedUserNames[index]?.trim();
    const displayName = name && !isUuid(name) ? name : "";
    return [{ id, displayName, email: "" }];
  });
}

function writeFailure(err: unknown, denied: string, missing: string, fallback: string) {
  const problem = httpProblem(err);
  if (problem === "forbidden") return denied;
  if (problem === "missing") return missing;
  if (err instanceof ApiError || err instanceof Error) return apiErrorMessage(err, fallback);
  return fallback;
}

function MentionChip({ name }: { name: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px 2px 6px",
        borderRadius: ds.radius.full,
        background: "rgba(0, 117, 222, 0.10)",
        color: ds.primary,
        fontSize: ds.fontSize.caption,
        fontWeight: 600,
        lineHeight: "18px",
      }}
    >
      <span aria-hidden>@</span>
      {name}
    </span>
  );
}

function MentionPicker({
  value,
  disabled,
  onChange,
}: {
  value: DirectoryUser[];
  disabled: boolean;
  onChange: (users: DirectoryUser[]) => void;
}) {
  const t = useT();
  const requestId = useRef(0);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<DirectoryUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [problem, setProblem] = useState<HttpProblem | null>(null);

  const optionUsers = useMemo(() => {
    const map = new Map<string, DirectoryUser>();
    for (const user of value) map.set(user.id, user);
    for (const user of options) map.set(user.id, user);
    return [...map.values()];
  }, [options, value]);

  useEffect(() => {
    if (!open || disabled) return;
    const ticket = ++requestId.current;
    const handle = window.setTimeout(() => {
      setSearching(true);
      usersDirectoryApi
        .search(query.trim())
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
    }, 280);
    return () => window.clearTimeout(handle);
  }, [disabled, open, query]);

  const emptyLabel =
    problem === "forbidden"
      ? t("order.discussionMentionDenied")
      : problem === "missing"
        ? t("order.discussionDirectoryUnavailable")
        : problem === "error"
          ? t("order.discussionMentionFailed")
          : t("order.discussionMentionEmpty");

  return (
    <Select
      mode="multiple"
      allowClear
      disabled={disabled}
      showSearch={{ filterOption: false }}
      filterOption={false}
      aria-label={t("order.discussionMention")}
      placeholder={t("order.discussionMentionPh")}
      value={value.map((user) => user.id)}
      options={optionUsers.map((user) => ({
        value: user.id,
        label: user.displayName || user.email,
      }))}
      optionRender={(option) => {
        const user = optionUsers.find((item) => item.id === option.value);
        return (
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.35 }}>
            <span>{user?.displayName || option.label}</span>
            {user?.email ? (
              <span style={{ fontSize: ds.fontSize.caption, color: ds.inkMuted }}>{user.email}</span>
            ) : null}
          </div>
        );
      }}
      tagRender={(tag) => (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            marginInlineEnd: 4,
            padding: "0 6px",
            borderRadius: ds.radius.full,
            background: "rgba(0, 117, 222, 0.10)",
            color: ds.primary,
            fontSize: ds.fontSize.caption,
            fontWeight: 600,
            lineHeight: "22px",
          }}
        >
          @{tag.label}
          {tag.closable ? (
            <span
              role="button"
              aria-label={t("common.delete")}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={tag.onClose}
              style={{ cursor: "pointer", fontWeight: 500 }}
            >
              ×
            </span>
          ) : null}
        </span>
      )}
      onOpenChange={setOpen}
      onSearch={setQuery}
      onChange={(ids) => {
        const selected = new Map(optionUsers.map((user) => [user.id, user]));
        const next = (Array.isArray(ids) ? ids : []).flatMap((id) => {
          const user = typeof id === "string" ? selected.get(id) : undefined;
          return user ? [user] : [];
        });
        onChange(next);
      }}
      notFoundContent={searching ? <Spin size="small" /> : emptyLabel}
      style={{ width: "100%" }}
    />
  );
}

function DiscussionComposer({
  canCompose,
  submitting,
  submitLabel,
  initialContent = "",
  initialMentions = [],
  onSubmit,
  onCancel,
}: {
  canCompose: boolean;
  submitting: boolean;
  submitLabel: string;
  initialContent?: string;
  initialMentions?: DirectoryUser[];
  onSubmit: (content: string, mentions: DirectoryUser[]) => Promise<void>;
  onCancel?: () => void;
}) {
  const t = useT();
  const { token } = theme.useToken();
  const [content, setContent] = useState(initialContent);
  const [mentions, setMentions] = useState<DirectoryUser[]>(initialMentions);
  const ready = canCompose && content.trim().length > 0 && !submitting;

  return (
    <div
      style={{
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: ds.radius.lg,
        padding: 12,
        boxShadow: ds.shadow,
      }}
    >
      <Input.TextArea
        value={content}
        disabled={!canCompose || submitting}
        maxLength={NOTE_MAX}
        autoSize={{ minRows: onCancel ? 2 : 3, maxRows: 8 }}
        placeholder={t("order.discussionPlaceholder")}
        aria-label={t("order.discussionPlaceholder")}
        variant="borderless"
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && ready) {
            event.preventDefault();
            void onSubmit(content, mentions);
          }
        }}
        style={{ paddingInline: 4, fontSize: ds.fontSize.bodySm }}
      />
      <div style={{ marginTop: 8 }}>
        <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption, display: "block", marginBottom: 6 }}>
          {t("order.discussionMention")}
        </Typography.Text>
        <MentionPicker value={mentions} disabled={!canCompose || submitting} onChange={setMentions} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginTop: 10 }}>
        <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
          {canCompose ? t("order.discussionHint") : t("order.discussionNeedUpdate")}
        </Typography.Text>
        <div style={{ display: "flex", gap: 8, flex: "0 0 auto" }}>
          {onCancel ? (
            <Button onClick={onCancel} disabled={submitting}>
              {t("common.cancel")}
            </Button>
          ) : null}
          <Button
            type="primary"
            loading={submitting}
            disabled={!ready}
            onClick={() => void onSubmit(content, mentions)}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
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

  const publish = async (content: string, mentions: DirectoryUser[]) => {
    const payload = buildOrderNotePayload({
      orderId,
      content,
      mentionedUserIds: mentions.map((item) => item.id),
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

  const saveEdit = async (note: ApiNote, content: string, mentions: DirectoryUser[]) => {
    const body = buildOrderNoteUpdate({
      content,
      mentionedUserIds: mentions.map((item) => item.id),
    });
    if (!body.content) {
      message.warning(t("order.discussionContentRequired"));
      return;
    }
    setBusyId(note.id);
    try {
      const updated = await notesApi.update(note.id, body);
      const next = withSelectedNames(
        updated ?? { ...note, content: body.content, mentionedUserIds: body.mentionedUserIds, updatedAt: new Date().toISOString() },
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
        writeFailure(err, t("order.discussionWriteForbidden"), t("order.discussionUnavailable"), t("order.discussionDeleteFailed")),
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {problemMessage ? (
        <Alert
          type={problem === "error" ? "error" : problem === "forbidden" ? "warning" : "info"}
          showIcon
          title={problemMessage}
          action={
            problem === "forbidden" ? undefined : (
              <Button size="small" onClick={() => setReloadToken((token) => token + 1)}>
                {t("order.discussionRetry")}
              </Button>
            )
          }
        />
      ) : null}

      {problem === "forbidden" ? null : (
        <DiscussionComposer
          key={composerKey}
          canCompose={canCompose}
          submitting={posting}
          submitLabel={t("order.discussionSend")}
          onSubmit={publish}
        />
      )}

      {loading ? (
        <div style={{ padding: 24, textAlign: "center" }}>
          <Spin />
        </div>
      ) : notes.length === 0 && !problem ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("order.discussionEmpty")} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notes.map((note) => {
            const author = displayPerson(note.authorName, note.authorUserId) || "—";
            const mine = Boolean(currentUserId && note.authorUserId === currentUserId);
            const labels = mentionLabels(note);
            const editing = editingId === note.id;
            return (
              <article
                key={note.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "36px minmax(0, 1fr)",
                  gap: 12,
                  padding: "12px 14px",
                  background: token.colorBgContainer,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: ds.radius.lg,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: ds.radius.full,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(0, 117, 222, 0.12)",
                    color: ds.primary,
                    fontSize: ds.fontSize.caption,
                    fontWeight: 700,
                  }}
                >
                  {author === "—" ? "?" : initials(author)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                    <Typography.Text strong style={{ fontSize: ds.fontSize.bodySm }}>
                      {author}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption, flex: "0 0 auto" }}>
                      {formatDisplayDateTime(note.createdAt)}
                      {noteWasEdited(note) ? ` · ${t("order.discussionEdited")}` : ""}
                    </Typography.Text>
                  </div>
                  {editing ? (
                    <div style={{ marginTop: 8 }}>
                      <DiscussionComposer
                        canCompose
                        submitting={busyId === note.id}
                        submitLabel={t("common.save")}
                        initialContent={note.content}
                        initialMentions={mentionsFromNote(note)}
                        onSubmit={(content, mentions) => saveEdit(note, content, mentions)}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  ) : (
                    <>
                      <Typography.Paragraph
                        style={{
                          margin: "6px 0 0",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          fontSize: ds.fontSize.bodySm,
                        }}
                      >
                        {note.content}
                      </Typography.Paragraph>
                      {labels.length ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                          {labels.map((label) => (
                            <MentionChip key={`${note.id}-${label}`} name={label} />
                          ))}
                        </div>
                      ) : null}
                      {mine ? (
                        <div style={{ display: "flex", gap: 4, marginTop: 4, marginInline: -8 }}>
                          <Button
                            type="link"
                            size="small"
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
                            <Button type="link" size="small" danger disabled={posting || busyId === note.id}>
                              {t("common.delete")}
                            </Button>
                          </Popconfirm>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
