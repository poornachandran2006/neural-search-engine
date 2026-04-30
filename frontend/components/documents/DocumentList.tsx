"use client";

import type { Document } from "@/types";

function FileIcon({ type }: { type: string }) {
  const colorClass =
    type === "pdf"  ? "text-accent-red  bg-accent-red/10  border-accent-red/20"
    : type === "docx" ? "text-accent-cyan bg-accent-cyan/10 border-accent-cyan/20"
    : "text-accent-amber bg-accent-amber/10 border-accent-amber/20";

  return (
    <div className={`w-7 h-7 rounded-md border flex items-center justify-center font-mono text-2xs font-semibold uppercase shrink-0 ${colorClass}`}>
      {type}
    </div>
  );
}

export function DocumentList({ documents, loading }: { documents: Document[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <span className="inline-flex gap-1.5 items-center">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-dot-1" />
          <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-dot-2" />
          <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-dot-3" />
        </span>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 font-mono text-xs text-text-muted">
        No documents ingested yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {documents.map((doc, i) => (
        <div
          key={doc.id}
          className="animate-fade-in flex items-center gap-3 px-3 py-2.5 bg-bg-elevated border border-border-subtle rounded-lg"
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          <FileIcon type={doc.file_type} />

          <div className="flex-1 min-w-0">
            <div className="text-md font-medium text-text-primary truncate">{doc.filename}</div>
            <div className="font-mono text-xs text-text-muted mt-0.5">
              {doc.chunk_count} chunks · {doc.upserted_count} new · ingested {new Date(doc.ingested_at).toLocaleDateString()}
            </div>
          </div>

          <div className="font-mono text-sm text-accent-cyan bg-accent-cyan/[0.08] border border-accent-cyan/20 rounded-sm px-2 py-px shrink-0">
            {doc.chunk_count}
          </div>
        </div>
      ))}
    </div>
  );
}