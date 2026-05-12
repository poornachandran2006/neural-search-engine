"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useStream } from "@/hooks/useStream";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import type { Message } from "@/types";

interface Props {
  messages: Message[];
  activeChatId: string | null;
  onMessageSent: (userMsg: Message, assistantMsg: Message) => void;
  onChatCreated: (chatId: string) => void;
  onStreamDone: () => void;
  history?: Array<{ role: string; content: string }>;
  suggestions?: string[];
  onFeedback?: (messageId: string, rating: 1 | -1) => void;
}

function CopyTraceButton({ traceId }: { traceId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(traceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      title="Click to copy trace ID"
      className="font-mono text-xs rounded-sm px-2 py-px shrink-0 transition-all duration-200"
      style={{
        color: copied ? "var(--accent-green)" : "var(--text-muted)",
        background: copied ? "rgba(0,255,157,0.08)" : "var(--bg-elevated)",
        border: copied ? "1px solid rgba(0,255,157,0.20)" : "1px solid var(--border-subtle)",
        cursor: "pointer",
      }}
    >
      {copied ? "✓ copied" : `#${traceId}`}
    </button>
  );
}

export function ChatWindow({
  messages,
  activeChatId,
  onMessageSent,
  onChatCreated,
  onStreamDone,
  history,
  suggestions = [],
  onFeedback,
}: Props) {
  const streamingMsgIdRef = useRef<string | null>(null);
  const activeChatIdRef = useRef(activeChatId);
  useEffect(() => { activeChatIdRef.current = activeChatId; }, [activeChatId]);

  const onStreamComplete = useCallback((content: string, sources: unknown[], meta: unknown) => {
    const finalId = streamingMsgIdRef.current ?? crypto.randomUUID();
    streamingMsgIdRef.current = null;

    const m = meta as { chat_id?: string } | null;
    if (m?.chat_id && m.chat_id !== activeChatIdRef.current) {
      onChatCreated(m.chat_id);
    }
    onStreamDone();
    onMessageSent(
      { id: "", role: "user", content: "", created_at: "" },
      {
        id: finalId,
        role: "assistant",
        content,
        sources: sources as Message["sources"],
        created_at: new Date().toISOString(),
      }
    );
  }, [onChatCreated, onStreamDone, onMessageSent]);

  const { state, send } = useStream(onStreamComplete);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, state.content]);

  const handleSend = (query: string) => {
    const streamingId = crypto.randomUUID();
    streamingMsgIdRef.current = streamingId;

    onMessageSent(
      {
        id: crypto.randomUUID(),
        role: "user",
        content: query,
        created_at: new Date().toISOString(),
      },
      {
        id: streamingId,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
        isStreaming: true,
      }
    );

    send(query, activeChatId ?? undefined, history);
  };

  const intentBadgeClass = state.meta ? `badge-${state.meta.intent}` : "";
  const isStreaming = state.status === "streaming";
  const isEmpty = messages.length === 0 && state.status === "idle";

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--bg-base)" }}>
      {state.meta && (
        <div
          className="animate-fade-in flex items-center gap-2 px-5 py-2 shrink-0 overflow-x-auto"
          style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface)" }}
        >
          <span className={`font-mono text-xs font-medium rounded-sm px-2 py-px shrink-0 ${intentBadgeClass}`}>
            {state.meta.intent}
          </span>
          {state.meta.cached && (
            <span className="font-mono text-xs rounded-sm px-2 py-px shrink-0"
              style={{ color: "var(--accent-green)", background: "rgba(0,255,157,0.08)", border: "1px solid rgba(0,255,157,0.20)" }}>
              cached
            </span>
          )}
          {state.meta.is_multi_doc && (
            <span className="font-mono text-xs rounded-sm px-2 py-px shrink-0"
              style={{ color: "var(--accent-amber)", background: "rgba(255,179,71,0.08)", border: "1px solid rgba(255,179,71,0.20)" }}>
              map-reduce
            </span>
          )}
          {state.meta.answer_confidence && (
            <span className="font-mono text-xs rounded-sm px-2 py-px shrink-0"
              style={{
                color: state.meta.answer_confidence === "high" ? "var(--accent-green)" : state.meta.answer_confidence === "medium" ? "var(--accent-cyan)" : "var(--accent-red)",
                background: state.meta.answer_confidence === "high" ? "rgba(0,255,157,0.08)" : state.meta.answer_confidence === "medium" ? "rgba(0,212,255,0.08)" : "rgba(255,77,109,0.06)",
                border: state.meta.answer_confidence === "high" ? "1px solid rgba(0,255,157,0.20)" : state.meta.answer_confidence === "medium" ? "1px solid rgba(0,212,255,0.20)" : "1px solid rgba(255,77,109,0.20)",
              }}>
              {state.meta.answer_confidence} confidence
            </span>
          )}
          <span className="font-mono text-xs truncate flex-1" style={{ color: "var(--text-muted)" }}>
            → {state.meta.rewritten_query}
          </span>
          {state.meta.trace_id && (
            <CopyTraceButton traceId={state.meta.trace_id} />
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5 flex flex-col gap-4">
        {isEmpty && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-2"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--border-strong)" }}>
              ◈
            </div>
            <p className="text-base text-center max-w-[280px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {suggestions.length > 0 ? "Ask a question or try one of these:" : "Upload a document and ask anything about its contents."}
            </p>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center max-w-[560px]">
                {suggestions.slice(0, 5).map((s, i) => (
                  <button key={i} onClick={() => handleSend(s)}
                    className="text-left px-3 py-2 rounded-lg font-mono text-xs transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-secondary)", cursor: "pointer" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent-cyan)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent-cyan)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-default)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={msg.id || i} message={msg} onFeedback={onFeedback} />
        ))}

        {/* Streaming bubble — lives entirely in ChatWindow state */}
        {state.status === "streaming" && (
          <div className="flex flex-col gap-2">
            {state.pipelineSteps.length > 0 && !state.content && (
              <div className="flex flex-col gap-1 px-3 py-2 rounded-lg font-mono text-xs"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-muted)", maxWidth: "320px" }}>
                {state.pipelineSteps.map((step) => (
                  <div key={step.step} className="flex items-center gap-2">
                    <span style={{ color: step.done ? "var(--accent-cyan)" : "var(--accent-amber)" }}>
                      {step.done ? "✓" : "⟳"}
                    </span>
                    <span style={{ color: step.done ? "var(--text-secondary)" : "var(--text-primary)" }}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <MessageBubble
              message={{ id: streamingMsgIdRef.current ?? "", role: "assistant", content: state.content, sources: state.sources, created_at: new Date().toISOString(), isStreaming: true }}
              onFeedback={onFeedback}
            />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="px-4 md:px-8 pb-4 pt-3 shrink-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <ChatInput onSend={handleSend} disabled={isStreaming} />
        <p className="text-center mt-2 font-mono text-xs" style={{ color: "var(--text-muted)" }}>
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}