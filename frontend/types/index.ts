// ─── Message & Chat ───────────────────────────────────────────────────────────

export interface SourceChunk {
  source_file: string;
  page_number: number;
  chunk_index: number;
  rerank_score: number;
  text_preview: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceChunk[];
  created_at: string;
  isStreaming?: boolean;
}

export interface Chat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

// ─── Stream Events ────────────────────────────────────────────────────────────

export interface StreamMeta {
  intent: "content" | "metadata" | "comparison" | "summarization";
  rewritten_query: string;
  is_multi_doc: boolean;
  source_files: string[];
  chat_id?: string;
  cached?: boolean;
  answer_confidence?: "high" | "medium" | "low";
}

export interface PipelineStatus {
  step: "normalize" | "intent" | "rewrite" | "retrieve" | "rerank" | "generate";
  label: string;
  done: boolean;
}

export interface StreamState {
  status: "idle" | "streaming" | "done" | "error";
  content: string;
  meta: StreamMeta | null;
  sources: SourceChunk[];
  pipelineSteps: PipelineStatus[];
  error?: string;
}

// ─── Documents ────────────────────────────────────────────────────────────────

export interface Document {
  id: string;
  filename: string;
  file_type: string;
  chunk_count: number;
  upserted_count: number;
  skipped_count: number;
  sha256: string;
  ingested_at: string;
  suggestions: string[];
  summary: string;
}

export interface IngestResponse {
  document_id: string;
  source_file: string;
  total_chunks: number;
  upserted: number;
  skipped: number;
  sha256: string;
  message: string;
  suggestions: string[];
  summary?: string;
  job_id?: string;
  status?: string;
}

// ─── Evaluation ───────────────────────────────────────────────────────────────

export interface BenchmarkMetrics {
  recall_at_5: number;
  faithfulness: number;
  answer_relevancy: number;
}

export interface QuestionResult {
  id: string;
  question: string;
  answer: string;
  recall_at_5: number;
  faithfulness: number;
  answer_relevancy: number;
  chunks_retrieved: number;
  source_files: string[];
  intent: string;
  error?: string;
}

export interface BenchmarkResults {
  run_at: string;
  total_questions: number;
  documents: string[];
  metrics: BenchmarkMetrics;
  per_question: QuestionResult[];
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

export interface FeedbackSummary {
  thumbs_up: number;
  thumbs_down: number;
  total: number;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface AnalyticsData {
  total_queries: number;
  avg_latency_ms: number;
  avg_retrieval_score: number;
  cache_hit_rate: number;
  cache_hits: number;
  intent_distribution: Record<string, number>;
}