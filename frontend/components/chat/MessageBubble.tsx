"use client";

import { useState } from "react";
import type { Message } from "@/types";
import { SourceCard } from "./SourceCard";

interface Props {
  message: Message;
  onFeedback?: (messageId: string, rating: 1 | -1) => void;
}

export function MessageBubble({ message, onFeedback }: Props) {
  const [showSources, setShowSources] = useState(false);
  const [feedback, setFeedback] = useState<1 | -1 | null>(null);
  const isUser     = message.role === "user";
  const hasSources = message.sources && message.sources.length > 0;

  const handleFeedback = (rating: 1 | -1) => {
    if (feedback !== null) return; // already voted
    setFeedback(rating);
    onFeedback?.(message.id, rating);
  };

  if (isUser) {
    return (
      <div className="animate-fade-in flex justify-end">
        <div
          className="max-w-[72%] rounded-2xl rounded-br-sm px-4 py-2.5 text-lg leading-relaxed"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            color: "var(--text-primary)",
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col gap-2">
      {/* Bubble */}
      <div
        className="max-w-[88%] rounded-2xl rounded-tl-sm px-4 py-3"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div className="w-6 h-0.5 rounded-full mb-2.5" style={{ background: "var(--accent-cyan)" }} />
        <div
          className={`prose-dark text-lg leading-7 ${message.isStreaming ? "streaming-cursor" : ""}`}
          style={{ color: "var(--text-primary)" }}
        >
          {message.content || (
            <span className="inline-flex gap-1 items-center h-5">
              <span className="w-1 h-1 rounded-full animate-dot-1" style={{ background: "var(--accent-cyan)" }} />
              <span className="w-1 h-1 rounded-full animate-dot-2" style={{ background: "var(--accent-cyan)" }} />
              <span className="w-1 h-1 rounded-full animate-dot-3" style={{ background: "var(--accent-cyan)" }} />
            </span>
          )}
        </div>
      </div>

      {/* Footer row — sources + feedback */}
      {!message.isStreaming && message.content && (
        <div className="pl-1 flex items-center justify-between max-w-[88%]">
          {/* Sources toggle */}
          <div>
            {hasSources && (
              <button
                onClick={() => setShowSources((v) => !v)}
                className="flex items-center gap-1.5 font-mono text-xs py-1 bg-transparent border-none cursor-pointer transition-colors duration-150"
                style={{ color: showSources ? "var(--accent-cyan)" : "var(--text-muted)" }}
              >
                <span
                  className="transition-transform duration-150"
                  style={{ display: "inline-block", transform: showSources ? "rotate(0deg)" : "rotate(-90deg)" }}
                >
                  ▾
                </span>
                {message.sources!.length} source{message.sources!.length !== 1 ? "s" : ""} retrieved
              </button>
            )}
          </div>

          {/* Feedback buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleFeedback(1)}
              disabled={feedback !== null}
              title="Good answer"
              className="w-7 h-7 rounded-md flex items-center justify-center border-none cursor-pointer transition-all duration-150 disabled:cursor-default"
              style={{
                background: feedback === 1 ? "rgba(0,255,157,0.12)" : "transparent",
                color: feedback === 1 ? "var(--accent-green)" : "var(--text-muted)",
              }}
              onMouseEnter={(e) => {
                if (feedback === null)
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--accent-green)";
              }}
              onMouseLeave={(e) => {
                if (feedback === null)
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
              }}
            >
              ↑
            </button>
            <button
              onClick={() => handleFeedback(-1)}
              disabled={feedback !== null}
              title="Bad answer"
              className="w-7 h-7 rounded-md flex items-center justify-center border-none cursor-pointer transition-all duration-150 disabled:cursor-default"
              style={{
                background: feedback === -1 ? "rgba(255,77,109,0.12)" : "transparent",
                color: feedback === -1 ? "var(--accent-red)" : "var(--text-muted)",
              }}
              onMouseEnter={(e) => {
                if (feedback === null)
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--accent-red)";
              }}
              onMouseLeave={(e) => {
                if (feedback === null)
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
              }}
            >
              ↓
            </button>
          </div>
        </div>
      )}

      {/* Sources expanded */}
      {showSources && hasSources && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2 mt-1 animate-fade-in max-w-[88%]">
          {message.sources!.map((chunk, i) => (
            <SourceCard key={i} chunk={chunk} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}