"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loadJson, saveJson } from "@/lib/demo-storage";
import { MOCK_EMAILS } from "@/lib/mock-emails";
import type { EmailRecord, EmailStatus } from "@/lib/types";

const KEY = "dny-crm-emails";

function newEmailId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `e-${crypto.randomUUID()}`;
  }
  return `e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function emailContentKey(
  e: Pick<EmailRecord, "subject" | "recipients" | "sentAt" | "scheduledAt" | "body" | "status">,
) {
  return [e.subject, (e.recipients ?? []).join(","), e.sentAt ?? "", e.scheduledAt ?? "", e.body ?? "", e.status].join(
    "\0",
  );
}

function normalizeEmails(list: EmailRecord[]): EmailRecord[] {
  const seenIds = new Set<string>();
  const seenContent = new Set<string>();
  const out: EmailRecord[] = [];
  for (const email of list) {
    const content = emailContentKey(email);
    if (seenContent.has(content)) continue;
    seenContent.add(content);
    let id = email.id?.trim() ?? "";
    if (!id || seenIds.has(id)) id = newEmailId();
    seenIds.add(id);
    out.push(id === email.id ? email : { ...email, id });
  }
  return out;
}

type Ctx = {
  emails: EmailRecord[];
  ready: boolean;
  addEmail: (input: Omit<EmailRecord, "id">) => EmailRecord;
  addEmails: (inputs: Omit<EmailRecord, "id">[]) => EmailRecord[];
  updateEmail: (id: string, patch: Partial<EmailRecord>) => void;
  deleteEmails: (ids: string[]) => void;
  setStatus: (ids: string[], status: EmailStatus) => void;
};

const EmailsContext = createContext<Ctx | null>(null);

export function EmailsProvider({ children }: { children: ReactNode }) {
  const [emails, setEmails] = useState<EmailRecord[]>(MOCK_EMAILS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = loadJson<EmailRecord[]>(KEY);
    if (stored && Array.isArray(stored)) setEmails(normalizeEmails(stored));
    else setEmails((prev) => normalizeEmails(prev));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const normalized = normalizeEmails(emails);
    const changed =
      normalized.length !== emails.length || normalized.some((e, i) => e.id !== emails[i]?.id);
    if (changed) {
      setEmails(normalized);
      return;
    }
    saveJson(KEY, emails);
  }, [emails, ready]);

  const addEmails = useCallback((inputs: Omit<EmailRecord, "id">[]) => {
    if (inputs.length === 0) return [];
    const created: EmailRecord[] = [];
    setEmails((prev) => {
      const base = normalizeEmails(prev);
      const content = new Set(base.map(emailContentKey));
      for (const input of inputs) {
        const key = emailContentKey(input);
        if (content.has(key)) continue;
        content.add(key);
        created.push({ ...input, id: newEmailId() });
      }
      return created.length ? [...created, ...base] : base;
    });
    return created;
  }, []);

  const addEmail = useCallback((input: Omit<EmailRecord, "id">): EmailRecord => {
    const created: EmailRecord = { ...input, id: newEmailId() };
    setEmails((prev) => [created, ...normalizeEmails(prev)]);
    return created;
  }, []);

  const updateEmail = useCallback((id: string, patch: Partial<EmailRecord>) => {
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const deleteEmails = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setEmails((prev) => prev.filter((e) => !set.has(e.id)));
  }, []);

  const setStatus = useCallback((ids: string[], status: EmailStatus) => {
    const set = new Set(ids);
    const today = new Date().toISOString().slice(0, 10);
    setEmails((prev) =>
      prev.map((e) => {
        if (!set.has(e.id)) return e;
        return {
          ...e,
          status,
          sentAt: status === "sent" ? (e.sentAt ?? today) : e.sentAt,
        };
      }),
    );
  }, []);

  const value = useMemo(
    () => ({ emails, ready, addEmail, addEmails, updateEmail, deleteEmails, setStatus }),
    [emails, ready, addEmail, addEmails, updateEmail, deleteEmails, setStatus],
  );

  return <EmailsContext.Provider value={value}>{children}</EmailsContext.Provider>;
}

export function useEmails() {
  const ctx = useContext(EmailsContext);
  if (!ctx) throw new Error("useEmails must be used within EmailsProvider");
  return ctx;
}
