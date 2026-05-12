<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:00d4ff,100:6366f1&height=120&section=header&text=Neural%20Search%20Engine&fontSize=36&fontColor=ffffff&fontAlignY=40&desc=Hybrid%20Retrieval%20%E2%80%A2%20Cross-Encoder%20Reranking%20%E2%80%A2%20SSE%20Token%20Streaming%20%E2%80%A2%20LLM-Judge%20Evaluation&descSize=13&descAlignY=65" />

<br/>

<p>
  [![CI](https://github.com/poornachandran2006/neural-search-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/poornachandran2006/neural-search-engine/actions/workflows/ci.yml)
  <img src="https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white"/>
  <img src="https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi&logoColor=white"/>
  <img src="https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=nextdotjs&logoColor=white"/>
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/Qdrant-Vector_DB-DC244C?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white"/>
</p>

<p>
  <img src="https://img.shields.io/badge/Recall%20@%205-0.90-00d4aa?style=flat-square"/>
  <img src="https://img.shields.io/badge/Faithfulness-0.80-00d4aa?style=flat-square"/>
  <img src="https://img.shields.io/badge/Answer%20Relevancy-0.90-00d4aa?style=flat-square"/>
  <img src="https://img.shields.io/badge/Retrieval-Hybrid%20Dense%20%2B%20BM25-6366f1?style=flat-square"/>
  <img src="https://img.shields.io/badge/Reranking-FlashRank%20Cross--Encoder-6366f1?style=flat-square"/>
  <img src="https://img.shields.io/badge/Streaming-SSE%20Token--by--Token-6366f1?style=flat-square"/>
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square"/>
</p>

<br/>

> **A production-grade Retrieval-Augmented Generation system built from first principles.**
>
> Hybrid dense+sparse retrieval · Reciprocal Rank Fusion · Cross-encoder reranking · LLM query rewriting ·
> Map-Reduce multi-document generation · SSE token streaming · Redis caching · Per-request distributed tracing.
> Every architectural decision is grounded in the RAG literature.

<br/>

| 📄 **PDF · TXT · DOCX** | 🔍 **8-Step Pipeline** | 🧠 **Recall@5: 0.90** | ⚡ **SSE Streaming** | 🔎 **LLM-Judge Eval** |
|:---:|:---:|:---:|:---:|:---:|
| Multi-format ingestion | Normalize → Rerank | 10-question benchmark | Token-by-token to UI | Faithfulness + Relevancy |

<br/>

</div>

---

## 📋 Table of Contents

1. [What Is RAG?](#-what-is-rag)
2. [Project Overview](#-project-overview)
3. [Benchmark Results](#-benchmark-results)
4. [System Architecture](#-system-architecture)
5. [The 8-Step Query Pipeline](#-the-8-step-query-pipeline)
6. [Tech Stack](#-tech-stack)
7. [Project Structure](#-project-structure)
8. [Core Components — Deep Dive](#-core-components--deep-dive)
   - [1 · Ingestion Pipeline](#1--ingestion-pipeline)
   - [2 · Hybrid Retrieval](#2--hybrid-retrieval--dense--sparse)
   - [3 · Reciprocal Rank Fusion](#3--reciprocal-rank-fusion-rrf)
   - [4 · Cross-Encoder Reranking](#4--cross-encoder-reranking)
   - [5 · RAG Generation + Streaming](#5--rag-generation--sse-streaming)
   - [6 · Map-Reduce for Multi-Document](#6--map-reduce-for-multi-document-queries)
   - [7 · Redis Caching + PostgreSQL](#7--redis-caching--postgresql-persistence)
   - [8 · Evaluation Benchmark](#8--evaluation-benchmark)
9. [Key Engineering Decisions](#-key-engineering-decisions)
10. [SSE Event Protocol](#-sse-event-protocol)
11. [API Reference](#-api-reference)
12. [Running Locally](#-running-locally)
13. [Configuration](#-configuration)
14. [What I Learned Building This](#-what-i-learned-building-this)
15. [Author](#-author)

---

## 🌐 What Is RAG?

**Retrieval-Augmented Generation (RAG)** is the architecture used by production AI assistants at Anthropic, Google, Microsoft, and every major AI lab to answer questions grounded in real documents — not just the LLM's pre-trained weights.

The core problem: LLMs have a knowledge cutoff and hallucinate facts. RAG fixes this by retrieving relevant document chunks at query time and feeding them as context to the LLM. The model generates an answer grounded in those chunks — not from memory.

Most tutorials stop at "embed → retrieve → generate." This project goes further — implementing every component a production RAG system requires:


---

## 🎯 Project Overview

```
INPUT                      PROCESSING                              OUTPUT
─────                      ──────────                              ──────

PDF / TXT / DOCX      →    Loader → Chunker → Embedder        →   Qdrant + BM25 index
(any document)             512 tokens, 64 overlap, tiktoken        (768-dim vectors)
                                        │
                                        ▼
User Query            →    Normalize → Intent → Rewrite        →   Structured query
                           Groq LLM for intent + rewriting          with semantic context
                                        │
                                        ▼
                           Dense Retrieve + BM25 Retrieve      →   20 candidates each
                           Gemini embed → Qdrant cosine             keyword match
                                        │
                                        ▼
                           RRF Fusion → FlashRank Rerank        →   Top-5 final chunks
                           rank-based merge (k=60)                  cross-encoder scored
                                        │
                      ┌─────────────────┴──────────────────┐
                      ▼                                     ▼
              Single-Doc Query                    Multi-Doc Query
              One Groq call                       Map-Reduce:
              → stream tokens                     per-doc call → merge call
                                                  → stream tokens
                      │                                     │
                      └─────────────────┬──────────────────┘
                                        ▼
                           SSE stream to Next.js UI         →   Live token display
                           STATUS → META → tokens                with source cards
                           → SOURCES → DONE                      and pipeline status
```

---

## 📊 Benchmark Results

Evaluated on 10 manually curated question-answer pairs across 2 real documents:
- Lewis et al. (2020) — *Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks* (`2005.11401v4.pdf`)
- AI Supply Chain Control Tower system design document

| Metric | Score | Description |
|---|---|---|
| **Recall @ 5** | **0.90** | Correct chunk appears in top-5 reranked results |
| **Faithfulness** | **0.80** | Answer contains only information present in context |
| **Answer Relevancy** | **0.90** | Answer directly addresses the question asked |

All metrics computed by an LLM judge (`llama-3.3-70b-versatile` via Groq), following the RAGAS evaluation methodology. Sequential execution with exponential backoff prevents rate-limit corruption of results.

### Per-Question Breakdown

| ID | Question | Recall@5 | Faith. | Relevancy |
|---|---|:---:|:---:|:---:|
| q001 | What is retrieval augmented generation? | 1.0 | 0.5 | 1.0 |
| q002 | What retriever does RAG use? | 1.0 | 0.5 | 1.0 |
| q003 | What is the knowledge source used in RAG? | 1.0 | 1.0 | 1.0 |
| q004 | What are the two RAG formulations? | 1.0 | 1.0 | 1.0 |
| q005 | What is the supply chain control tower designed to do? | 1.0 | 1.0 | 1.0 |
| q006 | What algorithms are used for anomaly detection? | 0.0 | 1.0 | 1.0 |
| q007 | What is the four-step loop of the control tower? | 1.0 | 1.0 | 1.0 |
| q008 | What seq2seq model does RAG use as its generator? | 1.0 | 0.5 | 0.0 |
| q009 | What tasks is RAG evaluated on? | 1.0 | 0.5 | 1.0 |
| q010 | What is the API design principle for the backend? | 1.0 | 1.0 | 1.0 |
| | **Average** | **0.90** | **0.80** | **0.90** |

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INGESTION PIPELINE                           │
│                                                                     │
│  PDF / TXT / DOCX                                                   │
│       │                                                             │
│       ▼                                                             │
│  PyMuPDF / python-docx Loader                                       │
│       │                                                             │
│       ▼                                                             │
│  RecursiveCharacterTextSplitter  (512 tokens · 64 overlap · tiktoken│
│       │                                                             │
│       ▼                                                             │
│  SHA-256 Deduplication  ──► skip if already in Qdrant               │
│       │                                                             │
│       ▼                                                             │
│  Gemini text-embedding-004 (768 dims) ──► Qdrant upsert             │
│                              │                                      │
│                              ├──► BM25 index rebuild (pickle)       │
│                              ├──► PostgreSQL document record        │
│                              ├──► LLM auto-summary (3 sentences)    │
│                              └──► LLM suggestion chips (5 queries)  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          QUERY PIPELINE                             │
│                                                                     │
│  User Query  ──► NORMALIZE  ──► INTENT DETECT  ──► REWRITE          │
│                  (lowercase,     (Groq LLM)         (Groq LLM)      │
│                   strip chars)   4 classes           expanded query │
│                                                          │          │
│                   ┌──────────────────────────────────────┘          │
│                   ▼                                                 │
│  DENSE RETRIEVE ──────────────────────────────────────────────      │
│  Gemini embed → Qdrant cosine → top-20, score ≥ 0.65                │
│                                                                     │
│  SPARSE RETRIEVE ─────────────────────────────────────────────      │
│  BM25 keyword search on in-memory index → top-20                    │
│                   │                                                 │
│                   ▼                                                 │
│  RRF FUSION: score = Σ 1/(60 + rank_i) → top-20 merged              │
│                   │                                                 │
│                   ▼                                                 │
│  FLASHRANK RERANK: cross-encoder top-20 → top-5 (~100ms, local)     │
│                   │                                                 │
│       ┌───────────┴─────────────┐                                   │
│       ▼                         ▼                                   │
│  Single-Doc             Multi-Doc (comparison / summarization       │
│  One Groq call          or chunks from 2+ documents)                │
│  → stream tokens        Map: per-doc Groq call                      │
│                         Reduce: merge Groq call → stream tokens     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        SUPPORTING SYSTEMS                           │
│                                                                     │
│  Redis Cache      SHA-256(query) → full response JSON, TTL 1hr      │
│  PostgreSQL       documents · chats · messages · feedback tables    │
│  Trace ID         12-char hex UUID per request, structlog-bound     │
│  SSE Protocol     STATUS → META → tokens → SOURCES → DONE           │
│  Async Ingest     Background job with Redis progress tracking       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 The 8-Step Query Pipeline

Every user query flows through exactly 8 steps in order. Each step is its own service file with a single responsibility:

```
Step 1 — NORMALIZE          normalizer.py
─────────────────────────────────────────
Lowercase, strip special characters, collapse whitespace.
"What  does it  say about RAG??" → "what does it say about rag"

Step 2 — INTENT DETECT      intent_detector.py
──────────────────────────────────────────────
Groq LLM classifies query into one of 4 intents:
  content       → retrieve and answer from document content
  metadata      → answer about document properties (author, date, title)
  comparison    → compare two or more documents (triggers Map-Reduce)
  summarization → summarize a document (triggers Map-Reduce)

Step 3 — QUERY REWRITE      rewriter.py
────────────────────────────────────────
Groq LLM rewrites the query for better retrieval recall.
"what does it say about leaving early?"
→ "employee early departure policy procedures"

Step 4 — DENSE RETRIEVAL    dense_retriever.py
──────────────────────────────────────────────
Embed rewritten query with Gemini text-embedding-004 (768 dims).
Qdrant cosine search → top-20 results, score ≥ 0.65 threshold.

Step 5 — SPARSE RETRIEVAL   sparse_retriever.py
───────────────────────────────────────────────
BM25 keyword search on in-memory index (rebuilt after every ingest).
Returns top-20 results by BM25 score.

Step 6 — RRF FUSION         fusion.py
──────────────────────────────────────
Reciprocal Rank Fusion merges dense and sparse result lists:
  score(d) = Σ  1 / (k + rank_i(d))    where k = 60

k=60 dampens the influence of top ranks,
making the score stable even if one retriever dominates.

Step 7 — RERANK             reranker.py
────────────────────────────────────────
FlashRank cross-encoder (ms-marco-MiniLM-L-12-v2) rescores
the top-20 fused candidates with full query↔chunk attention.
Returns top-5. Runs locally in ~100ms, zero API cost.

Step 8 — GENERATE + STREAM  generator.py / map_reduce.py
──────────────────────────────────────────────────────────
Single-doc:  5 chunks → one Groq call → stream tokens via SSE
Multi-doc:   per-doc Groq summarize (map) → merge Groq call (reduce) → stream
Safety:      0 chunks above threshold → canned fallback, no hallucination
```

---

## 🛠 Tech Stack

### Backend
| Technology | Version | Role |
|---|---|---|
| Python | 3.11 | Core language |
| FastAPI | 0.111 | Async REST API, automatic OpenAPI docs |
| Uvicorn | latest | ASGI server |
| SQLAlchemy | 2.x | Async ORM |
| Alembic | latest | Database migrations |
| structlog | latest | Structured JSON logging with context binding |

### AI / ML
| Technology | Role |
|---|---|
| Groq (`llama-3.3-70b-versatile`) | Intent detection, query rewriting, RAG generation, evaluation judge |
| Google Gemini `text-embedding-004` | 768-dim dense embeddings for documents and queries |
| FlashRank (`ms-marco-MiniLM-L-12-v2`) | Local cross-encoder reranking, ~100ms, no API cost |
| rank-bm25 | BM25 sparse retrieval index |
| LangChain | Document loaders (PDF, TXT, DOCX), text splitter |
| tiktoken | Token-accurate chunking |

### Data
| Technology | Role |
|---|---|
| Qdrant | Vector database — cosine similarity search, metadata filtering |
| PostgreSQL | Chat sessions, messages, documents, feedback, analytics |
| Redis | Query result cache (TTL 1hr), ingestion job progress |

### Frontend
| Technology | Version | Role |
|---|---|---|
| Next.js | 14 (App Router) | React framework |
| TypeScript | 5 | Type safety throughout |
| Tailwind CSS | 3 | Utility-first styling |
| Server-Sent Events | — | Token-by-token streaming from backend |

### DevOps
| Technology | Role |
|---|---|
| Docker + Docker Compose | 5-container local dev environment |
| GitHub Actions | CI pipeline |

---

## 📁 Project Structure

```
neural-search-engine/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── ingest.py          ← POST /ingest, GET /ingest/status/{job_id}
│   │   │       ├── query.py           ← POST /query/stream (SSE), POST /query/pipeline
│   │   │       ├── chat.py            ← GET /chats, GET /chats/{id}/messages
│   │   │       ├── documents.py       ← GET /documents, DELETE /documents/{id}
│   │   │       └── evaluation.py      ← POST /evaluation/run, GET /evaluation/results
│   │   │
│   │   ├── core/
│   │   │   ├── config.py              ← All settings via pydantic-settings + .env
│   │   │   ├── logging.py             ← structlog setup with trace_id binding
│   │   │   └── exceptions.py         ← Custom exception hierarchy
│   │   │
│   │   ├── services/
│   │   │   ├── ingestion/
│   │   │   │   ├── loader.py          ← PDF (PyMuPDF) · TXT · DOCX loaders
│   │   │   │   ├── chunker.py         ← RecursiveCharacterTextSplitter · semantic mode
│   │   │   │   ├── embedder.py        ← Gemini text-embedding-004 with batching
│   │   │   │   └── pipeline.py        ← Orchestrates loader→chunk→embed→upsert
│   │   │   │
│   │   │   ├── retrieval/
│   │   │   │   ├── dense_retriever.py ← Gemini embed → Qdrant cosine → top-20
│   │   │   │   ├── sparse_retriever.py← BM25 index search → top-20
│   │   │   │   ├── fusion.py          ← Reciprocal Rank Fusion (k=60)
│   │   │   │   └── reranker.py        ← FlashRank cross-encoder top-20 → top-5
│   │   │   │
│   │   │   ├── query/
│   │   │   │   ├── normalizer.py      ← Lowercase, strip, trim
│   │   │   │   ├── intent_detector.py ← Groq LLM → 4 intent classes
│   │   │   │   ├── rewriter.py        ← Groq LLM → expanded query string
│   │   │   │   └── pipeline.py        ← Orchestrates all 8 steps with trace_id
│   │   │   │
│   │   │   ├── rag/
│   │   │   │   ├── prompt_builder.py  ← System prompt + context + history assembly
│   │   │   │   ├── generator.py       ← Single-doc Groq call + SSE streaming
│   │   │   │   ├── map_reduce.py      ← Map: per-doc call · Reduce: merge call
│   │   │   │   └── safety.py          ← No-context fallback (prevents hallucination)
│   │   │   │
│   │   │   └── evaluation/
│   │   │       └── benchmark.py       ← recall@5 · faithfulness judge · relevancy judge
│   │   │
│   │   ├── db/
│   │   │   ├── qdrant.py              ← Qdrant client, collection init
│   │   │   ├── postgres.py            ← SQLAlchemy async session, table init
│   │   │   └── redis_cache.py         ← Cache key generation, get/set with TTL
│   │   │
│   │   ├── models/
│   │   │   ├── orm.py                 ← SQLAlchemy ORM: Document, Chat, Message
│   │   │   ├── request.py             ← Pydantic request models
│   │   │   └── response.py            ← Pydantic response models
│   │   │
│   │   └── main.py                    ← FastAPI app, lifespan, router registration
│   │
│   ├── tests/
│   │   ├── unit/                      ← test_chunker · normalizer · intent · fusion
│   │   └── integration/               ← test_ingest_pipeline · test_query_pipeline
│   │
│   ├── alembic/versions/              ← Database migration history
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── app/
│   │   ├── (chat)/page.tsx            ← Main chat interface
│   │   ├── documents/page.tsx         ← Document upload and management
│   │   ├── evaluation/page.tsx        ← Benchmark dashboard
│   │   ├── layout.tsx                 ← Root layout, sidebar, nav
│   │   └── globals.css                ← Design token system (CSS variables)
│   │
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatWindow.tsx         ← SSE consumer, pipeline status, meta bar
│   │   │   ├── MessageBubble.tsx      ← Markdown rendering, source cards, feedback
│   │   │   ├── ChatInput.tsx          ← Textarea with keyboard shortcuts
│   │   │   └── SourceCard.tsx         ← Retrieved chunk display with score
│   │   ├── documents/
│   │   │   ├── UploadZone.tsx         ← Drag-and-drop with async progress bar
│   │   │   └── DocumentList.tsx       ← Document cards with summary + suggestions
│   │   └── evaluation/
│   │       └── BenchmarkDashboard.tsx ← Metrics display, per-question breakdown
│   │
│   ├── hooks/
│   │   ├── useChat.ts                 ← Chat session state, history management
│   │   ├── useStream.ts               ← SSE event parser and state machine
│   │   └── useDocuments.ts            ← Document CRUD, ingestion polling
│   │
│   ├── lib/
│   │   ├── api.ts                     ← Typed API client (fetch wrappers)
│   │   └── sse.ts                     ← SSE connection with STATUS/META/token parsing
│   │
│   └── types/index.ts                 ← All TypeScript interfaces
│
├── evaluation/
│   ├── dataset/questions.json         ← 10 manually written QA pairs
│   └── results/benchmark_results.json ← Latest benchmark output
│
├── infra/
│   ├── docker-compose.dev.yml         ← 5 containers: backend · frontend · qdrant · pg · redis
│   └── docker-compose.prod.yml        ← Production compose
│
├── .github/workflows/ci.yml           ← GitHub Actions CI
├── Makefile                           ← make dev · make down · make logs
└── README.md
```

---

## 🔬 Core Components — Deep Dive

### 1 · Ingestion Pipeline

**Files:** `services/ingestion/loader.py` · `chunker.py` · `embedder.py` · `pipeline.py`

Document ingestion happens in 5 stages, every stage logged with a shared trace:

#### Stage 1 — Load

```python
# PyMuPDF for PDFs (preserves page numbers for citations)
# python-docx for DOCX
# Built-in for TXT
loader = PDFLoader(file_path)   # returns List[RawChunk] with page metadata
```

#### Stage 2 — Chunk

```python
splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
    model_name     = "cl100k_base",  # same tokenizer as GPT-4
    chunk_size     = 512,            # tokens, not characters
    chunk_overlap  = 64,             # 12.5% overlap preserves context at boundaries
    separators     = ["\n\n", "\n", ". ", " ", ""]
)
```

**Why 512 tokens?** Small enough that each chunk covers one concept. Large enough that the cross-encoder has sufficient context to score relevance accurately. The 64-token overlap ensures sentences split at chunk boundaries appear in both chunks — preventing the retriever from missing a relevant passage due to boundary placement.

#### Stage 3 — Deduplicate

```python
sha256 = hashlib.sha256(chunk.text.encode()).hexdigest()
# Query Qdrant for existing hash → skip if found
# Guarantees re-ingesting the same file is always idempotent
```

#### Stage 4 — Embed + Upsert

```python
# Gemini text-embedding-004: 768 dimensions, 1,500 req/day free
# Batched: 100 chunks per API call to minimise latency
embeddings = gemini_client.embed_documents(texts, batch_size=100)
qdrant_client.upsert(collection_name="neural_search", points=points)
```

Each Qdrant point stores the full chunk text and metadata:
```json
{
  "source_file": "2005.11401v4.pdf",
  "page_number": 3,
  "chunk_index": 12,
  "sha256": "abc123...",
  "ingested_at": "2026-05-12T06:47:10Z"
}
```

#### Stage 5 — Post-Ingest Enrichment

After every ingest, two background LLM calls run concurrently:

```python
# Auto-summary: 3-sentence document description shown on document card
summary = groq_client.chat(prompt=f"Summarise this document in 3 sentences:\n{first_5_chunks}")

# Suggestion chips: 5 recommended questions shown in chat UI
suggestions = groq_client.chat(prompt=f"Generate 5 questions a user might ask about:\n{first_5_chunks}")
```

---

### 2 · Hybrid Retrieval — Dense + Sparse

**Files:** `services/retrieval/dense_retriever.py` · `sparse_retriever.py`

#### Dense Retrieval

```python
query_vector = gemini_embed(rewritten_query)   # 768-dim
results = qdrant_client.search(
    collection_name = "neural_search",
    query_vector    = query_vector,
    limit           = 20,
    score_threshold = 0.65,   # discard semantically irrelevant chunks
)
```

**Why cosine similarity?** Unit-normalised vectors make cosine similarity equivalent to dot product — semantically similar texts cluster together regardless of document length.

#### Sparse Retrieval (BM25)

```python
# BM25 index rebuilt from all chunk texts after every ingest
# Stored as a pickle file — loaded into memory at startup
bm25 = BM25Okapi(tokenized_corpus)
scores = bm25.get_scores(rewritten_query.split())
top_indices = np.argsort(scores)[::-1][:20]
```

BM25 scores are based on term frequency (TF) and inverse document frequency (IDF) — tuned by the Okapi constants k1=1.5, b=0.75. It excels at exact keyword matching even when the semantic embedding misses it.

**Why both?** Dense retrieval finds paraphrases; BM25 finds exact terms. A query for "DPR" retrieves chunks mentioning "Dense Passage Retriever" via dense vectors — and chunks containing the literal acronym "DPR" via BM25. The union is stronger than either alone.

---

### 3 · Reciprocal Rank Fusion (RRF)

**File:** `services/retrieval/fusion.py`

RRF is the mathematically principled way to merge two ranked lists with incomparable scores:

```python
def reciprocal_rank_fusion(
    dense_results: list[dict],
    sparse_results: list[dict],
    k: int = 60,
) -> list[dict]:
    scores: dict[str, float] = defaultdict(float)

    for rank, chunk in enumerate(dense_results):
        scores[chunk["id"]] += 1.0 / (k + rank + 1)

    for rank, chunk in enumerate(sparse_results):
        scores[chunk["id"]] += 1.0 / (k + rank + 1)

    sorted_ids = sorted(scores, key=scores.get, reverse=True)
    return [id_to_chunk[id] for id in sorted_ids]
```

**Why not score normalisation?** Dense cosine scores and BM25 scores are incomparable — they have different distributions, ranges, and meaning. Normalising them before adding is arbitrary. RRF uses only rank positions, which are directly comparable across any retrieval system. A chunk ranked #1 by dense and #3 by BM25 gets: `1/(60+1) + 1/(60+3) = 0.0164 + 0.0156 = 0.0320`.

**Why k=60?** This is the empirically validated default from the original RRF paper (Cormack et al., 2009). k=60 prevents the #1 result from completely dominating — a chunk ranked #2 still gets 98.4% of the score of the #1 chunk, ensuring fair fusion.

---

### 4 · Cross-Encoder Reranking

**File:** `services/retrieval/reranker.py`

```python
from flashrank import Ranker, RerankRequest

ranker = Ranker(model_name="ms-marco-MiniLM-L-12-v2")

rerank_request = RerankRequest(
    query     = rewritten_query,
    passages  = [{"id": c["id"], "text": c["text"]} for c in candidates[:20]],
)
results = ranker.rerank(rerank_request)
top_5 = results[:5]
```

**Why two-stage retrieval?** Bi-encoder retrieval (dense) encodes query and document **independently** — fast but coarse. A cross-encoder reads query + document **together**, allowing full attention between them. This captures nuanced relevance signals — word overlap, entailment, negation — that bi-encoders miss. The two-stage approach: retrieve 20 cheaply, rerank 20 accurately, return 5.

**Why FlashRank (local)?** Zero API cost. The `ms-marco-MiniLM-L-12-v2` model runs on CPU in ~100ms for 20 candidates. No data leaves the machine. The model was trained on MS MARCO passage ranking — the standard benchmark for passage reranking, used in the academic literature.

---

### 5 · RAG Generation + SSE Streaming

**Files:** `services/rag/prompt_builder.py` · `generator.py` · `safety.py`

#### Prompt Construction

```python
system_prompt = """You are a precise document assistant. Answer questions using ONLY
the provided context chunks. If the context doesn't contain the answer, say so clearly.
Always cite your sources with (Source: filename, Page N)."""

messages = [
    {"role": "system",    "content": system_prompt},
    *chat_history[-6:],   # last 3 turns for conversational memory
    {"role": "user",      "content": f"Context:\n{formatted_chunks}\n\nQuestion: {query}"}
]
```

#### SSE Streaming

```python
stream = groq_client.chat.completions.create(
    model    = "llama-3.3-70b-versatile",
    messages = messages,
    stream   = True,
    temperature = 0,   # deterministic — same query → same answer
)

async for chunk in stream:
    token = chunk.choices[0].delta.content or ""
    yield f"data: {token}\n\n"   # SSE format
```

#### Safety Fallback

```python
def has_sufficient_context(chunks, intent):
    if intent in ("summarization", "comparison"):
        return len(chunks) > 0   # any chunk is sufficient
    return any(
        float(c.get("rerank_score", 0)) >= 0.05
        for c in chunks
    )

# If False → yield canned response, no LLM call
# Prevents hallucination when the document doesn't contain the answer
```

---

### 6 · Map-Reduce for Multi-Document Queries

**File:** `services/rag/map_reduce.py`

Triggered when: intent is `comparison` or `summarization`, or when chunks from 2+ documents appear in the top-5.

```
MAP PHASE
─────────
For each document in source_files:
    chunks_for_doc = [c for c in final_chunks if c["source_file"] == doc]
    partial_answer = groq_call(query, chunks_for_doc)   ← one call per doc

REDUCE PHASE
────────────
merge_prompt = f"""
You have partial analyses of {len(docs)} documents.
{partial_answers_formatted}
Synthesise these into a single comprehensive answer.
"""
final_answer = groq_call(merge_prompt)   ← one merge call
stream_tokens(final_answer)              ← SSE to frontend
```

**Why not just stuff all chunks into one context?** With 3 documents × 5 chunks each = 15 chunks, the LLM receives ~7,500 tokens of context. LLMs exhibit "lost in the middle" attention degradation — chunks in the middle of a long context receive less attention than those at the start and end. Map-Reduce ensures each document gets its own dedicated generation pass with full attention, then the merge call synthesises the best of each.

---

### 7 · Redis Caching + PostgreSQL Persistence

**Files:** `db/redis_cache.py` · `db/postgres.py`

#### Redis Cache

```python
def make_cache_key(normalized_query: str, rewritten_query: str) -> str:
    combined = f"{normalized_query}::{rewritten_query}"
    return f"query:{hashlib.sha256(combined.encode()).hexdigest()[:14]}"

# Cache hit path:
# 1. Run pipeline (all 8 steps)
# 2. Check Redis before calling Groq
# 3. If hit → stream cached answer directly (instant)
# 4. If miss → generate → cache result → stream

# TTL = 3600 seconds (1 hour)
# Cache key includes BOTH normalized and rewritten query
# ensures cache busts when rewriting produces different output
```

#### PostgreSQL Schema

```sql
documents (
    id           UUID PRIMARY KEY,
    filename     TEXT,
    file_type    TEXT,
    chunk_count  INTEGER,
    sha256       TEXT UNIQUE,
    summary      TEXT,          -- LLM-generated 3-sentence summary
    suggestions  JSONB,         -- 5 suggested questions
    ingested_at  TIMESTAMPTZ
)

chats (
    id           UUID PRIMARY KEY,
    title        TEXT,          -- first 60 chars of first query
    created_at   TIMESTAMPTZ,
    updated_at   TIMESTAMPTZ
)

messages (
    id               UUID PRIMARY KEY,
    chat_id          UUID REFERENCES chats(id),
    role             TEXT,      -- 'user' | 'assistant'
    content          TEXT,
    sources          JSONB,     -- source chunk cards
    intent           TEXT,      -- detected intent
    latency_ms       INTEGER,
    cache_hit        BOOLEAN,
    retrieval_score  FLOAT,
    created_at       TIMESTAMPTZ
)
```

---

### 8 · Evaluation Benchmark

**File:** `services/evaluation/benchmark.py`

The benchmark runs 10 questions through the **full 8-step pipeline** — no shortcuts, no mocked retrieval:

#### Metric 1 — Recall @ 5 (deterministic)

```python
def compute_recall_at_5(chunks: list[dict], keywords: list[str]) -> float:
    for chunk in chunks[:5]:
        text = chunk["text"].lower()
        matches = sum(1 for kw in keywords if kw.lower() in text)
        if matches >= min(2, len(keywords)):
            return 1.0   # relevant chunk found in top-5
    return 0.0           # relevant chunk not retrieved
```

No LLM needed — purely deterministic keyword matching. The keywords for each question are manually written to match the ground-truth answer chunk.

#### Metric 2 — Faithfulness (LLM judge)

```python
prompt = f"""
Context (only information available to the system):
{context}

Generated answer:
{answer}

Score whether the answer contains ONLY information from the context.
1.0 = fully grounded  |  0.5 = minor unsupported additions  |  0.0 = hallucinated

Respond ONLY with JSON: {{"score": float, "reason": "one sentence"}}
"""
```

#### Metric 3 — Answer Relevancy (LLM judge)

```python
prompt = f"""
Question: {question}
Answer:   {answer}

Score how directly the answer addresses the question.
1.0 = directly and completely  |  0.5 = partially  |  0.0 = doesn't address it

Respond ONLY with JSON: {{"score": float, "reason": "one sentence"}}
"""
```

#### Rate-Limit Resilience

Questions run **sequentially** with 8-second cooldowns and exponential backoff on rate-limit errors — ensuring the benchmark completes reliably on free API tiers without corrupting results with partial data.

```python
for i, question in enumerate(questions):
    result = await evaluate_one(question)
    results.append(result)
    if i < len(questions) - 1:
        await asyncio.sleep(8.0)   # 8s cooldown between questions

# Results written ONLY after all questions complete
# Never overwrites with partial data
RESULTS_PATH.write_text(json.dumps(results, indent=2))
```

---

## ⚙️ Key Engineering Decisions

### Why Hybrid Retrieval?

Dense retrieval misses exact keyword matches; BM25 misses paraphrases. A query for "what does DPR stand for" — dense vectors find "Dense Passage Retriever" by semantics, BM25 finds chunks with the literal string "DPR". Both are needed. RRF fusion provably outperforms either alone, gaining 5–10% recall in the academic literature. This is the same approach used by Elasticsearch's hybrid search and Cohere's rerank pipeline.

### Why Cross-Encoder Reranking?

Bi-encoder retrieval is fast but coarse. Two chunks can have identical cosine similarity to the query embedding yet differ dramatically in actual relevance — because the query and document are encoded independently. A cross-encoder reads query + document together with full attention, catching negation, specificity, and paraphrase relationships that bi-encoders miss entirely. The two-stage approach (retrieve 20 cheap, rerank 20 accurate) is the industry standard.

### Why Map-Reduce for Multi-Document?

Stuffing all chunks into one context causes LLMs to "average" across documents, losing document-specific nuance and suffering from lost-in-the-middle attention degradation. Map-Reduce gives each document its own dedicated generation pass — the LLM can't conflate two documents when it only sees one at a time. The merge step then synthesises the independent analyses.

### Why Per-Request Trace IDs?

In a multi-step async pipeline with concurrent users, logs from different requests interleave and become impossible to follow. Structlog's `.bind()` creates a logger with trace_id permanently attached — every subsequent log call from that pipeline execution automatically includes the same ID without manual passing. The ID surfaces in the UI so users can copy it for debugging. This is the same pattern used by OpenTelemetry, Datadog, and Jaeger.

### Why SHA-256 Deduplication?

Re-ingesting the same document must be idempotent. SHA-256 of chunk text is content-addressed — if the content hasn't changed, the hash hasn't changed, and the chunk is skipped. This prevents duplicate vectors in Qdrant and ensures the chunk count is accurate regardless of how many times the same file is uploaded.

---

## 📡 SSE Event Protocol

The `/query/stream` endpoint returns `Content-Type: text/event-stream` with this exact sequence:

```
data: [STATUS]{"step": "normalize", "label": "Normalizing query...", "done": false}
data: [STATUS]{"step": "normalize", "label": "Query normalized",     "done": true}
data: [STATUS]{"step": "intent",    "label": "Detecting intent...",  "done": false}
data: [STATUS]{"step": "intent",    "label": "Intent: content",      "done": true}
data: [STATUS]{"step": "rewrite",   "label": "Query rewritten",      "done": true}
data: [STATUS]{"step": "retrieve",  "label": "32 candidates fused",  "done": true}
data: [STATUS]{"step": "rerank",    "label": "Top 5 chunks selected","done": true}
data: [STATUS]{"step": "generate",  "label": "Generating answer...", "done": false}

data: [META]{
  "intent":          "content",
  "rewritten_query": "retrieval augmented generation knowledge intensive NLP",
  "is_multi_doc":    false,
  "source_files":    ["2005.11401v4.pdf"],
  "chat_id":         "uuid-...",
  "cached":          false,
  "answer_confidence": "high",
  "trace_id":        "a3f8c1d2e9b4"
}

data: RAG combines pre-trained parametric
data:  and non-parametric memory for
data:  language generation...

data: [SOURCES][{"source_file": "2005.11401v4.pdf", "page_number": 1, "rerank_score": 0.9939, ...}]
data: [DONE]
```

**On cache hit:** STATUS events are omitted. Flow goes directly to `[META]` with `"cached": true` → full answer as single frame → `[SOURCES]` → `[DONE]`.

---

## 📡 API Reference

### Ingestion

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/ingest` | Upload a document. Returns `job_id` immediately. Ingestion runs in background. |
| `GET` | `/ingest/status/{job_id}` | Poll ingestion progress. Returns stage + percent complete. |
| `GET` | `/documents` | List all ingested documents with summary, suggestions, chunk count. |
| `DELETE` | `/documents/{id}` | Delete document and all its Qdrant vectors. |

**Example — ingest a PDF:**
```bash
curl -X POST http://localhost:8000/ingest \
  -F "file=@2005.11401v4.pdf"
```
```json
{
  "job_id": "6c0275dc-d646-4d4e-a2f2-d7e19b61a027",
  "status": "started",
  "message": "Ingestion running in background. Poll /ingest/status/{job_id}"
}
```

---

### Query

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/query/stream` | SSE streaming RAG endpoint. Returns `text/event-stream`. |
| `POST` | `/query/pipeline` | Debug endpoint. Returns all 8 pipeline steps as JSON without generating an answer. |

**Example — stream a query:**
```bash
curl -N -X POST http://localhost:8000/query/stream \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What retriever does RAG use?",
    "chat_id": null,
    "history": []
  }'
```

**Example — debug the pipeline:**
```bash
curl -X POST http://localhost:8000/query/pipeline \
  -H "Content-Type: application/json" \
  -d '{"query": "What is DPR?"}'
```
```json
{
  "normalized_query":  "what is dpr?",
  "rewritten_query":   "Dense Passage Retriever DPR information retrieval architecture",
  "intent":            "content",
  "confidence":        0.9,
  "is_multi_doc":      false,
  "source_files":      ["2005.11401v4.pdf"],
  "chunk_count":       5,
  "chunks": [
    {
      "source_file":  "2005.11401v4.pdf",
      "page_number":  2,
      "rerank_score": 0.9917,
      "rrf_score":    0.0164,
      "text_preview": "RAG uses a Dense Passage Retriever (DPR) to retrieve..."
    }
  ]
}
```

---

### Chat

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/chats` | List all chat sessions ordered by updated_at desc. |
| `GET` | `/chats/{id}/messages` | Full message history for a chat session. |
| `POST` | `/chats/{id}/messages/{msg_id}/feedback` | Submit thumbs up (1) or thumbs down (-1) feedback. |

---

### Evaluation

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/evaluation/run` | Trigger full benchmark. Runs in background. Returns immediately. |
| `GET` | `/evaluation/results` | Latest benchmark results (recall@5, faithfulness, relevancy + per-question). |
| `GET` | `/evaluation/analytics` | Query analytics: intent distribution, cache hit rate, avg latency, avg rerank score. |

**Example — get results:**
```bash
curl http://localhost:8000/evaluation/results
```
```json
{
  "run_at": "2026-05-12T06:53:28Z",
  "total_questions": 10,
  "documents": ["2005.11401v4.pdf", "AI_Supply_Chain_Control_Tower_Hackathon_Plan.pdf"],
  "metrics": {
    "recall_at_5":      0.90,
    "faithfulness":     0.80,
    "answer_relevancy": 0.90
  },
  "per_question": [...]
}
```

---

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Returns `{"status": "ok", "env": "development", "version": "1.0.0"}` |

---

## 🚀 Running Locally

**Prerequisites:** Docker Desktop, Git

```bash
# 1. Clone
git clone https://github.com/poornachandran2006/neural-search-engine.git
cd neural-search-engine

# 2. Configure API keys
cp backend/.env.example backend/.env
# Edit backend/.env — fill in GROQ_API_KEY and GEMINI_API_KEY

# 3. Start all 5 containers
docker compose -f infra/docker-compose.dev.yml up -d

# 4. Verify backend
curl http://localhost:8000/health
# → {"status":"ok","env":"development","version":"1.0.0"}
```

Open `http://localhost:3000` in your browser.

### Services

| Container | URL | Purpose |
|---|---|---|
| `neural_frontend` | http://localhost:3000 | Next.js UI |
| `neural_backend` | http://localhost:8000 | FastAPI + auto docs at /docs |
| `neural_qdrant` | http://localhost:6333 | Qdrant vector DB dashboard |
| `neural_postgres` | localhost:5432 | PostgreSQL (user: neural, db: neural_search) |
| `neural_redis` | localhost:6379 | Redis cache |

### Makefile Commands

```bash
make dev     # docker compose up -d (all 5 containers)
make down    # docker compose down
make logs    # follow all container logs
make rebuild # build + up backend and frontend
```

---

## ⚙️ Configuration

All values in `backend/.env` (see `backend/.env.example` for full documentation):

```bash
# ── API Keys ──────────────────────────────────────────────────────────
GROQ_API_KEY=           # console.groq.com — free, no credit card
GEMINI_API_KEY=         # aistudio.google.com — free, no credit card

# ── Database ──────────────────────────────────────────────────────────
QDRANT_URL=http://localhost:6333
DATABASE_URL=postgresql+asyncpg://neural:neural@localhost:5432/neural_search
REDIS_URL=redis://localhost:6379

# ── Retrieval ─────────────────────────────────────────────────────────
CHUNK_SIZE=512                     # tokens
CHUNK_OVERLAP=64                   # tokens (12.5% overlap)
CHUNKING_STRATEGY=recursive        # recursive | semantic
MIN_RETRIEVAL_SCORE=0.65           # Qdrant cosine score threshold
RERANKER_TOP_K=5                   # final chunks after reranking
RRF_K=60                           # RRF k constant

# ── Generation ────────────────────────────────────────────────────────
GROQ_MODEL=llama-3.3-70b-versatile
LLM_TEMPERATURE=0                  # deterministic responses

# ── Cache ─────────────────────────────────────────────────────────────
REDIS_TTL=3600                     # seconds (1 hour)
```

---

## 💡 What I Learned Building This

**RRF is not obvious.** Score normalisation across dense and sparse retrievers breaks because their score distributions are incomparable — cosine similarity and BM25 TF-IDF are not on the same scale. RRF sidesteps this entirely by using rank positions, which are comparable across any retrieval method regardless of the underlying scoring function.

**Cross-encoder placement matters.** Reranking 100 candidates is too slow on free hardware; reranking 5 loses the benefit. The retrieve-20 → rerank-to-5 sweet spot is empirically validated and documented in the FlashRank and Cohere rerank papers. Too small a candidate pool and the cross-encoder has nothing to work with; too large and latency blows up.

**Map-Reduce generation is necessary at scale.** A single context window cannot faithfully represent 3+ documents. The LLM averages across them and produces confidently wrong composite answers. Explicit document isolation at the map step and synthesis at the reduce step produces measurably better cross-document answers — and prevents the "lost in the middle" attention degradation documented in Liu et al. (2023).

**Structured logging pays off immediately.** Trace ID binding via structlog made debugging multi-step pipeline failures trivial. Without it, concurrent request logs from two simultaneous users are completely interleaved and unreadable. With it, `docker logs | grep a3f8c1d2` gives the complete isolated journey of exactly one request.

**Evaluation integrity is hard.** The benchmark failed twice — first because it ran questions in parallel hammering the Groq rate limit, second because a failed question wrote zeros to the results corrupting the averages. The fix required sequential execution with cooldowns, exponential backoff retry, and atomic result writing only after all questions complete.

---

## 👤 Author

<div align="center">

**Poornachandran· Amrita Vishwa Vidyapeetham ·
Specialising in AI Systems · RAG · Full-Stack Development

[![GitHub](https://img.shields.io/badge/GitHub-poornachandran2006-181717?style=flat-square&logo=github)](https://github.com/poornachandran2006)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?style=flat-square&logo=linkedin)](https://linkedin.com/in/poornachandran2006)

>
</div>

---

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:00d4ff,100:6366f1&height=80&section=footer" />
