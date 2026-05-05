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

// ─── Theme hook ───────────────────────────────────────────────────────────────
function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    const t = saved ?? "dark";
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };
  return { theme, toggle };
}

// ─── Neural Canvas ────────────────────────────────────────────────────────────
function NeuralCanvas({ theme }: { theme: "dark" | "light" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const animRef   = useRef<number>(0);
  const mouse     = useRef({ x: -9999, y: -9999 });
  const themeRef  = useRef(theme);

  useEffect(() => { themeRef.current = theme; }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      init();
    };

    const init = () => {
      const count = Math.min(70, Math.floor((canvas.width * canvas.height) / 14000));
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
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const pts    = particles.current;
      const isDark = themeRef.current === "dark";
      const rgb    = isDark ? "0,212,255" : "0,120,160";
      const lineA  = isDark ? 0.12 : 0.06;

      pts.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.pulse += p.pulseSpeed;
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        const mdx = p.x - mouse.current.x, mdy = p.y - mouse.current.y;
        const md  = Math.sqrt(mdx * mdx + mdy * mdy);
        if (md < 100) { p.vx += (mdx / md) * 0.05; p.vy += (mdy / md) * 0.05; }
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (spd > 0.8) { p.vx *= 0.8 / spd; p.vy *= 0.8 / spd; }
      });

      // connections
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            const s = 1 - dist / 140;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(${rgb},${s * lineA})`;
            ctx.lineWidth   = s * 0.8;
            ctx.stroke();
          }
        }
      }

      pts.forEach((p) => {
        const op = p.opacity + Math.sin(p.pulse) * 0.15;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb},${op})`;
        ctx.fill();
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        g.addColorStop(0, `rgba(${rgb},${op * 0.3})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      });

      animRef.current = requestAnimationFrame(draw);
    };

    window.addEventListener("mousemove", (e) => { mouse.current = { x: e.clientX, y: e.clientY }; });
    window.addEventListener("resize", resize);
    resize();
    draw();
    return () => { cancelAnimationFrame(animRef.current); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      style={{ opacity: theme === "dark" ? 0.6 : 0.25 }}
    />
  );
}

// ─── Animated Counter ─────────────────────────────────────────────────────────
function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref     = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const tick  = (now: number) => {
          const t = Math.min((now - start) / 1800, 1);
          setCount(Math.floor((1 - Math.pow(1 - t, 3)) * target));
          if (t < 1) requestAnimationFrame(tick); else setCount(target);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target]);
  return <span ref={ref}>{count}{suffix}</span>;
}

// ─── Reveal ───────────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = "" }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const ref      = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={{
      opacity: vis ? 1 : 0,
      transform: vis ? "translateY(0)" : "translateY(20px)",
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

// ─── Pipeline steps ───────────────────────────────────────────────────────────
const STEPS = [
  { n:"01", label:"Normalize",        desc:"Whitespace stripping, lowercasing, special char removal",                                   tag:"preprocessing" },
  { n:"02", label:"Intent Detection", desc:"Groq LLM classifies query into metadata / content / comparison / summarization",            tag:"llm call"      },
  { n:"03", label:"Query Rewriting",  desc:"Groq LLM rewrites query to keyword-dense form for better chunk recall",                     tag:"llm call"      },
  { n:"04", label:"Dense Retrieval",  desc:"Gemini text-embedding-004 → Qdrant cosine search, top-20, score ≥ 0.65",                    tag:"vector search" },
  { n:"05", label:"Sparse Retrieval", desc:"BM25 keyword search on in-memory index, top-20 results",                                    tag:"bm25"          },
  { n:"06", label:"RRF Fusion",       desc:"Reciprocal Rank Fusion merges dense + sparse lists (k=60)",                                 tag:"fusion"        },
  { n:"07", label:"Reranking",        desc:"FlashRank cross-encoder reranks top-20 → top-5 locally, zero API cost",                     tag:"cross-encoder" },
  { n:"08", label:"RAG Generation",   desc:"Single-doc or Map-Reduce Groq call, streamed token-by-token via SSE",                       tag:"generation"    },
];

const TAG_STYLE: Record<string, string> = {
  "preprocessing": "text-text-muted   border-border-subtle",
  "llm call":      "text-accent-amber border-accent-amber/30",
  "vector search": "text-accent-cyan  border-accent-cyan/30",
  "bm25":          "text-accent-green border-accent-green/30",
  "fusion":        "text-accent-cyan  border-accent-cyan/30",
  "cross-encoder": "text-accent-amber border-accent-amber/30",
  "generation":    "text-accent-cyan  border-accent-cyan/30",
};

function PipelineStep({ step, index }: { step: typeof STEPS[0]; index: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Reveal delay={index * 55}>
      <div
        className={`relative flex gap-4 p-4 rounded-lg cursor-default transition-all duration-250
          ${hovered
            ? "bg-bg-elevated border border-accent-cyan/40 translate-x-1"
            : "bg-bg-surface border border-border-subtle translate-x-0"
          }`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Active bar */}
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full bg-accent-cyan transition-all duration-250 ${hovered ? "opacity-100" : "opacity-0"}`} />

        {/* Step number */}
        <div className="shrink-0 w-9 h-9 rounded-md flex items-center justify-center bg-bg-elevated border border-border-default">
          <span className="font-mono text-xs text-text-muted">{step.n}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-sans text-md font-medium text-text-primary">{step.label}</span>
            <span className={`font-mono text-2xs uppercase tracking-widest border rounded px-1.5 py-0.5 ${TAG_STYLE[step.tag]}`}>
              {step.tag}
            </span>
          </div>
          <p className="font-mono text-xs leading-relaxed text-text-secondary">{step.desc}</p>
        </div>
      </div>
    </Reveal>
  );
}

// ─── Metric card ──────────────────────────────────────────────────────────────
function MetricCard({ value, suffix, label, delay }: {
  value: number; suffix: string; label: string; delay: number;
}) {
  return (
    <Reveal delay={delay} className="flex flex-col items-center gap-2 p-6 rounded-lg text-center bg-bg-surface border border-border-subtle hover:border-border-default transition-all duration-200 hover:-translate-y-0.5">
      <div className="font-mono text-4xl font-medium text-accent-cyan">
        <Counter target={value} suffix={suffix} />
      </div>
      <div className="font-mono text-2xs uppercase tracking-widest text-text-muted">{label}</div>
    </Reveal>
  );
}

// ─── Tech badge ───────────────────────────────────────────────────────────────
const TECH = [
  { name:"FastAPI",           cat:"backend",    dot:"bg-accent-cyan"  },
  { name:"LangChain",         cat:"ingestion",  dot:"bg-accent-green" },
  { name:"Gemini Embeddings", cat:"embeddings", dot:"bg-accent-amber" },
  { name:"Groq LLaMA 3.3",   cat:"llm",        dot:"bg-accent-amber" },
  { name:"Qdrant",            cat:"vector db",  dot:"bg-accent-cyan"  },
  { name:"BM25",              cat:"sparse",     dot:"bg-accent-green" },
  { name:"FlashRank",         cat:"reranking",  dot:"bg-accent-green" },
  { name:"RRF Fusion",        cat:"retrieval",  dot:"bg-accent-cyan"  },
  { name:"PostgreSQL",        cat:"database",   dot:"bg-text-secondary"},
  { name:"Redis",             cat:"cache",      dot:"bg-text-secondary"},
  { name:"Next.js 14",        cat:"frontend",   dot:"bg-accent-cyan"  },
  { name:"SSE Streaming",     cat:"streaming",  dot:"bg-accent-green" },
];

const CAT_COLOR: Record<string, string> = {
  backend:    "text-accent-cyan",
  ingestion:  "text-accent-green",
  embeddings: "text-accent-amber",
  llm:        "text-accent-amber",
  "vector db":"text-accent-cyan",
  sparse:     "text-accent-green",
  reranking:  "text-accent-green",
  retrieval:  "text-accent-cyan",
  database:   "text-text-secondary",
  cache:      "text-text-secondary",
  frontend:   "text-accent-cyan",
  streaming:  "text-accent-green",
};

function TechBadge({ name, cat, dot, delay }: { name: string; cat: string; dot: string; delay: number }) {
  return (
    <Reveal delay={delay}>
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-bg-surface border border-border-subtle hover:border-border-default hover:-translate-y-0.5 transition-all duration-200 cursor-default">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
        <span className="font-mono text-xs text-text-primary">{name}</span>
        <span className={`font-mono text-2xs ml-auto ${CAT_COLOR[cat] ?? "text-text-muted"}`}>{cat}</span>
      </div>
    </Reveal>
  );
}

// ─── Streaming demo ───────────────────────────────────────────────────────────
const DEMO_TOKENS = "The employee handbook specifies that early departure requires prior written approval from the department manager. Requests must be submitted at least 24 hours in advance using Form HR-12. Approved departures are recorded as partial-day PTO deductions.".split(" ");

function StreamingDemo() {
  const [tokens,  setTokens]  = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [done,    setDone]    = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const run = useCallback(() => {
    if (running) return;
    setTokens([]); setDone(false); setRunning(true);
    DEMO_TOKENS.forEach((tok, i) => {
      timerRef.current = setTimeout(() => {
        setTokens((p) => [...p, tok]);
        if (i === DEMO_TOKENS.length - 1) { setRunning(false); setDone(true); }
      }, i * 60);
    });
  }, [running]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div className="rounded-lg overflow-hidden border border-border-default bg-bg-surface">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-bg-elevated border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
          <span className="font-mono text-xs text-text-muted">neural-search — live demo</span>
        </div>
        <div className="flex gap-1.5">
          {["bg-accent-red/60","bg-accent-amber/60","bg-accent-green/60"].map((c,i) => (
            <div key={i} className={`w-2.5 h-2.5 rounded-full ${c}`} />
          ))}
        </div>
      </div>

      {/* User query */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="font-mono text-2xs uppercase tracking-widest text-accent-cyan">user</span>
          <div className="h-px flex-1 bg-border-subtle" />
        </div>
        <p className="font-sans text-md text-text-primary">
          What does the handbook say about leaving work early?
        </p>
      </div>

      {/* Pipeline trace */}
      <div className="px-4 py-2 flex flex-wrap gap-2">
        {[
          { label:"intent",  val:"content",                           cls:"text-accent-cyan"  },
          { label:"rewrite", val:"employee early departure policy",    cls:"text-accent-amber" },
          { label:"chunks",  val:"5 retrieved",                        cls:"text-accent-green" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 rounded px-2 py-1 bg-bg-elevated border border-border-subtle">
            <span className="font-mono text-2xs text-text-muted">{item.label}:</span>
            <span className={`font-mono text-2xs truncate max-w-[140px] ${item.cls}`}>{item.val}</span>
          </div>
        ))}
      </div>

      {/* Assistant answer */}
      <div className="px-4 pb-4 pt-2">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="font-mono text-2xs uppercase tracking-widest text-accent-green">assistant</span>
          <div className="h-px flex-1 bg-border-subtle" />
        </div>
        <div className="font-sans text-md leading-relaxed text-text-primary min-h-[64px]">
          {tokens.length > 0 ? (
            <>
              {tokens.join(" ")}
              {!done && <span className="inline-block w-2 h-3.5 ml-0.5 bg-accent-cyan animate-blink" />}
            </>
          ) : (
            <span className="font-mono text-xs text-text-muted">
              Click &quot;Run demo&quot; to watch tokens stream →
            </span>
          )}
        </div>

        {done && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-md bg-bg-elevated border border-accent-cyan/20">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan opacity-60" />
            <span className="font-mono text-xs text-text-secondary">employee_handbook.pdf</span>
            <span className="font-mono text-2xs ml-auto text-text-muted">chunk 14 · score 0.91</span>
          </div>
        )}
      </div>

      {/* Run button */}
      <div className="px-4 pb-4">
        <button
          onClick={run}
          disabled={running}
          className="w-full py-2.5 rounded-md font-mono text-xs uppercase tracking-widest border border-accent-cyan/40 bg-accent-cyan/5 text-accent-cyan hover:bg-accent-cyan/10 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? "Streaming…" : done ? "Run again →" : "Run demo →"}
        </button>
      </div>
    </div>
  );
}

// ─── Benchmark table ──────────────────────────────────────────────────────────
const BENCH_ROWS = [
  { metric:"Recall @ 5",      score:"≥ 0.80", method:"chunk presence check",  color:"text-accent-cyan"  },
  { metric:"Faithfulness",    score:"≥ 0.85", method:"Groq LLM judge (0–1)",  color:"text-accent-green" },
  { metric:"Answer Relevancy",score:"≥ 0.75", method:"Groq LLM judge (0–1)",  color:"text-accent-amber" },
];

// ─── Nav link (hash anchor) ───────────────────────────────────────────────────
function NavAnchor({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    // eslint-disable-next-line jsx-a11y/anchor-is-valid
    <a
      href={href}
      onClick={onClick}
      className="font-mono text-xs uppercase tracking-widest text-text-muted hover:text-text-primary transition-colors duration-200"
    >
      {children}
    </a>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { theme, toggle } = useTheme();
  const [scrolled,    setScrolled]    = useState(false);
  const [mobileMenu,  setMobileMenu]  = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (mobileMenu) {
      const close = () => setMobileMenu(false);
      window.addEventListener("scroll", close, { once: true, passive: true });
    }
  }, [mobileMenu]);

  // Lock body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = mobileMenu ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenu]);

  const NAV_LINKS = [
    { href: "#pipeline",   label: "pipeline"   },
    { href: "#tech-stack", label: "tech stack" },
    { href: "#benchmark",  label: "benchmark"  },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-bg-base text-text-primary">
      <NeuralCanvas theme={theme} />

      {/* ── Navbar ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "border-b border-border-subtle bg-bg-base/90 backdrop-blur-md"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse" />
            <span className="font-mono text-sm tracking-tight text-text-primary">neural_search</span>
          </div>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((l) => <NavAnchor key={l.href} href={l.href}>{l.label}</NavAnchor>)}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Theme toggle — hidden on xs, shown sm+ */}
            <button
              onClick={toggle}
              className="hidden sm:flex items-center gap-1.5 font-mono text-xs px-2.5 py-1.5 rounded-md bg-bg-elevated border border-border-default text-text-secondary hover:text-text-primary hover:border-border-strong transition-all duration-150"
            >
              {theme === "dark" ? "☀ Light" : "☾ Dark"}
            </button>

            {/* Launch app */}
            <Link
              href="/chat"
              className="font-mono text-xs px-3 sm:px-4 py-2 rounded-md uppercase tracking-widest bg-accent-cyan text-bg-base hover:opacity-90 transition-all duration-200 font-medium"
            >
              Launch →
            </Link>

            {/* Hamburger */}
            <button
              onClick={() => setMobileMenu((v) => !v)}
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-md bg-bg-elevated border border-border-default text-text-primary hover:border-border-strong transition-all duration-150"
              aria-label="Toggle menu"
            >
              <span className="font-mono text-base leading-none">{mobileMenu ? "✕" : "☰"}</span>
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenu && (
          <div className="md:hidden border-t border-border-subtle bg-bg-surface animate-fade-in">
            <div className="px-4 py-4 flex flex-col gap-1">
              {NAV_LINKS.map((l) => (
                <NavAnchor key={l.href} href={l.href} onClick={() => setMobileMenu(false)}>
                  <span className="block py-2.5 border-b border-border-subtle last:border-0">{l.label}</span>
                </NavAnchor>
              ))}
              <button
                onClick={() => { toggle(); setMobileMenu(false); }}
                className="text-left font-mono text-xs uppercase tracking-widest text-text-muted hover:text-text-primary py-2.5 transition-colors duration-200 bg-transparent border-none cursor-pointer"
              >
                {theme === "dark" ? "☀ Light mode" : "☾ Dark mode"}
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-20 pb-10">
        {/* Badge */}
        <div
          className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 border border-accent-cyan/30 bg-accent-cyan/5"
          style={{ opacity: 0, animation: "fade-in 0.6s ease 0.1s forwards" }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-widest text-accent-cyan">
            Full-stack RAG system · 8-step pipeline
          </span>
        </div>

        {/* Headline */}
        <h1
          className="max-w-3xl text-3xl sm:text-4xl md:text-5xl font-sans font-light leading-tight mb-4 text-text-primary"
          style={{ opacity: 0, animation: "fade-in 0.7s ease 0.25s forwards" }}
        >
          Document intelligence,{" "}
          <span className="text-accent-cyan font-medium">engineered</span>
          <br className="hidden sm:block" />
          {" "}from first principles
        </h1>

        {/* Subheading */}
        <p
          className="max-w-xl font-mono text-xs sm:text-sm leading-relaxed mb-10 text-text-secondary"
          style={{ opacity: 0, animation: "fade-in 0.7s ease 0.4s forwards" }}
        >
          An 8-step RAG pipeline — hybrid dense+sparse retrieval,
          RRF fusion, cross-encoder reranking, and token-by-token SSE streaming.
          Built for production. Benchmarked with real numbers.
        </p>

        {/* CTA buttons */}
        <div
          className="flex flex-col sm:flex-row gap-3 mb-16"
          style={{ opacity: 0, animation: "fade-in 0.7s ease 0.55s forwards" }}
        >
          <Link
            href="/chat"
            className="font-mono text-xs px-6 py-3 rounded-md uppercase tracking-widest font-medium bg-accent-cyan text-bg-base hover:opacity-90 active:scale-95 transition-all duration-200"
          >
            Try live demo →
          </Link>
          <a
            href="https://github.com/poornachandran2006/neural-search-engine"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs px-6 py-3 rounded-md uppercase tracking-widest text-text-primary border border-border-default hover:border-border-strong hover:bg-bg-elevated active:scale-95 transition-all duration-200"
          >
            View on GitHub ↗
          </a>
        </div>

        {/* Live demo widget */}
        <div
          className="w-full max-w-2xl"
          style={{ opacity: 0, animation: "fade-in 0.8s ease 0.7s forwards" }}
        >
          <StreamingDemo />
        </div>

        {/* Scroll cue */}
        <div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          style={{ opacity: 0, animation: "fade-in 1s ease 1.4s forwards" }}
        >
          <span className="font-mono text-2xs uppercase tracking-widest text-text-muted">scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-accent-cyan to-transparent opacity-60" />
        </div>
      </section>

      {/* ── Metrics strip ── */}
      <section className="relative py-16 px-4 sm:px-6 border-t border-b border-border-subtle">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <MetricCard value={80}  suffix="%" label="recall @ 5"     delay={0}   />
          <MetricCard value={8}   suffix=""  label="pipeline steps" delay={100} />
          <MetricCard value={50}  suffix=""  label="eval questions" delay={200} />
          <MetricCard value={100} suffix="ms"label="rerank latency" delay={300} />
        </div>
      </section>

      {/* ── Pipeline ── */}
      <section id="pipeline" className="relative py-20 sm:py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <span className="font-mono text-xs uppercase tracking-widest text-accent-cyan">query pipeline</span>
            <h2 className="font-sans text-2xl sm:text-3xl font-light mt-2 mb-2 text-text-primary">
              8 steps. Zero shortcuts.
            </h2>
            <p className="font-mono text-xs leading-relaxed mb-10 max-w-lg text-text-secondary">
              Every query flows through intent detection, LLM rewriting, hybrid retrieval,
              RRF fusion, and cross-encoder reranking before a single token is generated.
            </p>
          </Reveal>
          <div className="grid gap-2">
            {STEPS.map((step, i) => <PipelineStep key={step.n} step={step} index={i} />)}
          </div>
        </div>
      </section>

      {/* ── Tech Stack ── */}
      <section id="tech-stack" className="relative py-20 sm:py-24 px-4 sm:px-6 border-t border-border-subtle">
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <span className="font-mono text-xs uppercase tracking-widest text-accent-cyan">tech stack</span>
            <h2 className="font-sans text-2xl sm:text-3xl font-light mt-2 mb-2 text-text-primary">
              Production-grade tooling
            </h2>
            <p className="font-mono text-xs leading-relaxed mb-10 max-w-lg text-text-secondary">
              Every library chosen for production relevance — the same stack used
              at Perplexity, Cohere, and enterprise RAG systems.
            </p>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {TECH.map((t, i) => <TechBadge key={t.name} name={t.name} cat={t.cat} dot={t.dot} delay={i * 40} />)}
          </div>
        </div>
      </section>

      {/* ── Benchmark ── */}
      <section id="benchmark" className="relative py-20 sm:py-24 px-4 sm:px-6 border-t border-border-subtle">
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <span className="font-mono text-xs uppercase tracking-widest text-accent-cyan">evaluation benchmark</span>
            <h2 className="font-sans text-2xl sm:text-3xl font-light mt-2 mb-2 text-text-primary">
              Real numbers, not demos
            </h2>
            <p className="font-mono text-xs leading-relaxed mb-10 max-w-lg text-text-secondary">
              50 manually written question-answer pairs. RAGAS-compatible metrics.
              LLM-judged faithfulness and answer relevancy scores.
            </p>
          </Reveal>

          <Reveal delay={100}>
            <div className="rounded-lg overflow-hidden border border-border-default">
              {/* Table header */}
              <div className="grid grid-cols-3 px-4 sm:px-6 py-3 bg-bg-elevated border-b border-border-subtle">
                {["Metric", "Score", "Method"].map((h) => (
                  <span key={h} className="font-mono text-xs uppercase tracking-widest text-text-muted">{h}</span>
                ))}
              </div>
              {/* Table rows */}
              {BENCH_ROWS.map((row, i) => (
                <div
                  key={row.metric}
                  className={`grid grid-cols-3 px-4 sm:px-6 py-4 bg-bg-surface hover:bg-bg-elevated transition-colors duration-200 ${i < BENCH_ROWS.length - 1 ? "border-b border-border-subtle" : ""}`}
                >
                  <span className="font-mono text-xs text-text-primary">{row.metric}</span>
                  <span className={`font-mono text-xs font-medium ${row.color}`}>{row.score}</span>
                  <span className="font-mono text-xs text-text-muted">{row.method}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative py-20 sm:py-24 px-4 sm:px-6 border-t border-border-subtle">
        <div className="max-w-2xl mx-auto text-center">
          <Reveal>
            <h2 className="font-sans text-2xl sm:text-3xl font-light mb-4 text-text-primary">
              Ready to explore the system?
            </h2>
            <p className="font-mono text-xs leading-relaxed mb-10 text-text-secondary">
              Upload a document. Ask anything. Watch the 8-step pipeline work in real time.
            </p>
            <Link
              href="/chat"
              className="inline-block font-mono text-xs px-8 py-3.5 rounded-md uppercase tracking-widest font-medium bg-accent-cyan text-bg-base hover:opacity-90 active:scale-95 transition-all duration-200"
            >
              Open the app →
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 px-4 sm:px-6 border-t border-border-subtle">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan opacity-60" />
            <span className="font-mono text-xs text-text-muted">
              neural_search_engine · Poornachandran
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-text-muted hidden sm:block">
              FastAPI · Qdrant · Groq · Gemini · Next.js
            </span>
            <button
              onClick={toggle}
              className="font-mono text-xs px-2.5 py-1 rounded-md bg-bg-elevated border border-border-default text-text-secondary hover:text-text-primary hover:border-border-strong transition-all duration-150"
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

