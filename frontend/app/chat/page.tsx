"use client";

import { useState, useCallback, useRef } from "react";
import { useChat } from "@/hooks/useChat";
import { Sidebar } from "@/components/layout/Sidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";
import type { Message } from "@/types";
import { api } from "@/lib/api";

export default function ChatPage() {
  const {
    chats,
    activeChatId,
    loadingChats,
    newChat,
    deleteChat,
    refreshChats,
    setActiveChatId,
  } = useChat();

  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const isStreamingRef = useRef(false);

  // Load history only when user clicks a chat in sidebar
  const handleSelectChat = useCallback(async (id: string) => {
    setActiveChatId(id);
    setLocalMessages([]);
    try {
      const msgs = await api.chats.messages(id);
      setLocalMessages(msgs);
    } catch (e) {
      console.error(e);
    }
  }, [setActiveChatId]);

  const handleMessageSent = useCallback((userMsg: Message, assistantMsg: Message) => {
    if (userMsg.id === "") {
      // Stream done — replace placeholder with final content
      isStreamingRef.current = false;
      setLocalMessages((prev) =>
        prev.map((m) =>
          m.isStreaming
            ? { ...m, content: assistantMsg.content, sources: assistantMsg.sources, isStreaming: false }
            : m
        )
      );
    } else {
      // New query — add optimistically right now
      isStreamingRef.current = true;
      setLocalMessages((prev) => [...prev, userMsg, assistantMsg]);
    }
  }, []);

  const handleChatCreated = useCallback((chatId: string) => {
    setActiveChatId(chatId);
    refreshChats();
  }, [setActiveChatId, refreshChats]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
      <Sidebar activePage="chat">
        <div className="px-2 py-2">
          <button
            onClick={() => { setLocalMessages([]); newChat(); }}
            className="w-full px-2.5 py-1.5 font-mono text-sm text-left rounded-md cursor-pointer transition-all duration-150"
            style={{ color: "var(--text-secondary)", background: "transparent", border: "1px dashed var(--border-default)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-default)";
            }}
          >
            + new chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {loadingChats ? (
            <div className="px-2.5 py-3 font-mono text-xs" style={{ color: "var(--text-muted)" }}>loading…</div>
          ) : chats.length === 0 ? (
            <div className="px-2.5 py-3 font-mono text-xs" style={{ color: "var(--text-muted)" }}>no chats yet</div>
          ) : (
            chats.map((chat) => (
              <div key={chat.id} className="relative mb-0.5 group">
                <button
                  onClick={() => handleSelectChat(chat.id)}
                  className="w-full px-2.5 py-1.5 pr-7 rounded-md cursor-pointer text-left text-sm truncate block transition-all duration-150"
                  style={{
                    color: activeChatId === chat.id ? "var(--text-primary)" : "var(--text-secondary)",
                    background: activeChatId === chat.id ? "rgba(0,212,255,0.06)" : "transparent",
                    border: activeChatId === chat.id ? "1px solid rgba(0,212,255,0.20)" : "1px solid transparent",
                  }}
                >
                  {chat.title}
                </button>
                <button
                  onClick={() => deleteChat(chat.id)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-xs cursor-pointer opacity-0 group-hover:opacity-100 transition-all duration-150"
                  style={{ color: "var(--text-muted)", background: "transparent", border: "none" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--accent-red)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </Sidebar>

      <main className="flex-1 overflow-hidden flex flex-col">
        <div
          className="md:hidden h-12 shrink-0 flex items-center px-14 border-b"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
        >
          <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>Neural Search Engine</span>
        </div>

        <div className="flex-1 overflow-hidden">
          <ChatWindow
            messages={localMessages}
            activeChatId={activeChatId}
            onMessageSent={handleMessageSent}
            onChatCreated={handleChatCreated}
            onStreamDone={refreshChats}
          />
        </div>
      </main>
    </div>
  );
}