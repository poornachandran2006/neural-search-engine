import type { StreamMeta, SourceChunk } from "@/types";

export type SSEEvent =
  | { type: "meta"; data: StreamMeta }
  | { type: "token"; data: string }
  | { type: "sources"; data: SourceChunk[] }
  | { type: "done" }
  | { type: "error"; data: string };

/**
 * Streams tokens from the /query/stream SSE endpoint.
 * Uses fetch + ReadableStream instead of EventSource because
 * EventSource doesn't support POST requests.
 *
 * Parses the four SSE event types we emit:
 *   data: [META]{...}      → StreamMeta object
 *   data: [SOURCES]{...}   → SourceChunk array
 *   data: [DONE]           → stream complete
 *   data: {token}          → raw text token
 */
export async function* streamQuery(
  query: string,
  chatId?: string,
  signal?: AbortSignal
): AsyncGenerator<SSEEvent> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/query/stream`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, chat_id: chatId }),
      signal,
    }
  );

  if (!res.ok || !res.body) {
    yield { type: "error", data: `HTTP ${res.status}` };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6); // strip "data: "

      if (raw === "[DONE]") {
        yield { type: "done" };
        return;
      }

      if (raw.startsWith("[META]")) {
        try {
          yield { type: "meta", data: JSON.parse(raw.slice(6)) };
        } catch {
          // malformed meta — skip
        }
        continue;
      }

      if (raw.startsWith("[SOURCES]")) {
        try {
          yield { type: "sources", data: JSON.parse(raw.slice(9)) };
        } catch {
          // malformed sources — skip
        }
        continue;
      }

      // Plain token
      yield { type: "token", data: raw };
    }
  }
}