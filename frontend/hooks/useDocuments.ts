"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Document, IngestResponse } from "@/types";

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const docs = await api.documents.list();
      setDocuments(docs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const upload = useCallback(
    async (file: File): Promise<IngestResponse> => {
      setUploading(true);
      setError(null);
      try {
        const result = await api.documents.upload(file);
        await fetchDocuments(); // refresh list
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed";
        setError(msg);
        throw e;
      } finally {
        setUploading(false);
      }
    },
    [fetchDocuments]
  );

  const pollIngestionStatus = useCallback(async (jobId: string): Promise<void> => {
    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        try {
          const status = await api.ingest.status(jobId);
          if (status.status === "done" || status.status === "error") {
            clearInterval(interval);
            await fetchDocuments();
            resolve();
          }
        } catch {
          clearInterval(interval);
          resolve();
        }
      }, 1000);
    });
  }, [fetchDocuments]);

  return { documents, loading, uploading, error, upload, pollIngestionStatus, refresh: fetchDocuments };
}