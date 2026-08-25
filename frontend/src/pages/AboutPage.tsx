import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  LockKeyhole,
  Sparkles,
  Code2,
  GitBranch,
  Layers3,
  Database,
  Globe2,
  Cpu,
  FileText,
  Languages,
  FileArchive,
  FileSpreadsheet,
  Image as ImageIcon,
  FileOutput,
  Zap,
  RotateCw,
  Layout,
  WandSparkles,
  Palette,
  Grid3X3,
  Cloud,
  HeartHandshake,
  Info,
  Scale,
  MousePointer2,
  X,
} from "lucide-react";

/* =========================================================
   TYPES
========================================================= */

interface ToolItem {
  name: string;
  description: string;
  icon: React.ElementType;
}

interface ToolCategory {
  category: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  tools: ToolItem[];
}

interface InfoModalState {
  type: "privacy" | "terms" | "security" | null;
}

/* =========================================================
   TOOL DATA
========================================================= */

const toolCategories: ToolCategory[] = [
  {
    category: "PDF Tools",
    icon: FileArchive,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    tools: [
      {
        name: "PDF Merge",
        description: "Combine multiple PDF files into one document.",
        icon: FileArchive,
      },
      {
        name: "PDF Split",
        description: "Extract or remove selected PDF pages easily.",
        icon: GitBranch,
      },
      {
        name: "Compress PDF",
        description: "Reduce PDF size while keeping useful quality.",
        icon: Zap,
      },
      {
        name: "Rotate PDF",
        description: "Rotate all or selected pages in a PDF.",
        icon: RotateCw,
      },
      {
        name: "Organize PDF",
        description: "Rearrange and organize PDF pages.",
        icon: Layout,
      },
      {
        name: "Watermark PDF",
        description: "Add custom text watermarks to your PDF.",
        icon: WandSparkles,
      },
      {
        name: "PDF Color Enhance",
        description: "Improve readability and visual quality.",
        icon: Palette,
      },
    ],
  },
  {
    category: "Image Tools",
    icon: ImageIcon,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-100 dark:bg-purple-900/30",
    tools: [
      {
        name: "Image Merge",
        description: "Join multiple images into a single image.",
        icon: ImageIcon,
      },
      {
        name: "Image to PDF",
        description: "Convert images into clean PDF documents.",
        icon: FileOutput,
      },
      {
        name: "Image Converter",
        description: "Convert images between popular formats.",
        icon: ImageIcon,
      },
      {
        name: "N-up PDF",
        description: "Place multiple pages or images on one sheet.",
        icon: Grid3X3,
      },
    ],
  },
  {
    category: "Document Tools",
    icon: FileText,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-100 dark:bg-orange-900/30",
    tools: [
      {
        name: "Word Merge",
        description: "Combine multiple Word documents into one.",
        icon: FileText,
      },
      {
        name: "PDF to Word",
        description: "Convert PDF content into editable Word files.",
        icon: FileOutput,
      },
      {
        name: "Word to PDF",
        description: "Convert Word documents into PDF format.",
        icon: FileText,
      },
      {
        name: "PDF to Excel",
        description: "Extract PDF tables and text into Excel.",
        icon: FileSpreadsheet,
      },
      {
        name: "Excel to PDF",
        description: "Turn Excel spreadsheets into polished PDFs.",
        icon: FileSpreadsheet,
      },
    ],
  },
];

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function AboutPage() {
  const [modal, setModal] = useState<InfoModalState>({
    type: null,
  });

  const techStack = useMemo(
    () => [
      {
        name: "React",
        icon: Code2,
        description:
          "Modern component-based frontend architecture.",
      },
      {
        name: "Tailwind CSS",
        icon: Layers3,
        description:
          "Responsive utility-first interface styling.",
      },
      {
        name: "Django",
        icon: Database,
        description:
          "Backend APIs, authentication and processing.",
      },
      {
        name: "REST API",
        icon: Globe2,
        description:
          "Structured communication between client and server.",
      },
      {
        name: "Python",
        icon: Cpu,
        description:
          "Document, PDF and conversion processing.",
      },
      {
        name: "MySQL / Database",
        icon: Database,
        description:
          "Persistent user and application data.",
      },
    ],
    []
  );

  const closeModal = () => {
    setModal({ type: null });
  };

  const modalData = {
    privacy: {
      title: "Privacy",
      icon: LockKeyhole,
      text: "Your Quill account activity is associated with your authenticated account so your history and generated data can remain connected to your profile.",
    },
    terms: {
      title: "Terms",
      icon: Scale,
      text: "Quill is designed as a productivity and document-processing platform. Use the available tools responsibly and only with content you are authorized to process.",
    },
    security: {
      title: "Security",
      icon: ShieldCheck,
      text: "Authenticated API endpoints are used for user-specific operations, while generated files and history are kept associated with the relevant account.",
    },
  } as const;

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-white">
      {/* =====================================================
          BACKGROUND
      ===================================================== */}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[8%] top-[6%] h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute right-[5%] top-[26%] h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute bottom-[5%] left-[30%] h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <main className="relative mx-auto w-full max-w-[1320px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        {/* =====================================================
            HERO
        ===================================================== */}

        <section className="mx-auto max-w-5xl">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/60 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/55 sm:p-8 md:p-10">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl" />

            <div className="relative flex flex-col items-center text-center">
              {/* LOGO */}
              <div className="mb-5 flex items-center justify-center">
                <div className="rounded-3xl border border-white/70 bg-white/70 p-3 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                  <img
                    src="/quill_logo.png"
                    alt="quill"
                    className="h-16 w-16 object-contain sm:h-20 sm:w-20"
                  />
                </div>
              </div>

              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50/70 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700 backdrop-blur-xl dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300">
                <Sparkles className="h-3.5 w-3.5" />
                About Quill
              </div>

              <h1 className="max-w-3xl text-3xl font-black tracking-tight text-slate-900 sm:text-4xl md:text-5xl dark:text-white">
                One place for{" "}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  translation, tools & documents.
                </span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base dark:text-slate-300">
                Quill brings language translation, PDF utilities,
                document conversion and productivity tools together in one
                modern workspace.
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px]">
                <span className="rounded-full border border-slate-200 bg-white/75 px-3 py-1.5 font-semibold text-slate-600 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                  Fast
                </span>

                <span className="rounded-full border border-slate-200 bg-white/75 px-3 py-1.5 font-semibold text-slate-600 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                  Account-based
                </span>

                <span className="rounded-full border border-slate-200 bg-white/75 px-3 py-1.5 font-semibold text-slate-600 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                  Multi-tool
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================
            FEATURES
        ===================================================== */}

        <section className="mx-auto mt-8 max-w-6xl">
          <div className="mb-4 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
              Features
            </p>

            <h2 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">
              Everything in one workspace
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Translation",
                text: "Text and speech translation workflows.",
                icon: Languages,
              },
              {
                title: "PDF & Files",
                text: "Merge, split, compress and convert files.",
                icon: FileArchive,
              },
              {
                title: "Documents",
                text: "Upload, process and translate documents.",
                icon: FileText,
              },
              {
                title: "History",
                text: "Keep account activity connected in one timeline.",
                icon: CheckCircle2,
              },
            ].map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-sm backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                      <Icon className="h-5 w-5" />
                    </div>

                    <div>
                      <h3 className="text-sm font-bold">
                        {feature.title}
                      </h3>

                      <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                        {feature.text}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* =====================================================
            TOOLS — STAGGERED AUTO MARQUEE
        ===================================================== */}

        <section className="mx-auto mt-9 max-w-6xl">
          <div className="mb-5 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-purple-600 dark:text-purple-400">
              Tools
            </p>

            <h2 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">
              Built for everyday file work
            </h2>

            <p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-slate-500 dark:text-slate-400">
              Different tool lanes move independently so the section feels
              dynamic instead of looking like a static card grid.
            </p>
          </div>

          <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/40 py-5 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/30">
            {/* LEFT FADE */}
            <div className="pointer-events-none absolute left-0 top-0 z-20 h-full w-16 bg-gradient-to-r from-slate-50 via-slate-50/80 to-transparent dark:from-slate-950 dark:via-slate-950/80" />

            {/* RIGHT FADE */}
            <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-16 bg-gradient-to-l from-slate-50 via-slate-50/80 to-transparent dark:from-slate-950 dark:via-slate-950/80" />

            <div className="space-y-5">
              {toolCategories.map((category, categoryIndex) => {
                const CategoryIcon = category.icon;
                const reverse = categoryIndex % 2 !== 0;

                return (
                  <div key={category.category} className="relative">
                    {/* CATEGORY LABEL */}
                    <div className="mb-2 flex items-center justify-center gap-2 px-4">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-lg ${category.bg}`}
                      >
                        <CategoryIcon
                          className={`h-3.5 w-3.5 ${category.color}`}
                        />
                      </div>

                      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        {category.category}
                      </span>
                    </div>

                    {/* MARQUEE */}
                    <div className="overflow-hidden">
                      <div
                        className={`flex w-max gap-3 ${
                          reverse
                            ? "animate-marquee-right"
                            : "animate-marquee-left"
                        }`}
                      >
                        {[
                          ...category.tools,
                          ...category.tools,
                          ...category.tools,
                        ].map((tool, index) => {
                          const ToolIcon = tool.icon;

                          return (
                            <div
                              key={`${category.category}-${tool.name}-${index}`}
                              className="group w-[235px] shrink-0 rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-blue-700"
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${category.bg}`}
                                >
                                  <ToolIcon
                                    className={`h-5 w-5 ${category.color}`}
                                  />
                                </div>

                                <div className="min-w-0">
                                  <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                                    {tool.name}
                                  </h3>

                                  <p className="mt-1 line-clamp-2 text-[10px] leading-5 text-slate-500 dark:text-slate-400">
                                    {tool.description}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* =====================================================
            TECHNOLOGY
        ===================================================== */}

        <section className="mx-auto mt-9 max-w-5xl">
          <div className="mb-5 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400">
              Technology
            </p>

            <h2 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">
              How Quill is built
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {techStack.map((tech) => {
              const Icon = tech.icon;

              return (
                <div
                  key={tech.name}
                  className="group rounded-2xl border border-slate-200/80 bg-white/65 p-4 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/55"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      <Icon className="h-5 w-5" />
                    </div>

                    <div>
                      <h3 className="text-sm font-bold">{tech.name}</h3>

                      <p className="mt-1 text-[10px] leading-5 text-slate-500 dark:text-slate-400">
                        {tech.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* =====================================================
            PLATFORM FLOW
        ===================================================== */}

        <section className="mx-auto mt-9 max-w-5xl">
          <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/65 p-5 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/55 sm:p-6">
            <div className="mb-5 text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
                Workflow
              </p>

              <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                Simple from start to finish
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              {[
                {
                  number: "01",
                  title: "Choose",
                  text: "Select the tool or workflow you need.",
                  icon: MousePointer2,
                },
                {
                  number: "02",
                  title: "Upload",
                  text: "Add your text, document, PDF or image.",
                  icon: Cloud,
                },
                {
                  number: "03",
                  title: "Process",
                  text: "quill handles the selected operation.",
                  icon: Cpu,
                },
                {
                  number: "04",
                  title: "Use",
                  text: "Download the result or continue working.",
                  icon: CheckCircle2,
                },
              ].map((step) => {
                const Icon = step.icon;

                return (
                  <div
                    key={step.number}
                    className="relative rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black tracking-widest text-blue-600 dark:text-blue-400">
                        {step.number}
                      </span>

                      <Icon className="h-4 w-4 text-slate-400" />
                    </div>

                    <h3 className="mt-4 text-sm font-bold">{step.title}</h3>

                    <p className="mt-1 text-[10px] leading-5 text-slate-500 dark:text-slate-400">
                      {step.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* =====================================================
            ACCOUNT / SECURITY
        ===================================================== */}

        <section className="mx-auto mt-9 max-w-5xl">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={() => setModal({ type: "privacy" })}
              className="group rounded-2xl border border-slate-200/80 bg-white/65 p-5 text-left backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/55"
            >
              <LockKeyhole className="h-5 w-5 text-blue-600 dark:text-blue-400" />

              <h3 className="mt-3 text-sm font-bold">Privacy</h3>

              <p className="mt-1 text-[10px] leading-5 text-slate-500 dark:text-slate-400">
                Understand how account-linked activity is handled.
              </p>

              <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                Learn more
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => setModal({ type: "terms" })}
              className="group rounded-2xl border border-slate-200/80 bg-white/65 p-5 text-left backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/55"
            >
              <Scale className="h-5 w-5 text-purple-600 dark:text-purple-400" />

              <h3 className="mt-3 text-sm font-bold">Terms</h3>

              <p className="mt-1 text-[10px] leading-5 text-slate-500 dark:text-slate-400">
                Review the responsible-use expectations for the platform.
              </p>

              <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-purple-600 dark:text-purple-400">
                Learn more
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => setModal({ type: "security" })}
              className="group rounded-2xl border border-slate-200/80 bg-white/65 p-5 text-left backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/55"
            >
              <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />

              <h3 className="mt-3 text-sm font-bold">Security</h3>

              <p className="mt-1 text-[10px] leading-5 text-slate-500 dark:text-slate-400">
                Learn how account-scoped APIs and file access are organized.
              </p>

              <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                Learn more
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          </div>
        </section>

        {/* =====================================================
            GET STARTED
        ===================================================== */}

        <section className="mx-auto mt-9 max-w-5xl">
          <div className="relative overflow-hidden rounded-[2rem] border border-blue-200/70 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-6 text-white shadow-[0_20px_80px_rgba(37,99,235,0.25)] sm:p-8">
            <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-20 left-16 h-44 w-44 rounded-full bg-cyan-300/10 blur-2xl" />

            <div className="relative flex flex-col items-center text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl">
                <HeartHandshake className="h-5 w-5" />
              </div>

              <h2 className="text-2xl font-black tracking-tight">
                Ready to get started?
              </h2>

              <p className="mt-2 max-w-xl text-xs leading-5 text-blue-100">
                Jump into translation and start working with your documents,
                PDFs and productivity tools.
              </p>

              <a
                href="/translate"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-blue-700 shadow-lg transition-all hover:-translate-y-0.5 hover:bg-blue-50"
              >
                Start Translating
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        {/* =====================================================
            FOOTER (INCREASED SIZE)
        ===================================================== */}

        <footer className="mx-auto mt-10 max-w-5xl border-t border-slate-200/80 pt-8 dark:border-slate-800">
          <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-3">
            {/* LEFT — LOGO / BRAND */}
            <div className="flex items-center justify-center md:justify-start">
              <div className="flex items-center gap-3">
                <img
                  src="/quill_logo.png"
                  alt="quill"
                  className="h-8 w-8 object-contain"
                />
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Quill
                </span>
              </div>
            </div>

            {/* CENTER — LEGAL LINKS */}
            <div className="flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={() => setModal({ type: "privacy" })}
                className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Privacy
              </button>

              <button
                type="button"
                onClick={() => setModal({ type: "terms" })}
                className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Terms
              </button>

              <button
                type="button"
                onClick={() => setModal({ type: "security" })}
                className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Security
              </button>
            </div>

            {/* RIGHT — SOCIAL LINKS */}
            <div className="flex items-center justify-center gap-3 md:justify-end">
              {/* GitHub */}
              <a
                href="https://github.com/demo-user"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                title="GitHub"
                className="flex h-5 w-5 items-center justify-center rounded-lg border border-slate-200 bg-white/70 text-slate-400 backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:text-slate-900 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:hover:text-white"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4.5 w-4.5">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </a>

              {/* LinkedIn */}
              <a
                href="https://www.linkedin.com/in/demo-user"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                title="LinkedIn"
                className="flex h-5 w-5 items-center justify-center rounded-lg border border-slate-200 bg-white/70 text-slate-400 backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:text-slate-900 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:hover:text-white"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4.5 w-4.5">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>

              {/* X / Twitter */}
              <a
                href="https://twitter.com/demo-user"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X / Twitter"
                title="X / Twitter"
                className="flex h-5 w-5 items-center justify-center rounded-lg border border-slate-200 bg-white/70 text-slate-400 backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:text-slate-900 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:hover:text-white"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4.5 w-4.5">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>

          {/* COPYRIGHT */}
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              © {new Date().getFullYear()} Quill. All rights reserved.
            </p>
          </div>
        </footer>
      </main>

      {/* =====================================================
          INFO MODAL
      ===================================================== */}

      {modal.type && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-md"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/90"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center gap-3">
                {React.createElement(
                  modalData[modal.type].icon,
                  {
                    className:
                      "h-5 w-5 text-blue-600 dark:text-blue-400",
                  }
                )}

                <h3 className="text-sm font-bold">
                  {modalData[modal.type].title}
                </h3>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold">
                  <Info className="h-4 w-4 text-blue-500" />
                  Quill
                </div>

                <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">
                  {modalData[modal.type].text}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="mt-4 w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          ANIMATIONS
      ===================================================== */}

      <style>{`
        @keyframes marqueeLeft {
          0% {
            transform: translateX(0);
          }

          100% {
            transform: translateX(-33.333333%);
          }
        }

        @keyframes marqueeRight {
          0% {
            transform: translateX(-33.333333%);
          }

          100% {
            transform: translateX(0);
          }
        }

        .animate-marquee-left {
          animation: marqueeLeft 34s linear infinite;
        }

        .animate-marquee-right {
          animation: marqueeRight 38s linear infinite;
        }

        .animate-marquee-left:hover,
        .animate-marquee-right:hover {
          animation-play-state: paused;
        }

        @media (max-width: 768px) {
          .animate-marquee-left {
            animation-duration: 26s;
          }

          .animate-marquee-right {
            animation-duration: 30s;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-marquee-left,
          .animate-marquee-right {
            animation: none;
            transform: none;
          }
        }
      `}</style>
    </div>
  );
}