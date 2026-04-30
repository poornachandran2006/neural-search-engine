"use client";

import type { SourceChunk } from "@/types";

interface Props {
  chunk: SourceChunk;
  index: number;
}

export function SourceCard({ chunk, index }: Props) {
  const score = Math.round(chunk.rerank_score * 100);
  const filename = chunk.source_file.replace(/\.[^.]+$/, "");

  const scoreClass =
    score >= 70 ? "text-accent-green bg-accent-green/10 border-accent-green/30"
    : score >= 40 ? "text-accent-cyan bg-accent-cyan/10 border-accent-cyan/30"
    : "text-accent-amber bg-accent-amber/10 border-accent-amber/30";

  return (
    <div
      className="animate-fade-in bg-bg-elevated border border-border-default rounded-lg p-3"
      style={{ animationDelay: `${index * 0.06}s` }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`font-mono text-2xs font-medium border rounded-sm px-1.5 py-px ${scoreClass}`}>
          {score}%
        </span>
        <span className="font-mono text-2xs text-text-muted">
          p.{chunk.page_number} · chunk {chunk.chunk_index}
        </span>
      </div>

      {/* Filename */}
      <div className="text-xs font-medium text-text-secondary mb-1 truncate">
        {filename}
      </div>

      {/* Preview */}
      <div className="font-mono text-2xs text-text-muted leading-relaxed line-clamp-2">
        {chunk.text_preview}
      </div>
    </div>
  );
}