"use client";

import { useDocuments } from "@/hooks/useDocuments";
import { Sidebar } from "@/components/layout/Sidebar";
import { UploadZone } from "@/components/documents/UploadZone";
import { DocumentList } from "@/components/documents/DocumentList";

export default function DocumentsPage() {
  const { documents, loading, uploading, upload, pollIngestionStatus } = useDocuments();
  const totalChunks = documents.reduce((s, d) => s + d.chunk_count, 0);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
      <Sidebar activePage="documents" />

      <main className="flex-1 overflow-y-auto">
        {/* Mobile top bar */}
        <div
          className="md:hidden h-12 shrink-0 flex items-center px-14 border-b sticky top-0 z-10"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
        >
          <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>Documents</span>
        </div>

        <div className="px-6 md:px-10 py-8 max-w-2xl">
          {/* Header */}
          <div className="mb-7 animate-fade-in">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
              Documents
            </h1>
            <div className="font-mono text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {documents.length} ingested · {totalChunks} total chunks in vector store
            </div>
          </div>

          {/* Upload */}
          <div className="mb-7 animate-fade-in" style={{ animationDelay: "0.05s" }}>
            <div
              className="font-mono text-xs uppercase tracking-widest mb-2.5"
              style={{ color: "var(--text-muted)" }}
            >
              Ingest new document
            </div>
            <UploadZone onUpload={upload} onPollStatus={pollIngestionStatus} uploading={uploading} />
          </div>

          {/* List */}
          <div className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <div
              className="font-mono text-xs uppercase tracking-widest mb-2.5"
              style={{ color: "var(--text-muted)" }}
            >
              Ingested documents
            </div>
            <DocumentList documents={documents} loading={loading} />
          </div>
        </div>
      </main>
    </div>
  );
}