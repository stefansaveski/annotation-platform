"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const ArrowRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const MenuIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ParticleBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const COLORS = ["#F97316", "#F97316", "#F97316", "#4B6878", "#4B6878", "#FB923C", "#6B8FA0"];
    const particles = Array.from({ length: 110 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.55,
      vy: (Math.random() - 0.5) * 0.55,
      r: Math.random() * 3 + 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: Math.random() * 0.45 + 0.3,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 160) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(75,104,120,${(1 - dist / 160) * 0.28})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
};

const AppMockup = () => (
  <div className="relative bg-white rounded-2xl shadow-2xl shadow-gray-300/40 border border-gray-100 overflow-hidden mx-auto max-w-4xl">
    <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
      <div className="flex gap-1.5">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-yellow-400" />
        <div className="w-3 h-3 rounded-full bg-green-400" />
      </div>
      <div className="flex-1 max-w-xs mx-auto">
        <div className="h-5 bg-white rounded border border-gray-200 flex items-center px-3">
          <span className="text-[10px] text-gray-400">app.labely.ai/gallery</span>
        </div>
      </div>
    </div>
    <div className="flex" style={{ height: 280 }}>
      <div className="w-32 shrink-0 bg-white border-r border-gray-100 p-2.5 flex flex-col gap-1">
        <div className="flex items-center gap-2 px-2.5 py-1.5 mb-2">
          <Image src="/logo_final.png" alt="LabelyAI" width={20} height={20} />
          <span className="text-[11px] font-semibold text-gray-800">LabelyAI</span>
        </div>
        {["Upload", "Gallery", "Review", "Annotated"].map((label) => (
          <div
            key={label}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium ${
              label === "Gallery" ? "bg-orange-50 text-[#F97316]" : "text-gray-500"
            }`}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="flex-1 p-3 bg-[#FAFAFA] overflow-hidden">
        <div className="grid grid-cols-4 gap-2 h-full">
          <div className="col-span-2 row-span-2 relative bg-gradient-to-br from-slate-500 to-slate-700 rounded-xl overflow-hidden">
            <div className="absolute inset-0 opacity-30 bg-[repeating-linear-gradient(45deg,#fff_0px,#fff_1px,transparent_1px,transparent_8px)]" />
            <div className="absolute top-[18%] left-[12%] w-[44%] h-[48%] border-2 border-[#F97316] rounded">
              <div className="absolute -top-[18px] left-0 bg-[#F97316] text-white text-[8px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap">
                person · 0.97
              </div>
            </div>
            <div className="absolute top-[38%] right-[8%] w-[30%] h-[34%] border-2 border-[#4B6878] rounded">
              <div className="absolute -top-[18px] left-0 bg-[#4B6878] text-white text-[8px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap">
                car · 0.91
              </div>
            </div>
            <div className="absolute bottom-2 left-2 bg-black/40 text-white text-[8px] px-1.5 py-0.5 rounded">
              2 objects
            </div>
          </div>
          {["bg-slate-400", "bg-slate-500", "bg-slate-600", "bg-slate-400"].map((bg, i) => (
            <div key={i} className={`${bg} rounded-xl relative overflow-hidden`}>
              <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(45deg,#fff_0px,#fff_1px,transparent_1px,transparent_6px)]" />
              <div className={`absolute bottom-1.5 right-1.5 text-[7px] px-1 py-0.5 rounded font-semibold ${
                i % 2 === 0 ? "bg-green-100 text-green-700" : "bg-orange-100 text-[#F97316]"
              }`}>
                {i % 2 === 0 ? "Done" : "Pending"}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="w-36 shrink-0 bg-white border-l border-gray-100 p-3 hidden sm:block">
        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Annotations</p>
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-[#F97316]" />
            <span className="text-[10px] text-gray-600">Person</span>
            <span className="ml-auto text-[10px] font-semibold text-gray-400">0.97</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-[#4B6878]" />
            <span className="text-[10px] text-gray-600">Car</span>
            <span className="ml-auto text-[10px] font-semibold text-gray-400">0.91</span>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Progress</p>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full w-3/4 bg-gradient-to-r from-[#F97316] to-[#4B6878] rounded-full" />
          </div>
          <p className="text-[9px] text-gray-400 mt-1">74% annotated</p>
        </div>
      </div>
    </div>
  </div>
);

const features = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
      </svg>
    ),
    title: "AI Auto-Annotation",
    description: "SAM3-powered detection automatically detects and labels every object with confidence scores.",
    accent: "orange",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4B6878" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    title: "Instant Processing",
    description: "Annotate thousands of images in minutes. Parallel processing handles entire datasets at scale.",
    accent: "steel",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
    ),
    title: "Multi-format Export",
    description: "Export in YOLO, COCO, Pascal VOC, and more. One click, ready for any ML framework.",
    accent: "orange",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4B6878" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    title: "Smart Review Queue",
    description: "AI-curated workflow surfaces ambiguous annotations first so your review time is well spent.",
    accent: "steel",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    ),
    title: "Dataset Analytics",
    description: "Track annotation progress, class distribution, and quality metrics in real time.",
    accent: "orange",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4B6878" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 20V10" />
        <path d="M12 20V4" />
        <path d="M6 20v-6" />
      </svg>
    ),
    title: "REST API",
    description: "Full REST API for seamless integration with your existing ML training and data pipelines.",
    accent: "steel",
  },
];

const steps = [
  {
    number: "01",
    title: "Upload your dataset",
    description: "Drag and drop images or entire folders. Supports PNG, JPG, WebP, and TIFF in bulk.",
    accent: "orange" as const,
  },
  {
    number: "02",
    title: "AI annotates automatically",
    description: "Our SAM3 engine detects and labels every object, returning bounding boxes and confidence scores.",
    accent: "steel" as const,
  },
  {
    number: "03",
    title: "Review, refine & export",
    description: "Quickly approve or adjust annotations, then export in YOLO, COCO, or Pascal VOC — one click.",
    accent: "orange" as const,
  },
];

const stats = [
  { value: "10M+", label: "Images annotated" },
  { value: "5,000+", label: "ML engineers" },
  { value: "3", label: "Export formats" },
  { value: "< 5 min", label: "Setup time" },
];

export default function LandingPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md border-b border-gray-100 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center">
          <div className="flex-1 flex items-center">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/logo_final.png" alt="LabelyAI" width={36} height={36} />
              <span className="font-bold text-[17px] text-gray-900">LabelyAI</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-[14px] text-gray-600 hover:text-gray-900 transition-colors">Features</a>
            <a href="#how-it-works" className="text-[14px] text-gray-600 hover:text-gray-900 transition-colors">How it works</a>
            <a href="#pricing" className="text-[14px] text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
          </div>

          <div className="flex-1 flex items-center justify-end gap-3">
            <Link href="/login" className="hidden md:block px-4 py-2 text-[14px] font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Sign in
            </Link>
            <Link href="/register" className="hidden md:block px-5 py-2.5 bg-[#F97316] hover:bg-orange-600 text-white text-[14px] font-semibold rounded-lg transition-colors shadow-sm shadow-orange-500/20">
              Get started free
            </Link>
            <button className="md:hidden p-2 hover:bg-gray-100 rounded-lg" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-3">
            <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="block text-[15px] text-gray-600 hover:text-gray-900 py-2">Features</a>
            <a href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)} className="block text-[15px] text-gray-600 hover:text-gray-900 py-2">How it works</a>
            <a href="#pricing" onClick={() => setIsMobileMenuOpen(false)} className="block text-[15px] text-gray-600 hover:text-gray-900 py-2">Pricing</a>
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <Link href="/login" className="block w-full text-center px-4 py-2.5 text-[14px] font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Sign in</Link>
              <Link href="/register" className="block w-full text-center px-4 py-2.5 bg-[#F97316] hover:bg-orange-600 text-white text-[14px] font-semibold rounded-lg transition-colors">Get started free</Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-28 sm:pt-36 pb-16 sm:pb-24 px-4 sm:px-6">
        <ParticleBackground />
        <div className="relative max-w-6xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-50 border border-orange-100 rounded-full mb-7">
              <span className="w-1.5 h-1.5 bg-[#F97316] rounded-full animate-pulse" />
              <span className="text-[12px] font-semibold text-[#F97316] uppercase tracking-wide">SAM3-powered annotation engine</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold text-gray-900 leading-[1.1] tracking-tight mb-6">
              Label datasets{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F97316] to-[#4B6878]">
                10× faster
              </span>
              {" "}with AI
            </h1>

            <p className="text-lg sm:text-xl text-gray-500 leading-relaxed mb-10">
              Upload your images, let AI auto-annotate with SAM3, then review and export in YOLO, COCO, or Pascal VOC — in minutes, not weeks.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
              <Link
                href="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#F97316] hover:bg-orange-600 text-white text-[15px] font-semibold rounded-xl transition-colors shadow-lg shadow-orange-500/25"
              >
                Start free — no credit card
                <ArrowRightIcon />
              </Link>
              <a
                href="#how-it-works"
                className="w-full sm:w-auto px-8 py-4 border border-gray-200 text-gray-700 text-[15px] font-medium rounded-xl hover:bg-gray-50 transition-colors text-center"
              >
                See how it works
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              {["1,000 free credits on signup", "YOLO · COCO · Pascal VOC", "No setup required"].map((item) => (
                <div key={item} className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-[13px] text-gray-500">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <AppMockup />
        </div>
      </section>

      {/* Stats strip */}
      <section className="py-12 border-y border-gray-100" style={{ background: "rgba(75,104,120,0.04)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-2xl sm:text-3xl font-extrabold text-gray-900">{s.value}</div>
                <div className="text-[13px] text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 sm:py-28 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Everything your annotation workflow needs
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto text-[15px]">
              From raw images to production-ready labels — LabelyAI handles the full pipeline.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className={`p-6 rounded-2xl border transition-shadow hover:shadow-md ${
                  f.accent === "orange"
                    ? "bg-orange-50 border-orange-100"
                    : "border-[#4B6878]/10"
                }`}
                style={f.accent === "steel" ? { background: "rgba(75,104,120,0.04)" } : undefined}
              >
                <div className="w-11 h-11 rounded-xl bg-white shadow-sm flex items-center justify-center mb-5">
                  {f.icon}
                </div>
                <h3 className="text-[15px] font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-[14px] text-gray-600 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 sm:py-28 px-4 sm:px-6 bg-[#FAFAFA]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">How it works</h2>
            <p className="text-gray-500 max-w-lg mx-auto text-[15px]">
              Three steps from raw images to a production-ready annotated dataset.
            </p>
          </div>

          <div className="space-y-5">
            {steps.map((step, i) => (
              <div
                key={i}
                className="flex gap-5 items-start bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 shadow-sm"
              >
                <div
                  className="w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center font-black text-[15px] text-white"
                  style={{ background: step.accent === "orange" ? "#F97316" : "#4B6878" }}
                >
                  {step.number}
                </div>
                <div className="pt-1">
                  <h3 className="text-[17px] font-semibold text-gray-900 mb-1.5">{step.title}</h3>
                  <p className="text-[14px] text-gray-600 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="pricing" className="py-20 sm:py-28 px-4 sm:px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl p-10 sm:p-16 text-center text-white" style={{ background: "linear-gradient(135deg, #F97316 0%, #4B6878 100%)" }}>
            <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/5 pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full bg-white/5 pointer-events-none" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 border border-white/20 rounded-full mb-6">
                <span className="text-[12px] font-semibold uppercase tracking-wide">Free tier available</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
                Ready to ship better models, faster?
              </h2>
              <p className="text-white/75 mb-10 max-w-xl mx-auto text-[15px]">
                Join 5,000+ ML engineers who trust LabelyAI. Start with 1,000 free annotation credits — upgrade when you need more.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/register"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-[#F97316] text-[15px] font-semibold rounded-xl hover:bg-orange-50 transition-colors"
                >
                  Get started for free
                  <ArrowRightIcon />
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto px-8 py-4 border border-white/30 text-white text-[15px] font-medium rounded-xl hover:bg-white/10 transition-colors text-center"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-4 sm:px-6 border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo_final.png" alt="LabelyAI" width={28} height={28} />
            <span className="font-bold text-[15px] text-gray-900">LabelyAI</span>
          </Link>
          <p className="text-[13px] text-gray-400 order-3 sm:order-2">© 2026 LabelyAI. All rights reserved.</p>
          <div className="flex items-center gap-6 order-2 sm:order-3">
            <a href="#" className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors">Privacy</a>
            <a href="#" className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors">Terms</a>
            <a href="#" className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors">Contact</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
