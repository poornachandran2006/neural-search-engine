"use client";

import { useCallback, useRef, useState } from "react";
import { streamQuery } from "@/lib/sse";
import type { StreamState } from "@/types";

const INITIAL_STATE: StreamState = {
  status: "idle",
  content: "",
  meta: null,
  sources: [],
};

export function useStream() {
  const [state, setState] = useState<StreamState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (query: string, chatId?: string, history?: Array<{ role: string; content: string }>) => {
    // Cancel any in-flight stream
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ status: "streaming", content: "", meta: null, sources: [] });

    try {
      for await (const event of streamQuery(query, chatId, controller.signal, history)) {
        if (controller.signal.aborted) break;

        switch (event.type) {
          case "meta":
            setState((s) => ({ ...s, meta: event.data }));
            break;
          case "token":
            setState((s) => ({ ...s, content: s.content + event.data }));
            break;
          case "sources":
            setState((s) => ({ ...s, sources: event.data }));
            break;
          case "done":
            setState((s) => ({ ...s, status: "done" }));
            break;
          case "error":
            setState((s) => ({ ...s, status: "error", error: event.data }));
            break;
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setState((s) => ({
        ...s,
        status: "error",
        error: err instanceof Error ? err.message : "Stream failed",
      }));
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(INITIAL_STATE);
  }, []);

  return { state, send, reset };
}