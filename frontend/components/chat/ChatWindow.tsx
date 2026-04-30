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
}

export function ChatWindow({ messages, activeChatId, onMessageSent, onChatCreated, onStreamDone }: Props) {
  const { state, send } = useStream();
  const bottomRef          = useRef<HTMLDivElement>(null);
  const isStreaming        = state.status === "streaming";
  const streamDoneFiredRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, state.content]);

  useEffect(() => {
    if (state.status === "done" && state.content && !streamDoneFiredRef.current) {
      streamDoneFiredRef.current = true;
      if (state.meta?.chat_id && state.meta.chat_id !== activeChatId) {
        onChatCreated(state.meta.chat_id);
      }
      onStreamDone();
      onMessageSent(
        { id: "", role: "user", content: "", created_at: "" },
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: state.content,
          sources: state.sources,
          created_at: new Date().toISOString(),
        }
      );
    }
  }, [state.status]); // eslint-disable-line

  const handleSend = (query: string) => {
    streamDoneFiredRef.current = false;
    onMessageSent(
      { id: crypto.randomUUID(), role: "user",      content: query, created_at: new Date().toISOString() },
      { id: crypto.randomUUID(), role: "assistant", content: "",    created_at: new Date().toISOString(), isStreaming: true }
    );
    send(query, activeChatId ?? undefined);
  };

  const intentBadgeClass = state.meta ? `badge-${state.meta.intent}` : "";

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Meta bar */}
      {state.meta && (
        <div className="animate-fade-in flex items-center gap-2 px-5 py-2 border-b border-border-subtle bg-bg-surface shrink-0 overflow-hidden">
          <span className={`font-mono text-xs font-medium rounded-sm px-2 py-px ${intentBadgeClass}`}>
            {state.meta.intent}
          </span>
          {state.meta.cached && (
            <span className="font-mono text-xs text-accent-green bg-accent-green/[0.08] border border-accent-green/20 rounded-sm px-2 py-px">
              cached
            </span>
          )}
          {state.meta.is_multi_doc && (
            <span className="font-mono text-xs text-accent-amber bg-accent-amber/[0.08] border border-accent-amber/20 rounded-sm px-2 py-px">
              map-reduce
            </span>
          )}
          <span className="font-mono text-xs text-text-muted truncate flex-1">
            → {state.meta.rewritten_query}
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
        {messages.length === 0 && !isStreaming && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted">
            <div className="font-mono text-3xl text-border-strong">◈</div>
            <p className="text-base text-center max-w-[280px] leading-relaxed">
              Upload a document and ask anything about its contents.
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.isStreaming && (state.status === "streaming" || state.status === "done")) {
            return (
              <MessageBubble
                key={msg.id}
                message={{ ...msg, content: state.content, sources: state.sources, isStreaming: state.status === "streaming" }}
              />
            );
          }
          return <MessageBubble key={msg.id || i} message={msg} />;
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-5 pb-4 pt-3 border-t border-border-subtle shrink-0">
        <ChatInput onSend={handleSend} disabled={isStreaming} />
        <p className="text-center mt-2 font-mono text-xs text-text-muted">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}