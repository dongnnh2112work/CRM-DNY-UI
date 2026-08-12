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

type Ctx = {
  emails: EmailRecord[];
  ready: boolean;
  addEmail: (input: Omit<EmailRecord, "id">) => EmailRecord;
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
    if (stored && Array.isArray(stored)) setEmails(stored);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveJson(KEY, emails);
  }, [emails, ready]);

  const addEmail = useCallback((input: Omit<EmailRecord, "id">) => {
    const created: EmailRecord = { ...input, id: `e-${Date.now()}` };
    setEmails((prev) => [created, ...prev]);
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
    () => ({ emails, ready, addEmail, updateEmail, deleteEmails, setStatus }),
    [emails, ready, addEmail, updateEmail, deleteEmails, setStatus],
  );

  return <EmailsContext.Provider value={value}>{children}</EmailsContext.Provider>;
}

export function useEmails() {
  const ctx = useContext(EmailsContext);
  if (!ctx) throw new Error("useEmails must be used within EmailsProvider");
  return ctx;
}
