import { apiRequest } from "@/lib/http/client";
import {
  normalizeNote,
  sortNotesNewestFirst,
  unwrapNotes,
  type ApiNote,
  type OrderNotePayload,
  type OrderNoteUpdate,
} from "@/modules/notes/model";

export type { ApiNote, OrderNotePayload, OrderNoteUpdate };
export { buildOrderNotePayload, buildOrderNoteUpdate, noteWasEdited, sortNotesNewestFirst } from "@/modules/notes/model";

export const notesApi = {
  async listForOrder(orderId: string): Promise<ApiNote[]> {
    const params = new URLSearchParams({ subjectType: "ORDER", subjectId: orderId });
    const raw = await apiRequest<unknown>(`/notes?${params.toString()}`);
    return sortNotesNewestFirst(unwrapNotes(raw));
  },

  async create(body: OrderNotePayload): Promise<ApiNote> {
    const raw = await apiRequest<unknown>("/notes", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const note = normalizeNote(raw);
    if (!note) throw new Error("Invalid note");
    return note;
  },

  async update(id: string, body: OrderNoteUpdate): Promise<ApiNote | null> {
    const raw = await apiRequest<unknown>(`/notes/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return normalizeNote(raw);
  },

  remove(id: string) {
    return apiRequest<void>(`/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};
