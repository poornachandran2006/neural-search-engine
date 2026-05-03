"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  r: number; opacity: number;
  pulse: number; pulseSpeed: number;
}

interface Connection { a: number; b: number; strength: number }

// ─── Neural Canvas ────────────────────────────────────────────────────────────
function NeuralCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const connections = useRef<Connection[]>([]);
  const animRef = useRef<number>(0);
  const mouse = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      init();
    };

    const init = () => {
      const count = Math.min(80, Math.floor((canvas.width * canvas.height) / 14000));
      particles.current = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.5 + 0.2,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.02 + 0.01,
      }));
      buildConnections();
    };

    const buildConnections = () => {
      connections.current = [];
      const pts = particles.current;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            connections.current.push({ a: i, b: j, strength: 1 - dist / 140 });
          }
        }
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const pts = particles.current;

      // Update
      pts.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.pulse += p.pulseSpeed;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        // Mouse repulsion
        const mdx = p.x - mouse.current.x;
        const mdy = p.y - mouse.current.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < 100) {
          p.vx += (mdx / mdist) * 0.05;
          p.vy += (mdy / mdist) * 0.05;
        }
        // Speed clamp
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 0.8) { p.vx *= 0.8 / speed; p.vy *= 0.8 / speed; }
      });

      // Rebuild connections periodically (every frame is fine at this scale)
      buildConnections();

      // Draw connections
      connections.current.forEach(({ a, b, strength }) => {
        const pa = pts[a]; const pb = pts[b];
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.strokeStyle = `rgba(0, 212, 255, ${strength * 0.12})`;
        ctx.lineWidth = strength * 0.8;
        ctx.stroke();
      });

      // Draw nodes
      pts.forEach((p) => {
        const pulsed = p.opacity + Math.sin(p.pulse) * 0.15;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 212, 255, ${pulsed})`;
        ctx.fill();

        // Glow
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        grd.addColorStop(0, `rgba(0, 212, 255, ${pulsed * 0.3})`);
        grd.addColorStop(1, "rgba(0, 212, 255, 0)");
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      });

      animRef.current = requestAnimationFrame(draw);
    };

    window.addEventListener("mousemove", (e) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    });

    resize();
    window.addEventListener("resize", resize);
    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.6 }}
    />
  );
}

// ─── Animated Counter ─────────────────────────────────────────────────────────
function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1800;
          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            setCount(Math.floor(eased * target));
            if (t < 1) requestAnimationFrame(tick);
            else setCount(target);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{count}{suffix}</span>;
}

// ─── Fade-in wrapper ──────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = "" }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Pipeline Step ────────────────────────────────────────────────────────────
const STEPS = [
  { n: "01", label: "Normalize", desc: "Whitespace stripping, lowercasing, special char removal", tag: "preprocessing" },
  { n: "02", label: "Intent Detection", desc: "Groq LLM classifies query into metadata / content / comparison / summarization", tag: "llm call" },
  { n: "03", label: "Query Rewriting", desc: "Groq LLM rewrites query to keyword-dense form for better chunk recall", tag: "llm call" },
  { n: "04", label: "Dense Retrieval", desc: "Gemini text-embedding-004 → Qdrant cosine search, top-20, score ≥ 0.65", tag: "vector search" },
  { n: "05", label: "Sparse Retrieval", desc: "BM25 keyword search on in-memory index, top-20 results", tag: "bm25" },
  { n: "06", label: "RRF Fusion", desc: "Reciprocal Rank Fusion merges dense + sparse lists (k=60)", tag: "fusion" },
  { n: "07", label: "Reranking", desc: "FlashRank cross-encoder reranks top-20 → top-5 locally, zero API cost", tag: "cross-encoder" },
  { n: "08", label: "RAG Generation", desc: "Single-doc or Map-Reduce Groq call, streamed token-by-token via SSE", tag: "generation" },
];

function PipelineStep({ step, index }: { step: typeof STEPS[0]; index: number }) {
  const [hovered, setHovered] = useState(false);
  const tagColors: Record<string, string> = {
    "preprocessing": "text-text-muted border-border-subtle",
    "llm call": "text-accent-amber border-accent-amber/30",
    "vector search": "text-accent-cyan border-accent-cyan/30",
    "bm25": "text-accent-green border-accent-green/30",
    "fusion": "text-accent-cyan border-accent-cyan/30",
    "cross-encoder": "text-accent-amber border-accent-amber/30",
    "generation": "text-accent-cyan border-accent-cyan/30",
  };

  return (
    <Reveal delay={index * 60}>
      <div
        className={`relative flex gap-4 p-4 border rounded-lg cursor-default transition-all duration-300 ${
          hovered
            ? "border-accent-cyan/40 bg-bg-elevated"
            : "border-border-subtle bg-bg-surface"
        }`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Step number */}
        <div className="shrink-0 w-9 h-9 rounded-md border border-border-default bg-bg-elevated flex items-center justify-center">
          <span className="font-mono text-xs text-text-muted">{step.n}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-sans text-md font-medium text-text-primary">{step.label}</span>
            <span className={`font-mono text-2xs uppercase tracking-widest border rounded px-1.5 py-0.5 ${tagColors[step.tag] ?? "text-text-muted border-border-subtle"}`}>
              {step.tag}
            </span>
          </div>
          <p className="font-mono text-xs text-text-secondary leading-relaxed">{step.desc}</p>
        </div>

        {/* Active indicator */}
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full transition-all duration-300 ${
          hovered ? "bg-accent-cyan opacity-100" : "opacity-0"
        }`} />
      </div>
    </Reveal>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({ value, suffix, label, delay }: {
  value: number; suffix: string; label: string; delay: number;
}) {
  return (
    <Reveal delay={delay} className="flex flex-col items-center gap-2 p-6 border border-border-subtle rounded-lg bg-bg-surface text-center">
      <div className="font-mono text-4xl font-medium text-accent-cyan">
        <Counter target={value} suffix={suffix} />
      </div>
      <div className="font-mono text-xs text-text-muted uppercase tracking-widest">{label}</div>
    </Reveal>
  );
}

// ─── Tech Badge ───────────────────────────────────────────────────────────────
const TECH = [
  { name: "FastAPI", cat: "backend" },
  { name: "LangChain", cat: "ingestion" },
  { name: "Gemini Embeddings", cat: "embeddings" },
  { name: "Groq LLaMA 3.3", cat: "llm" },
  { name: "Qdrant", cat: "vector db" },
  { name: "BM25", cat: "sparse" },
  { name: "FlashRank", cat: "reranking" },
  { name: "RRF Fusion", cat: "retrieval" },
  { name: "PostgreSQL", cat: "database" },
  { name: "Redis", cat: "cache" },
  { name: "Next.js 14", cat: "frontend" },
  { name: "SSE Streaming", cat: "streaming" },
];

function TechBadge({ name, cat, delay }: { name: string; cat: string; delay: number }) {
  const catColors: Record<string, string> = {
    backend: "text-accent-cyan",
    ingestion: "text-accent-green",
    embeddings: "text-accent-amber",
    llm: "text-accent-amber",
    "vector db": "text-accent-cyan",
    sparse: "text-accent-green",
    reranking: "text-accent-green",
    retrieval: "text-accent-cyan",
    database: "text-text-secondary",
    cache: "text-text-secondary",
    frontend: "text-accent-cyan",
    streaming: "text-accent-green",
  };

  return (
    <Reveal delay={delay}>
      <div className="flex items-center gap-2 px-3 py-2 border border-border-subtle rounded-md bg-bg-surface hover:border-border-default transition-colors duration-200">
        <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60" style={{ color: "inherit" }} />
        <span className="font-mono text-xs text-text-primary">{name}</span>
        <span className={`font-mono text-2xs ${catColors[cat] ?? "text-text-muted"} ml-auto`}>{cat}</span>
      </div>
    </Reveal>
  );
}

// ─── Streaming Demo ───────────────────────────────────────────────────────────
const DEMO_TOKENS = "The employee handbook specifies that early departure requires prior written approval from the department manager. Requests must be submitted at least 24 hours in advance using Form HR-12. Approved departures are recorded as partial-day PTO deductions.".split(" ");

function StreamingDemo() {
  const [tokens, setTokens] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const run = useCallback(() => {
    if (running) return;
    setTokens([]);
    setDone(false);
    setRunning(true);
    DEMO_TOKENS.forEach((tok, i) => {
      timerRef.current = setTimeout(() => {
        setTokens((prev) => [...prev, tok]);
        if (i === DEMO_TOKENS.length - 1) { setRunning(false); setDone(true); }
      }, i * 60);
    });
  }, [running]);

  useEffect(() => { return () => clearTimeout(timerRef.current); }, []);

  return (
    <div className="border border-border-default rounded-lg bg-bg-surface overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-bg-elevated">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
          <span className="font-mono text-xs text-text-muted">neural-search — live demo</span>
        </div>
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-bg-hover border border-border-subtle" />
          <div className="w-3 h-3 rounded-full bg-bg-hover border border-border-subtle" />
          <div className="w-3 h-3 rounded-full bg-bg-hover border border-border-subtle" />
        </div>
      </div>

      {/* Query */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-2xs text-accent-cyan uppercase tracking-widest">user</span>
          <div className="h-px flex-1 bg-border-subtle" />
        </div>
        <p className="font-sans text-md text-text-primary">
          What does the handbook say about leaving work early?
        </p>
      </div>

      {/* Pipeline trace */}
      <div className="px-4 py-2 flex flex-wrap gap-2">
        {[
          { label: "intent", val: "content", color: "text-accent-cyan" },
          { label: "rewrite", val: "employee early departure policy approval", color: "text-accent-amber" },
          { label: "chunks", val: "5 retrieved", color: "text-accent-green" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 bg-bg-elevated border border-border-subtle rounded px-2 py-1">
            <span className="font-mono text-2xs text-text-muted">{item.label}:</span>
            <span className={`font-mono text-2xs ${item.color} truncate max-w-[160px]`}>{item.val}</span>
          </div>
        ))}
      </div>

      {/* Answer */}
      <div className="px-4 pb-4 pt-2">
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-2xs text-accent-green uppercase tracking-widest">assistant</span>
          <div className="h-px flex-1 bg-border-subtle" />
        </div>
        <div className="font-sans text-md text-text-primary leading-relaxed min-h-[64px]">
          {tokens.length > 0 ? (
            <>
              {tokens.join(" ")}
              {!done && <span className="inline-block w-2 h-3.5 bg-accent-cyan ml-0.5 animate-blink" />}
            </>
          ) : (
            <span className="text-text-muted font-mono text-xs">Click &quot;Run demo&quot; to watch tokens stream →</span>
          )}
        </div>

        {/* Source card */}
        {done && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 border border-accent-cyan/20 rounded-md bg-bg-elevated">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan opacity-60" />
            <span className="font-mono text-xs text-text-secondary">employee_handbook.pdf</span>
            <span className="font-mono text-2xs text-text-muted ml-auto">chunk 14 · score 0.91</span>
          </div>
        )}
      </div>

      {/* Run button */}
      <div className="px-4 pb-4">
        <button
          onClick={run}
          disabled={running}
          className="w-full py-2.5 rounded-md border border-accent-cyan/40 bg-accent-cyan/5 hover:bg-accent-cyan/10 font-mono text-xs text-accent-cyan uppercase tracking-widest transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? "Streaming…" : done ? "Run again →" : "Run demo →"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-bg-base text-text-primary overflow-x-hidden">
      <NeuralCanvas />

      {/* ── Nav ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "border-b border-border-subtle bg-bg-base/90 backdrop-blur-md" : "bg-transparent"
      }`}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse" />
            <span className="font-mono text-sm text-text-primary tracking-tight">neural_search</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            {["pipeline", "tech stack", "benchmark"].map((item) => (
              <a key={item} href={`#${item.replace(" ", "-")}`}
                className="font-mono text-xs text-text-muted hover:text-text-primary transition-colors duration-200 uppercase tracking-widest">
                {item}
              </a>
            ))}
          </div>
          <Link
            href="/chat"
            className="font-mono text-xs text-bg-base bg-accent-cyan hover:bg-accent-cyan/90 px-4 py-2 rounded-md transition-colors duration-200 uppercase tracking-widest"
          >
            Launch app →
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-20">
        {/* Badge */}
        <div
          className="mb-6 inline-flex items-center gap-2 border border-accent-cyan/30 bg-accent-cyan/5 rounded-full px-4 py-1.5"
          style={{ opacity: 0, animation: "fade-in 0.6s ease 0.1s forwards" }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
          <span className="font-mono text-xs text-accent-cyan uppercase tracking-widest">
            Phase 6 complete · Full-stack RAG system
          </span>
        </div>

        {/* Headline */}
        <h1
          className="max-w-3xl text-4xl md:text-[52px] font-sans font-light leading-tight text-text-primary mb-4"
          style={{ opacity: 0, animation: "fade-in 0.7s ease 0.25s forwards" }}
        >
          Document intelligence,{" "}
          <span className="text-accent-cyan font-medium">engineered</span>
          <br />
          from first principles
        </h1>

        {/* Subheading */}
        <p
          className="max-w-xl font-mono text-sm text-text-secondary leading-relaxed mb-10"
          style={{ opacity: 0, animation: "fade-in 0.7s ease 0.4s forwards" }}
        >
          An 8-step RAG pipeline — hybrid dense+sparse retrieval,
          RRF fusion, cross-encoder reranking, and token-by-token SSE streaming.
          Built for production. Benchmarked with real numbers.
        </p>

        {/* CTA row */}
        <div
          className="flex flex-col sm:flex-row gap-3 mb-16"
          style={{ opacity: 0, animation: "fade-in 0.7s ease 0.55s forwards" }}
        >
          <Link
            href="/chat"
            className="font-mono text-xs text-bg-base bg-accent-cyan hover:bg-accent-cyan/90 px-6 py-3 rounded-md transition-colors duration-200 uppercase tracking-widest"
          >
            Try live demo →
          </Link>
          <a
            href="https://github.com/poornachandran2006/neural-search-engine"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-text-primary border border-border-default hover:border-border-strong px-6 py-3 rounded-md transition-colors duration-200 uppercase tracking-widest"
          >
            View on GitHub ↗
          </a>
        </div>

        {/* Streaming demo */}
        <div
          className="w-full max-w-2xl"
          style={{ opacity: 0, animation: "fade-in 0.8s ease 0.7s forwards" }}
        >
          <StreamingDemo />
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          style={{ opacity: 0, animation: "fade-in 1s ease 1.4s forwards" }}>
          <span className="font-mono text-2xs text-text-muted uppercase tracking-widest">scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-accent-cyan/60 to-transparent" />
        </div>
      </section>

      {/* ── Metrics ── */}
      <section className="relative py-20 px-6 border-y border-border-subtle">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard value={80} suffix="%" label="recall @ 5" delay={0} />
          <MetricCard value={8} suffix="" label="pipeline steps" delay={100} />
          <MetricCard value={50} suffix="" label="eval questions" delay={200} />
          <MetricCard value={100} suffix="ms" label="rerank latency" delay={300} />
        </div>
      </section>

      {/* ── Pipeline ── */}
      <section id="pipeline" className="relative py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <div className="mb-3">
              <span className="font-mono text-xs text-accent-cyan uppercase tracking-widest">query pipeline</span>
            </div>
            <h2 className="font-sans text-3xl font-light text-text-primary mb-2">
              8 steps. Zero shortcuts.
            </h2>
            <p className="font-mono text-xs text-text-secondary mb-12 max-w-lg leading-relaxed">
              Every query flows through intent detection, LLM rewriting, hybrid retrieval,
              RRF fusion, and cross-encoder reranking before a single token is generated.
            </p>
          </Reveal>

          <div className="grid gap-2">
            {STEPS.map((step, i) => (
              <PipelineStep key={step.n} step={step} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech Stack ── */}
      <section id="tech-stack" className="relative py-24 px-6 border-t border-border-subtle">
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <div className="mb-3">
              <span className="font-mono text-xs text-accent-cyan uppercase tracking-widest">tech stack</span>
            </div>
            <h2 className="font-sans text-3xl font-light text-text-primary mb-2">
              Production-grade tooling
            </h2>
            <p className="font-mono text-xs text-text-secondary mb-12 max-w-lg leading-relaxed">
              Every library chosen for production relevance — the same stack used
              at Perplexity, Cohere, and enterprise RAG systems.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {TECH.map((t, i) => (
              <TechBadge key={t.name} name={t.name} cat={t.cat} delay={i * 40} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Benchmark ── */}
      <section id="benchmark" className="relative py-24 px-6 border-t border-border-subtle">
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <div className="mb-3">
              <span className="font-mono text-xs text-accent-cyan uppercase tracking-widest">evaluation benchmark</span>
            </div>
            <h2 className="font-sans text-3xl font-light text-text-primary mb-2">
              Real numbers, not demos
            </h2>
            <p className="font-mono text-xs text-text-secondary mb-12 max-w-lg leading-relaxed">
              50 manually written question-answer pairs. RAGAS-compatible metrics.
              LLM-judged faithfulness and answer relevancy scores.
            </p>
          </Reveal>

          <Reveal delay={100}>
            <div className="border border-border-default rounded-lg overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-3 px-6 py-3 bg-bg-elevated border-b border-border-subtle">
                {["Metric", "Score", "Method"].map((h) => (
                  <span key={h} className="font-mono text-xs text-text-muted uppercase tracking-widest">{h}</span>
                ))}
              </div>
              {/* Rows */}
              {[
                { metric: "Recall @ 5", score: "≥ 0.80", method: "chunk presence check", accent: "text-accent-cyan" },
                { metric: "Faithfulness", score: "≥ 0.85", method: "Groq LLM judge (0–1)", accent: "text-accent-green" },
                { metric: "Answer Relevancy", score: "≥ 0.75", method: "Groq LLM judge (0–1)", accent: "text-accent-amber" },
              ].map((row, i) => (
                <div key={row.metric}
                  className={`grid grid-cols-3 px-6 py-4 ${i < 2 ? "border-b border-border-subtle" : ""} hover:bg-bg-elevated transition-colors duration-200`}>
                  <span className="font-mono text-xs text-text-primary">{row.metric}</span>
                  <span className={`font-mono text-xs font-medium ${row.accent}`}>{row.score}</span>
                  <span className="font-mono text-xs text-text-muted">{row.method}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative py-24 px-6 border-t border-border-subtle">
        <div className="max-w-2xl mx-auto text-center">
          <Reveal>
            <h2 className="font-sans text-3xl font-light text-text-primary mb-4">
              Ready to explore the system?
            </h2>
            <p className="font-mono text-xs text-text-secondary leading-relaxed mb-10">
              Upload a document. Ask anything. Watch the 8-step pipeline work in real time.
            </p>
            <Link
              href="/chat"
              className="inline-block font-mono text-xs text-bg-base bg-accent-cyan hover:bg-accent-cyan/90 px-8 py-3.5 rounded-md transition-colors duration-200 uppercase tracking-widest"
            >
              Open the app →
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border-subtle py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan opacity-60" />
            <span className="font-mono text-xs text-text-muted">neural_search_engine · Poornachandran</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="font-mono text-xs text-text-muted">FastAPI · Qdrant · Groq · Gemini · Next.js</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
