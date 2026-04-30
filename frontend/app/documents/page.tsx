"use client";

import { useDocuments } from "@/hooks/useDocuments";
import { Sidebar } from "@/components/layout/Sidebar";
import { UploadZone } from "@/components/documents/UploadZone";
import { DocumentList } from "@/components/documents/DocumentList";

export default function DocumentsPage() {
  const { documents, loading, uploading, upload } = useDocuments();
  const totalChunks = documents.reduce((s, d) => s + d.chunk_count, 0);

  return (
    <div className="flex h-screen bg-bg-base">
      <Sidebar activePage="documents" />

      <main className="flex-1 overflow-y-auto px-10 py-8">
        <div className="max-w-2xl">
          {/* Header */}
          <div className="mb-7">
            <h1 className="text-2xl font-semibold text-text-primary">Documents</h1>
            <div className="font-mono text-xs text-text-muted mt-1">
              {documents.length} ingested · {totalChunks} total chunks in vector store
            </div>
          </div>

          {/* Upload */}
          <div className="mb-7">
            <div className="font-mono text-xs text-text-muted uppercase tracking-widest mb-2.5">
              Ingest new document
            </div>
            <UploadZone onUpload={upload} uploading={uploading} />
          </div>

          {/* List */}
          <div>
            <div className="font-mono text-xs text-text-muted uppercase tracking-widest mb-2.5">
              Ingested documents
            </div>
            <DocumentList documents={documents} loading={loading} />
          </div>
        </div>
      </main>
    </div>
  );
}