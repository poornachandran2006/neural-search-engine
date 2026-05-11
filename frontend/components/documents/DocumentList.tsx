"use client";

import type { Document } from "@/types";

function FileIcon({ type }: { type: string }) {
  const styles: Record<string, { color: string; bg: string; border: string }> = {
    pdf:  { color: "var(--accent-red)",   bg: "rgba(255,77,109,0.10)",  border: "rgba(255,77,109,0.20)"  },
    docx: { color: "var(--accent-cyan)",  bg: "rgba(0,212,255,0.10)",   border: "rgba(0,212,255,0.20)"   },
    txt:  { color: "var(--accent-amber)", bg: "rgba(255,179,71,0.10)",  border: "rgba(255,179,71,0.20)"  },
  };
  const s = styles[type] ?? styles.txt;

  return (
    <div
      className="w-7 h-7 rounded-md flex items-center justify-center font-mono text-2xs font-semibold uppercase shrink-0"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
    >
      {type}
    </div>
  );
}

export function DocumentList({ documents, loading }: { documents: Document[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <span className="inline-flex gap-1.5 items-center">
          <span className="w-1.5 h-1.5 rounded-full animate-dot-1" style={{ background: "var(--accent-cyan)" }} />
          <span className="w-1.5 h-1.5 rounded-full animate-dot-2" style={{ background: "var(--accent-cyan)" }} />
          <span className="w-1.5 h-1.5 rounded-full animate-dot-3" style={{ background: "var(--accent-cyan)" }} />
        </span>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 font-mono text-xs" style={{ color: "var(--text-muted)" }}>
        No documents ingested yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {documents.map((doc, i) => (
        <div
          key={doc.id}
          className="animate-fade-in flex flex-col gap-2 px-3 py-2.5 rounded-lg transition-all duration-200 hover:scale-[1.01]"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            animationDelay: `${i * 0.05}s`,
          }}
        >
          <div className="flex items-center gap-3">
            <FileIcon type={doc.file_type} />
            <div className="flex-1 min-w-0">
              <div className="text-md font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {doc.filename}
              </div>
              <div className="font-mono text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {doc.chunk_count} chunks · {doc.upserted_count} new · ingested {new Date(doc.ingested_at).toLocaleDateString()}
              </div>
            </div>
            <div
              className="font-mono text-sm rounded-sm px-2 py-px shrink-0"
              style={{
                color: "var(--accent-cyan)",
                background: "rgba(0,212,255,0.08)",
                border: "1px solid rgba(0,212,255,0.20)",
              }}
            >
              {doc.chunk_count}
            </div>
          </div>

          {doc.summary && (
            <div
              className="font-mono text-xs leading-relaxed pl-10 pr-2"
              style={{ color: "var(--text-secondary)" }}
            >
              {doc.summary}
            </div>
          )}

          {doc.suggestions && doc.suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pl-10">
              {doc.suggestions.map((s, j) => (
                <span
                  key={j}
                  className="font-mono text-xs px-2 py-1 rounded-md"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-muted)",
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}