"use client";

import { useCallback, useRef, useState } from "react";
import { streamQuery } from "@/lib/sse";
import type { StreamState, SourceChunk, StreamMeta } from "@/types";

const INITIAL_STATE: StreamState = {
  status: "idle",
  content: "",
  meta: null,
  sources: [],
  pipelineSteps: [],
};

type OnCompleteCallback = (content: string, sources: SourceChunk[], meta: StreamMeta | null) => void;

export function useStream(onComplete?: OnCompleteCallback) {
  const [state, setState] = useState<StreamState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const onCompleteRef = useRef<OnCompleteCallback | undefined>(onComplete);
  onCompleteRef.current = onComplete; // always latest, no stale closure

  const send = useCallback(async (query: string, chatId?: string, history?: Array<{ role: string; content: string }>) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ status: "streaming", content: "", meta: null, sources: [], pipelineSteps: [] });

    // Track final values in local vars — no React state timing issues
    let finalContent = "";
    let finalSources: SourceChunk[] = [];
    let finalMeta: StreamMeta | null = null;

    try {
      for await (const event of streamQuery(query, chatId, controller.signal, history)) {
        if (controller.signal.aborted) break;

        switch (event.type) {
          case "status":
            setState((s) => ({
              ...s,
              pipelineSteps: [
                ...s.pipelineSteps.filter((p) => p.step !== event.data.step),
                event.data,
              ],
            }));
            break;
          case "meta":
            finalMeta = event.data;
            setState((s) => ({ ...s, meta: event.data }));
            break;
          case "token":
            finalContent += event.data;
            setState((s) => ({ ...s, content: s.content + event.data }));
            break;
          case "sources":
            finalSources = event.data;
            setState((s) => ({ ...s, sources: event.data }));
            break;
          case "done":
            // Call callback FIRST with local vars (guaranteed correct values)
            // THEN update state — order matters
            onCompleteRef.current?.(finalContent, finalSources, finalMeta);
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