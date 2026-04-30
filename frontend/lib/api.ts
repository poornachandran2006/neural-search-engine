import type { Chat, Message, Document, BenchmarkResults } from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

// ─── Chats ────────────────────────────────────────────────────────────────────

export const api = {
  chats: {
    list: () => request<Chat[]>("/chats"),
    messages: (chatId: string) =>
      request<Message[]>(`/chats/${chatId}/messages`),
    delete: (chatId: string) =>
      request<{ deleted: string }>(`/chats/${chatId}`, { method: "DELETE" }),
  },

  // ─── Documents ──────────────────────────────────────────────────────────────

  documents: {
    list: () => request<Document[]>("/documents"),

    upload: async (file: File): Promise<import("@/types").IngestResponse> => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${BASE}/ingest`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || "Upload failed");
      }
      return res.json();
    },
  },

  // ─── Evaluation ─────────────────────────────────────────────────────────────

  evaluation: {
    results: () => request<BenchmarkResults>("/evaluation/results"),
    run: () => request<{ status: string; message: string }>("/evaluation/run", { method: "POST" }),
    status: () => request<{ running: boolean }>("/evaluation/status"),
  },

  // ─── Stream URL (used by useStream hook) ────────────────────────────────────

  streamUrl: () => `${BASE}/query/stream`,
};