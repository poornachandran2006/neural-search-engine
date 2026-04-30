"use client";

import { useState } from "react";
import type { Message } from "@/types";
import { SourceCard } from "./SourceCard";

interface Props { message: Message }

export function MessageBubble({ message }: Props) {
  const [showSources, setShowSources] = useState(false);
  const isUser     = message.role === "user";
  const hasSources = message.sources && message.sources.length > 0;

  if (isUser) {
    return (
      <div className="animate-fade-in flex justify-end">
        <div className="max-w-[72%] bg-bg-elevated border border-border-default rounded-2xl rounded-br-sm px-4 py-2.5 text-lg leading-relaxed text-text-primary">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col gap-2">
      {/* Bubble */}
      <div className="max-w-[88%] bg-bg-surface border border-border-subtle rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="w-6 h-0.5 bg-accent-cyan rounded-full mb-2.5" />
        <div
          className={`prose-dark text-lg leading-7 text-text-primary ${
            message.isStreaming ? "streaming-cursor" : ""
          }`}
        >
          {message.content || (
            <span className="inline-flex gap-1 items-center h-5">
              <span className="w-1 h-1 rounded-full bg-accent-cyan animate-dot-1" />
              <span className="w-1 h-1 rounded-full bg-accent-cyan animate-dot-2" />
              <span className="w-1 h-1 rounded-full bg-accent-cyan animate-dot-3" />
            </span>
          )}
        </div>
      </div>

      {/* Sources toggle */}
      {hasSources && (
        <div className="pl-1">
          <button
            onClick={() => setShowSources((v) => !v)}
            className={`flex items-center gap-1.5 font-mono text-xs py-1 bg-transparent border-none cursor-pointer transition-colors duration-150 ${
              showSources ? "text-accent-cyan" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <span>{showSources ? "▾" : "▸"}</span>
            {message.sources!.length} source{message.sources!.length !== 1 ? "s" : ""} retrieved
          </button>

          {showSources && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2 mt-2">
              {message.sources!.map((chunk, i) => (
                <SourceCard key={i} chunk={chunk} index={i} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}