"use client";

import { useEffect, useRef } from "react";
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
  const { state, send } = useStream();
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevStatusRef = useRef<string>("idle");
  const streamingMsgIdRef = useRef<string | null>(null);
  const finalContentRef = useRef<string>("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, state.content]);

  useEffect(() => {
    if (state.status === "streaming") {
      finalContentRef.current = state.content;
    }
  }, [state.content, state.status]);

  useEffect(() => {
    const prev = prevStatusRef.current;
    const curr = state.status;
    prevStatusRef.current = curr;

    if (prev === "streaming" && curr === "done") {
      streamingMsgIdRef.current = null;

      if (state.meta?.chat_id && state.meta.chat_id !== activeChatId) {
        onChatCreated(state.meta.chat_id);
      }
      onStreamDone();
      onMessageSent(
        { id: "", role: "user", content: "", created_at: "" },
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: finalContentRef.current,
          sources: state.sources,
          created_at: new Date().toISOString(),
        }
      );
    }
  }, [state.status]); // eslint-disable-line

  const handleSend = (query: string) => {
    const streamingId = crypto.randomUUID();
    streamingMsgIdRef.current = streamingId;
    finalContentRef.current = "";

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
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: "var(--bg-base)" }}
    >
      {state.meta && (
        <div
          className="animate-fade-in flex items-center gap-2 px-5 py-2 shrink-0 overflow-x-auto"
          style={{
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-surface)",
          }}
        >
          <span
            className={`font-mono text-xs font-medium rounded-sm px-2 py-px shrink-0 ${intentBadgeClass}`}
          >
            {state.meta.intent}
          </span>
          {state.meta.cached && (
            <span
              className="font-mono text-xs rounded-sm px-2 py-px shrink-0"
              style={{
                color: "var(--accent-green)",
                background: "rgba(0,255,157,0.08)",
                border: "1px solid rgba(0,255,157,0.20)",
              }}
            >
              cached
            </span>
          )}
          {state.meta.is_multi_doc && (
            <span
              className="font-mono text-xs rounded-sm px-2 py-px shrink-0"
              style={{
                color: "var(--accent-amber)",
                background: "rgba(255,179,71,0.08)",
                border: "1px solid rgba(255,179,71,0.20)",
              }}
            >
              map-reduce
            </span>
          )}
          <span
            className="font-mono text-xs truncate flex-1"
            style={{ color: "var(--text-muted)" }}
          >
            → {state.meta.rewritten_query}
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5 flex flex-col gap-4">
        {isEmpty && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-2"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                color: "var(--border-strong)",
              }}
            >
              ◈
            </div>
            <p
              className="text-base text-center max-w-[280px] leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              {suggestions.length > 0
                ? "Ask a question or try one of these:"
                : "Upload a document and ask anything about its contents."}
            </p>

            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center max-w-[560px]">
                {suggestions.slice(0, 5).map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s)}
                    className="text-left px-3 py-2 rounded-lg font-mono text-xs transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor =
                        "var(--accent-cyan)";
                      (e.currentTarget as HTMLButtonElement).style.color =
                        "var(--accent-cyan)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor =
                        "var(--border-default)";
                      (e.currentTarget as HTMLButtonElement).style.color =
                        "var(--text-secondary)";
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.id === streamingMsgIdRef.current) {
            return (
              <div key={msg.id} className="flex flex-col gap-2">
                {state.pipelineSteps.length > 0 &&
                  state.status === "streaming" &&
                  !state.content && (
                    <div
                      className="flex flex-col gap-1 px-3 py-2 rounded-lg font-mono text-xs"
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-muted)",
                        maxWidth: "320px",
                      }}
                    >
                      {state.pipelineSteps.map((step) => (
                        <div key={step.step} className="flex items-center gap-2">
                          <span
                            style={{
                              color: step.done
                                ? "var(--accent-cyan)"
                                : "var(--accent-amber)",
                            }}
                          >
                            {step.done ? "✓" : "⟳"}
                          </span>
                          <span
                            style={{
                              color: step.done
                                ? "var(--text-secondary)"
                                : "var(--text-primary)",
                            }}
                          >
                            {step.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                <MessageBubble
                  message={{
                    ...msg,
                    content: state.content,
                    sources: state.sources,
                    isStreaming: state.status === "streaming",
                  }}
                  onFeedback={onFeedback}
                />
              </div>
            );
          }
          return <MessageBubble key={msg.id || i} message={msg} onFeedback={onFeedback} />;
        })}

        <div ref={bottomRef} />
      </div>

      <div
        className="px-4 md:px-8 pb-4 pt-3 shrink-0"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        <ChatInput onSend={handleSend} disabled={isStreaming} />
        <p
          className="text-center mt-2 font-mono text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}