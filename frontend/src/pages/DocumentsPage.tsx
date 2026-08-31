import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import * as pdfjsLib from "pdfjs-dist";

const pdfjsVersion = (pdfjsLib as any).version || process.env.REACT_APP_PDFJS_VERSION || "4.0.379";
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
}

const API_BASE = (() => {
  const raw = String(process.env.REACT_APP_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
  return raw.endsWith("/api") ? raw : `${raw}/api`;
})();
const MAX_DOCUMENT_MB = 250;
const MAX_DOCUMENT_BYTES = MAX_DOCUMENT_MB * 1024 * 1024;

type DocKind = "text" | "image" | "pdf" | "other";
type LineBlock = { kind: "line"; text: string; x: number; y: number; width: number; height: number; size: number; bold: boolean; fontFamily?: string; align: "left" | "center" | "right" };
type Block = LineBlock | { kind: "image"; src: string } | { kind: "rule"; y: number };

interface PageData { blocks: Block[]; text: string; width?: number; height?: number; backgroundSrc?: string; }
interface UploadedDoc { file: File; name: string; size: number; mime: string; kind: DocKind; objectUrl?: string; pagesData?: PageData[]; pages: number; uploadedAt: number; }
interface Lang { code: string; name: string; country: string; }

const LANGS: Lang[] = [
  { code: "en", name: "English", country: "GB" }, { code: "hi", name: "Hindi", country: "IN" },
  { code: "es", name: "Spanish", country: "ES" }, { code: "fr", name: "French", country: "FR" },
  { code: "de", name: "German", country: "DE" }, { code: "it", name: "Italian", country: "IT" },
  { code: "pt", name: "Portuguese", country: "PT" }, { code: "ru", name: "Russian", country: "RU" },
  { code: "ja", name: "Japanese", country: "JP" }, { code: "ko", name: "Korean", country: "KR" },
  { code: "zh", name: "Chinese", country: "CN" }, { code: "ar", name: "Arabic", country: "SA" },
  { code: "tr", name: "Turkish", country: "TR" }, { code: "nl", name: "Dutch", country: "NL" },
  { code: "pl", name: "Polish", country: "PL" }, { code: "sv", name: "Swedish", country: "SE" },
  { code: "id", name: "Indonesian", country: "ID" }, { code: "vi", name: "Vietnamese", country: "VN" },
  { code: "uk", name: "Ukrainian", country: "UA" }, { code: "mr", name: "Marathi", country: "IN" },
  { code: "ta", name: "Tamil", country: "IN" }, { code: "te", name: "Telugu", country: "IN" },
  { code: "bn", name: "Bengali", country: "IN" }, { code: "gu", name: "Gujarati", country: "IN" },
];

const PROTECTED_PATTERNS: RegExp[] = [
  /[\w.+-]+@[\w-]+\.[\w.-]+/g, /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi, /www\.[^\s<>"{}|\\^`\[\]]+/gi,
  /\+\d[\d\s\-()]{7,}\d/g, /github\.com\/[^\s,|]+/gi, /linkedin\.com\/[^\s,|]+/gi, /leetcode\.com\/[^\s,|]+/gi,
];

const protectText = (text: string) => {
  const replacements: { placeholder: string; original: string }[] = [];
  let working = text; let counter = 0;
  for (const pattern of PROTECTED_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    working = working.replace(regex, (match) => {
      const placeholder = `__PRX${counter}__`;
      replacements.push({ placeholder, original: match });
      counter++; return placeholder;
    });
  }
  return {
    protectedText: working,
    restore: (translated: string) => {
      let result = translated;
      for (const { placeholder, original } of replacements) {
        const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        result = result.replace(new RegExp(escaped, "gi"), original);
      }
      return result;
    },
  };
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
};
const formatCount = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(2)}k` : String(n));
const detectKind = (file: File): DocKind => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return "pdf";
  if (file.type.startsWith("text/") || /\.(txt|md|csv)$/i.test(file.name)) return "text";
  return "other";
};
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const triggerBlobDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const getLineBlocks = (page: PageData): LineBlock[] => page.blocks.filter((b): b is LineBlock => b.kind === "line");
const getRuleBlocks = (page: PageData): { y: number }[] => page.blocks.filter((b) => b.kind === "rule").map((b) => ({ y: (b as any).y }));

const INDIC_TEXT_PATTERN = /[\u0900-\u097f\u0980-\u09ff\u0a00-\u0a7f\u0a80-\u0aff\u0b80-\u0bff\u0c00-\u0c7f]/;
const DEFAULT_TEXT_FONT_STACK = `"Segoe UI","Nirmala UI","Mangal","Noto Sans Devanagari","Noto Sans",Arial,sans-serif`;
const SERIF_TEXT_FONT_STACK = `"Noto Serif","Nirmala UI","Mangal",Georgia,"Times New Roman",serif`;
const MONO_TEXT_FONT_STACK = `"Noto Sans Mono",Consolas,"Courier New",monospace`;

const cssFontStack = (fontFamily?: string) => {
  const raw = String(fontFamily || "").replace(/[;"<>]/g, "").trim();
  if (!raw) return DEFAULT_TEXT_FONT_STACK;
  const primary = raw.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
  const generic = primary.toLowerCase();
  if (!primary || /symbol|dingbat/i.test(primary)) return DEFAULT_TEXT_FONT_STACK;
  if (generic === "serif") return SERIF_TEXT_FONT_STACK;
  if (generic === "monospace") return MONO_TEXT_FONT_STACK;
  if (generic === "sans-serif") return DEFAULT_TEXT_FONT_STACK;
  if (/courier|mono|consolas/i.test(primary)) return `"${primary}",${MONO_TEXT_FONT_STACK}`;
  if (/times|serif|cambria|georgia/i.test(primary)) return `"${primary}",${SERIF_TEXT_FONT_STACK}`;
  return `"${primary}",${DEFAULT_TEXT_FONT_STACK}`;
};

const cssFontStackForText = (fontFamily: string | undefined, text: string) => {
  const baseStack = cssFontStack(fontFamily);
  if (!INDIC_TEXT_PATTERN.test(text)) return baseStack;
  if (baseStack.includes("Nirmala UI") || baseStack.includes("Mangal")) return baseStack;
  if (baseStack.endsWith(",sans-serif")) return baseStack.replace(/,sans-serif$/, `,"Nirmala UI","Mangal","Noto Sans Devanagari",sans-serif`);
  if (baseStack.endsWith(",serif")) return baseStack.replace(/,serif$/, `,"Nirmala UI","Mangal","Noto Sans Devanagari",serif`);
  if (baseStack.endsWith(",monospace")) return baseStack.replace(/,monospace$/, `,"Nirmala UI","Mangal","Noto Sans Devanagari",monospace`);
  return `${baseStack},"Nirmala UI","Mangal","Noto Sans Devanagari",sans-serif`;
};

const detectAlign = (x: number, width: number, pageWidth: number): "left" | "center" | "right" => {
  const rightEdge = x + width;
  const lineCenter = x + width / 2;
  const pageCenter = pageWidth / 2;
  const isFullWidth = width > pageWidth * 0.85;
  if (!isFullWidth && Math.abs(lineCenter - pageCenter) < pageWidth * 0.08) return "center";
  if (!isFullWidth && x > pageWidth * 0.3 && pageWidth - rightEdge < pageWidth * 0.12) return "right";
  return "left";
};

const collapseSpacedChars = (s: string): string =>
  s.split(/\s{2,}/).map((seg) => {
    const tokens = seg.split(" ");
    const singles = tokens.filter((t) => t.length === 1).length;
    if (tokens.length >= 3 && singles >= Math.ceil(tokens.length * 0.7)) {
      let out = "";
      for (let i = 0; i < tokens.length; i++) {
        if (i > 0) {
          const pl = tokens[i - 1][tokens[i - 1].length - 1];
          const f = tokens[i][0];
          if (/[a-z]/.test(pl) && /[A-Z]/.test(f)) out += " ";
        }
        out += tokens[i];
      }
      return out;
    }
    return seg;
  }).join(" ");

const splitChunks = (text: string, limit = 450): string[] => {
  const sentences = text.split(/(?<=[.!?।])\s+/);
  const chunks: string[] = []; let current = "";
  for (const sentence of sentences) {
    if (!sentence) continue;
    if (current && current.length + sentence.length + 1 > limit) { chunks.push(current); current = ""; }
    if (sentence.length > limit) {
      if (current) { chunks.push(current); current = ""; }
      for (let i = 0; i < sentence.length; i += limit) chunks.push(sentence.slice(i, i + limit));
    } else current = current ? `${current} ${sentence}` : sentence;
  }
  if (current) chunks.push(current);
  return chunks;
};

const myMemoryTranslate = async (text: string, source: string, target: string): Promise<string> => {
  const src = source === "auto" ? "autodetect" : source;
  const parts: string[] = []; const chunks = splitChunks(text);
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]; let retries = 2; let success = false;
    while (retries > 0 && !success) {
      try {
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${encodeURIComponent(src + "|" + target)}`);
        if (res.status === 429 || res.status === 403) throw new Error("MyMemory Rate Limited");
        if (!res.ok) throw new Error("MyMemory failed");
        const data = await res.json();
        const output = data?.responseData?.translatedText;
        if (!output) throw new Error("MyMemory empty");
        parts.push(output); success = true;
      } catch (e: any) {
        if (e.message === "MyMemory Rate Limited") throw e;
        retries--; if (retries === 0) throw e; await delay(1000);
      }
    }
    if (i < chunks.length - 1) await delay(1200);
  }
  return parts.join("\n").trim();
};

const extractPdf = async (file: File): Promise<{ pagesData: PageData[]; count: number }> => {
  const arrayBuffer = await file.arrayBuffer();
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const message = args.length > 0 ? String(args[0]) : "";
    if (message.includes("Warning: TT:") || message.includes("undefined function") || message.includes("JpxError")) return;
    originalWarn(...args);
  };

  let pdf: any;
  try {
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer), disableFontFace: false, useSystemFonts: true, stopAtErrors: false, isEvalSupported: true } as any);
    pdf = await loadingTask.promise;
  } catch (error) {
    console.warn = originalWarn;
    throw new Error("Could not open this PDF.");
  }
  console.warn = originalWarn;

  const pagesData: PageData[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    let page: any;
    try { page = await pdf.getPage(pageNumber); } catch { pagesData.push({ blocks: [], text: "" }); continue; }
    const viewport = page.getViewport({ scale: 1 });

    let backgroundSrc = "";
    try {
      const renderScale = Math.min(2, Math.max(1.5, (typeof window !== "undefined" && window.devicePixelRatio) || 1.5));
      const renderViewport = page.getViewport({ scale: renderScale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(renderViewport.width);
      canvas.height = Math.round(renderViewport.height);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport: renderViewport } as any).promise;
        backgroundSrc = canvas.toDataURL("image/png");
      }
    } catch (e) { console.warn(`Page render failed on page ${pageNumber}.`, e); }

    let lines: LineBlock[] = [];
    const rules: { y: number }[] = [];
    try {
      const textContent = await page.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false } as any);
      const items = (textContent?.items || []) as any[];
      const styles = (textContent?.styles || {}) as Record<string, { fontFamily?: string }>;
      const lineMap = new Map<number, { x: number; text: string; size: number; bold: boolean; fontFamily?: string; height: number; width: number }[]>();
      for (const item of items) {
        if (!item || typeof item.str !== "string" || !item.str.trim()) continue;
        const transform = item.transform || [];
        const x = Number(transform[4]) || 0; const y = Number(transform[5]) || 0;
        const size = Math.max(Number(item.height) || 0, Math.hypot(Number(transform[2]) || 0, Number(transform[3]) || 0)) || 11;
        const height = Math.max(Number(item.height) || size, size);
        const width = Number(item.width) || 0;
        const fontName = String(item.fontName || "");
        const bold = /bold|black|semibold|demibold|heavy/i.test(fontName);
        const fontFamily = styles[fontName]?.fontFamily || fontName;
        const yKey = Math.round(y / 2) * 2;
        if (!lineMap.has(yKey)) lineMap.set(yKey, []);
        lineMap.get(yKey)!.push({ x, text: item.str, size, bold, fontFamily, height, width });
      }
      lines = Array.from(lineMap.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([y, parts]) => {
          parts.sort((a, b) => a.x - b.x);
          let text = ""; let previousEnd = -Infinity; let maxSize = 11; let bold = false;
          let minX = Infinity; let maxX = -Infinity; let maxH = 14;
          const familyCounts = new Map<string, number>();
          for (const part of parts) {
            maxSize = Math.max(maxSize, part.size); bold = bold || part.bold; maxH = Math.max(maxH, part.height);
            if (part.fontFamily) familyCounts.set(part.fontFamily, (familyCounts.get(part.fontFamily) || 0) + Math.max(part.text.length, 1));
            minX = Math.min(minX, part.x);
            maxX = Math.max(maxX, part.x + (part.width || part.text.length * part.size * 0.5));
            const gap = part.x - previousEnd;
            if (previousEnd !== -Infinity && gap > Math.max(3, part.size * 0.25)) text += "  ";
            text += part.text;
            previousEnd = part.x + (part.width || part.text.length * part.size * 0.5);
          }
          const safeX = Number.isFinite(minX) ? clamp(minX, 0, viewport.width) : 0;
          const safeWidth = Number.isFinite(maxX) ? clamp(maxX - safeX, 8, viewport.width - safeX) : viewport.width;
          const fontFamily = Array.from(familyCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
          const top = clamp(viewport.height - y - maxH, 0, viewport.height);
          return {
            kind: "line" as const,
            text: collapseSpacedChars(text).replace(/[ \t]+/g, " ").trim(),
            x: safeX, y: top, width: safeWidth, height: maxH,
            size: maxSize, bold, fontFamily,
            align: detectAlign(safeX, safeWidth, viewport.width),
          };
        })
        .filter((l) => l.text.length > 0);
    } catch (e) { console.warn(`Text extraction failed on page ${pageNumber}.`, e); }

    try {
      const opList = await page.getOperatorList();
      const fn = opList.fnArray; const args = opList.argsArray;
      for (let i = 0; i < fn.length; i++) {
        const f = fn[i];
        if (f === (pdfjsLib as any).OPS.transform) continue;
        if (f === (pdfjsLib as any).OPS.constructPath) {
          const pathOps = args[i][0]; const pathArgs = args[i][1];
          let idx = 0;
          const pts: { x: number; y: number }[] = [];
          const rects: { y: number; h: number; w: number }[] = [];
          for (const op of pathOps) {
            if (op === (pdfjsLib as any).OPS.moveTo || op === (pdfjsLib as any).OPS.lineTo) { pts.push({ x: pathArgs[idx], y: pathArgs[idx + 1] }); idx += 2; }
            else if (op === (pdfjsLib as any).OPS.rectangle) { rects.push({ y: pathArgs[idx + 1], h: pathArgs[idx + 3], w: pathArgs[idx + 2] }); idx += 4; }
          }
          const drawn = fn[i + 1] === (pdfjsLib as any).OPS.stroke || fn[i + 1] === (pdfjsLib as any).OPS.fill || fn[i + 1] === (pdfjsLib as any).OPS.eoFill;
          if (drawn) {
            if (pts.length >= 2 && Math.abs(pts[0].y - pts[1].y) < 1.5 && Math.abs(pts[0].x - pts[1].x) > 40) {
              rules.push({ y: clamp(viewport.height - pts[0].y, 0, viewport.height) });
            }
            for (const r of rects) if (r.h <= 2 && r.w > 40) rules.push({ y: clamp(viewport.height - r.y, 0, viewport.height) });
          }
        }
      }
    } catch (e) { console.warn(`Operator list failed on page ${pageNumber}.`, e); }

    const blocks: Block[] = [...lines, ...rules.map((r) => ({ kind: "rule" as const, y: r.y }))];
    const text = lines.map((l) => l.text).join("\n");
    pagesData.push({ blocks, text, width: viewport.width, height: viewport.height, backgroundSrc });
  }
  return { pagesData, count: pdf.numPages };
};

const handleTextFile = async (file: File): Promise<{ pagesData: PageData[]; count: number }> => {
  const text = await file.text();
  const hasPageBreaks = /---\s*PAGE\s*BREAK\s*---|\f/i.test(text);
  const splitParts = hasPageBreaks ? text.split(/---\s*PAGE\s*BREAK\s*---|\f/i) : [text];
  const parts = splitParts.length ? splitParts : [text];
  const pagesData = parts.map((part) => ({
    blocks: part.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").map((line) => ({ kind: "line" as const, text: line, x: 40, y: 0, width: 520, height: 18, bold: false, size: 11, align: "left" as const })),
    text: part,
  }));
  return { pagesData, count: pagesData.length };
};

let measureCanvas: HTMLCanvasElement | null = null;
const measureLineWidth = (text: string, fontSize: number, fontFamily: string, bold?: boolean) => {
  if (typeof document !== "undefined") {
    try {
      measureCanvas = measureCanvas || document.createElement("canvas");
      const context = measureCanvas.getContext("2d");
      if (context) {
        context.font = `${bold ? 700 : 400} ${fontSize}px ${fontFamily}`;
        return context.measureText(text || " ").width;
      }
    } catch {}
  }
  return text.length * fontSize * 0.56;
};

const computeLineScale = (b: LineBlock, translated: string): number => {
  const fam = cssFontStackForText(b.fontFamily, translated);
  const measured = measureLineWidth(translated, b.size, fam, b.bold);
  const box = Math.max(b.width, 8) + 6;
  return measured > box ? Math.max(0.35, box / measured) : 1;
};

const OverlayPage = ({ page, translatedLines }: { page: PageData; translatedLines: string[] }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const pageWidth = page.width || 612;
  const pageHeight = page.height || 792;

  useEffect(() => {
    const update = () => {
      const w = containerRef.current?.clientWidth || pageWidth;
      setScale(Math.min(1, w / pageWidth));
    };
    update();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) { ro = new ResizeObserver(update); ro.observe(containerRef.current); }
    window.addEventListener("resize", update);
    return () => { ro?.disconnect(); window.removeEventListener("resize", update); };
  }, [pageWidth]);

  const lines = getLineBlocks(page);
  const rules = getRuleBlocks(page);
  return (
    <div className="h-full w-full overflow-auto bg-slate-100 p-4 dark:bg-[#0d1526]">
      <div ref={containerRef} className="mx-auto w-full" style={{ maxWidth: pageWidth }}>
        <div style={{ width: pageWidth, height: pageHeight, transform: `scale(${scale})`, transformOrigin: "top left", position: "relative", backgroundImage: `url("${page.backgroundSrc}")`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat", marginBottom: -(pageHeight * (1 - scale)) }}>
          {lines.map((b, i) => (
            <span key={`m${i}`} style={{ position: "absolute", left: b.x - 2, top: b.y - 2, width: b.width + 6, height: b.height + 3, background: "#fff", zIndex: 1, display: "block" }} />
          ))}
          {rules.map((r, i) => (
            <span key={`r${i}`} style={{ position: "absolute", left: pageWidth * 0.07, right: pageWidth * 0.07, top: r.y, borderTop: "1.4px solid #55606e", zIndex: 2, display: "block" }} />
          ))}
          {lines.map((b, i) => {
            const t = translatedLines[i] ?? b.text;
            const fam = cssFontStackForText(b.fontFamily, t);
            const s = computeLineScale(b, t);
            const origin = b.align === "center" ? "center top" : b.align === "right" ? "right top" : "left top";
            return (
              <span key={`t${i}`} style={{ position: "absolute", left: b.x, top: b.y - 2, width: b.width + 4, color: "#1e293b", fontFamily: fam, fontSize: b.size, fontWeight: b.bold ? 700 : 400, textAlign: b.align, whiteSpace: "nowrap", transform: `scaleX(${s})`, transformOrigin: origin, zIndex: 3, display: "block", lineHeight: `${Math.round(b.height * 1.45)}px` }}>
                {t}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const FlowPage = ({ page, translated }: { page: PageData; translated?: string }) => {
  const translatedLines = (translated ?? "").split("\n"); let ti = 0; const nodes: React.ReactNode[] = [];
  page.blocks.forEach((block, index) => {
    if (block.kind === "line") {
      const text = translated !== undefined ? translatedLines[ti] ?? block.text : block.text;
      const weight = block.bold ? "700" : "400";
      const fontSize = Math.max(9, Math.min(Math.round(block.size || 11), 28));
      nodes.push(<p key={index} className="break-words whitespace-pre-wrap" style={{ fontWeight: weight, fontSize: `${fontSize}px`, textAlign: block.align, margin: block.bold ? "14px 0 8px" : "9px 0", lineHeight: 1.7 }}>{text}</p>);
      ti++;
    } else if (block.kind === "rule") {
      nodes.push(<div key={index} style={{ borderTop: "1.4px solid #55606e", margin: "12px 0" }} />);
    }
  });
  return (
    <div className="h-full w-full overflow-y-auto bg-slate-100 p-4 dark:bg-[#0d1526]">
      <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col bg-white p-7 shadow-md ring-1 ring-slate-200">
        <div className="flex-1 text-[11px] text-slate-800">{nodes}</div>
      </div>
    </div>
  );
};

const buildOverlayPageHtml = (page: PageData, translatedLines: string[]): string => {
  const pageWidth = page.width || 612; const pageHeight = page.height || 792;
  const lines = getLineBlocks(page); const rules = getRuleBlocks(page);
  let out = `<section class="doc-page" style="width:${pageWidth}px;height:${pageHeight}px;background-image:url('${page.backgroundSrc}');background-size:100% 100%;background-repeat:no-repeat;">`;
  lines.forEach((b) => { out += `<span style="position:absolute;left:${b.x - 2}px;top:${b.y - 2}px;width:${b.width + 6}px;height:${b.height + 3}px;background:#fff;z-index:1;display:block"></span>`; });
  rules.forEach((r) => { out += `<span style="position:absolute;left:${pageWidth * 0.07}px;right:${pageWidth * 0.07}px;top:${r.y}px;border-top:1.4px solid #55606e;z-index:2;display:block"></span>`; });
  lines.forEach((b, i) => {
    const t = translatedLines[i] ?? b.text;
    const fam = cssFontStackForText(b.fontFamily, t).replace(/"/g, "'");
    const s = computeLineScale(b, t);
    const origin = b.align === "center" ? "center top" : b.align === "right" ? "right top" : "left top";
    out += `<span style="position:absolute;left:${b.x}px;top:${b.y - 2}px;width:${b.width + 4}px;color:#1e293b;font-family:${fam};font-size:${b.size}px;font-weight:${b.bold ? 700 : 400};text-align:${b.align};white-space:nowrap;transform:scaleX(${s});transform-origin:${origin};z-index:3;display:block;line-height:${Math.round(b.height * 1.45)}px">${escapeHtml(t)}</span>`;
  });
  return out + `</section>`;
};

const buildFlowPageHtml = (page: PageData, translated?: string): string => {
  const translatedLines = (translated ?? "").split("\n"); let ti = 0; let out = `<div class="flowwrap">`;
  page.blocks.forEach((block) => {
    if (block.kind === "line") {
      const t = translated !== undefined ? translatedLines[ti] ?? block.text : block.text;
      const weight = block.bold ? "700" : "400";
      const size = Math.max(9, Math.min(Math.round(block.size || 11), 28));
      const margin = block.bold ? "14px 0 8px" : "9px 0";
      out += `<p style="font-weight:${weight};font-size:${size}px;text-align:${block.align};margin:${margin};line-height:1.7">${t.trim() ? escapeHtml(t) : "&nbsp;"}</p>`;
      ti++;
    } else if (block.kind === "rule") {
      out += `<div style="border-top:1.4px solid #55606e;margin:12px 0"></div>`;
    }
  });
  return out + `</div>`;
};

const measureFlowScales = async (htmls: string[], targetHeight: number, width: number): Promise<number[]> => {
  const styleEl = document.createElement("style");
  styleEl.textContent = `.mtmp{font-family:"Segoe UI","Nirmala UI","Noto Sans",Arial,sans-serif;color:#1e293b;line-height:1.7}.mtmp p{word-wrap:break-word}`;
  document.head.appendChild(styleEl);
  const holder = document.createElement("div");
  holder.className = "mtmp";
  holder.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;visibility:hidden;pointer-events:none;z-index:-1;`;
  document.body.appendChild(holder);
  const scales: number[] = [];
  for (const html of htmls) {
    holder.innerHTML = html;
    const h = holder.getBoundingClientRect().height;
    scales.push(h > targetHeight ? Math.max(0.45, (targetHeight - 8) / h) : 1);
  }
  document.body.removeChild(holder);
  document.head.removeChild(styleEl);
  return scales;
};

const buildPagedDocument = async (title: string, pagesData: PageData[], translatedPages?: string[], opts?: { word?: boolean }): Promise<string> => {
  // pagesData is intentionally rendered one-for-one: one source page becomes one output section.
  const first = pagesData[0];
  const pw = Math.round(first?.width || 612); const ph = Math.round(first?.height || 792);
  const useOverlayAll = Boolean(translatedPages) && pagesData.every((p) => p.backgroundSrc);

  let body = "";
  if (useOverlayAll) {
    pagesData.forEach((page, i) => { body += buildOverlayPageHtml(page, translatedPages![i]?.split("\n") ?? []); });
  } else {
    const htmls = pagesData.map((page, i) => buildFlowPageHtml(page, translatedPages ? translatedPages[i] : undefined));
    const scales = opts?.word ? pagesData.map(() => 1) : await measureFlowScales(htmls, ph - 60, pw - 80);
    htmls.forEach((html, i) => {
      const s = scales[i] || 1;
      body += `<section class="doc-page flow" style="width:${pw}px;height:${ph}px;"><div style="transform:scale(${s.toFixed(3)});transform-origin:top left;width:${(100 / s).toFixed(3)}%;padding:30px 40px;box-sizing:border-box;">${html}</div></section>`;
    });
  }

  const htmlOpen = opts?.word ? `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">` : `<!DOCTYPE html><html>`;
  return `${htmlOpen}<head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>` +
    `body{margin:0;padding:0;font-family:"Segoe UI","Nirmala UI","Noto Sans",Arial,sans-serif;color:#1e293b}` +
    `.doc-page{position:relative;display:block;overflow:hidden;box-sizing:border-box;width:${pw}px;height:${ph}px;min-width:${pw}px;min-height:${ph}px;max-width:${pw}px;max-height:${ph}px;page-break-after:always;break-after:page;page-break-inside:avoid;break-inside:avoid;margin:0}` +
    `.doc-page:last-child{page-break-after:auto;break-after:auto}` +
    `.doc-page *{box-sizing:border-box}` +
    `@page{size:${pw}px ${ph}px;margin:0}` +
    `@media print{html,body{margin:0!important;padding:0!important;width:${pw}px!important}body{overflow:visible!important}.doc-page{margin:0!important;overflow:hidden!important;page-break-after:always!important;break-after:page!important;page-break-inside:avoid!important;break-inside:avoid!important}.doc-page:last-child{page-break-after:auto!important;break-after:auto!important}}` +
    `</style></head><body>${body}</body></html>`;
};

const Flag = ({ country, size = "sm" }: { country: string; size?: "xs" | "sm" | "md" }) => {
  const dimensions = size === "xs" ? "h-5 w-5" : size === "md" ? "h-8 w-8" : "h-6 w-6";
  return (<span className={`${dimensions} inline-flex shrink-0 overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm dark:border-slate-700`}><img src={`https://flagcdn.com/w80/${country.toLowerCase()}.png`} alt="" className="h-full w-full object-cover" /></span>);
};

const Svg = ({ children, className = "w-5 h-5" }: { children: React.ReactNode; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>{children}</svg>
);

const Icons = {
  upload: <Svg className="w-6 h-6"><path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M5 20h14" /></Svg>,
  file: <Svg className="w-5 h-5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h6" /></Svg>,
  pdf: <Svg className="w-5 h-5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 15h2a1.5 1.5 0 0 0 0-3H8v5" /><path d="M13 17v-5h1.5a2.5 2.5 0 0 1 0 5H13z" /></Svg>,
  image: <Svg className="w-5 h-5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></Svg>,
  close: <Svg className="w-4 h-4"><path d="M6 6l12 12M18 6L6 18" /></Svg>,
  search: <Svg className="w-4 h-4"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></Svg>,
  download: <Svg className="w-4 h-4"><path d="M12 4v12" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></Svg>,
  shield: <Svg className="w-4 h-4"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" /><path d="m9 12 2 2 4-4" /></Svg>,
  globe: <Svg className="w-5 h-5"><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.4 2.5 3.7 5.5 3.7 9S14.4 18.5 12 21" /><path d="M12 3c-2.4 2.5-3.7 5.5-3.7 9S9.6 18.5 12 21" /></Svg>,
  chevronLeft: <Svg className="w-4 h-4"><path d="m15 18-6-6 6-6" /></Svg>,
  chevronRight: <Svg className="w-4 h-4"><path d="m9 18 6-6-6-6" /></Svg>,
};

const ProgressRing = ({ value }: { value: number }) => {
  const radius = 52; const circumference = 2 * Math.PI * radius; const offset = circumference - (value / 100) * circumference;
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={radius} strokeWidth="9" fill="none" className="stroke-slate-200 dark:stroke-slate-800" />
        <circle cx="60" cy="60" r={radius} strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="stroke-cyan-400 transition-all duration-300" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-slate-900 dark:text-white">{value}%</div>
    </div>
  );
};

const OcrBadge = () => {
  const radius = 15; const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative h-11 w-11 shrink-0">
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
        <circle cx="18" cy="18" r={radius} strokeWidth="3" fill="none" className="stroke-slate-200 dark:stroke-slate-700" />
        <circle cx="18" cy="18" r={radius} strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * 0.25} className="stroke-cyan-400" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-cyan-500">OCR</div>
    </div>
  );
};

const PageThumb = () => (
  <div className="flex h-24 w-full min-w-0 flex-col gap-1.5 rounded-md border border-slate-200 bg-white p-2 shadow dark:border-slate-700 dark:bg-slate-100">
    <div className="h-1.5 w-full rounded bg-slate-300" /><div className="h-1 w-full rounded bg-slate-200" /><div className="h-1 w-4/5 rounded bg-slate-200" />
    <div className="my-1 h-8 w-full rounded bg-slate-300/70" /><div className="h-1 w-full rounded bg-slate-200" /><div className="h-1 w-3/5 rounded bg-slate-200" />
  </div>
);

const LanguageSelect = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
  const [open, setOpen] = useState(false); const selected = LANGS.find((lang) => lang.code === value);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((current) => !current)} className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition hover:border-cyan-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <span className="flex min-w-0 items-center gap-2">{selected ? <Flag country={selected.country} size="sm" /> : <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/10">{Icons.globe}</span>}<span className="truncate">{selected?.name || "Auto (Detected)"}</span></span>
        <span className="ml-2 text-slate-400">{open ? "⌃" : "⌄"}</span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <button type="button" onClick={() => { onChange("auto"); setOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-cyan-500/10"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-500">{Icons.globe}</span>Auto (Detected)</button>
          {LANGS.map((lang) => (<button key={lang.code} type="button" onClick={() => { onChange(lang.code); setOpen(false); }} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${value === lang.code ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"}`}><Flag country={lang.country} size="sm" /><span>{lang.name}</span></button>))}
        </div>
      )}
    </div>
  );
};

const DocumentsPage: React.FC = () => {
  const [doc, setDoc] = useState<UploadedDoc | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [viewTab, setViewTab] = useState<"original" | "translated">("original");
  const [currentPage, setCurrentPage] = useState(1);
  const [originalLang, setOriginalLang] = useState("auto");
  const [targets, setTargets] = useState<string[]>(["hi"]);
  const [langSearch, setLangSearch] = useState("");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageMessage, setStageMessage] = useState("");
  const [processed, setProcessed] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string[]>>({});
  const [viewLang, setViewLang] = useState("hi");
  const [projects, setProjects] = useState<number>(() => { try { return Number(localStorage.getItem("documents_projects")) || 0; } catch { return 0; } });
  const [translationTotal] = useState<number>(() => { try { return Number(localStorage.getItem("quill_translation_count")) || 11220; } catch { return 11220; } });

  // ✅ NEW: History State
  const [docHistory, setDocHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [backendDownloadUrl, setBackendDownloadUrl] = useState<string>("");
  const [backendFileName, setBackendFileName] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const stageIntervalRef = useRef<number | null>(null);
  const messageIndexRef = useRef(0);
  const progressRef = useRef(0);
  const workStartRef = useRef(0);
  const estimateMinRef = useRef(1);
  const cycleInfoRef = useRef({ langIdx: 1, totalLangs: 1, langName: "", totalPages: 0 });

  const updateProgress = (value: number) => { const next = Math.max(progressRef.current, Math.min(100, Math.round(value))); progressRef.current = next; setProgress(next); };
  const resetProgress = () => { progressRef.current = 0; setProgress(0); };
  const smoothProgress = async (target: number, totalMs: number) => {
    const from = progressRef.current; const destination = Math.max(from, Math.min(100, Math.round(target)));
    const steps = Math.max(destination - from, 1); const stepDelay = Math.max(totalMs, 100) / steps;
    for (let i = 1; i <= steps; i++) { await delay(stepDelay); updateProgress(from + ((destination - from) * i) / steps); }
  };

  // ✅ NEW: Fetch Document History
  // ✅ UPDATED: Robust history fetch with better error handling
  const fetchDocHistory = async () => {
    setHistoryLoading(true);
    const token = localStorage.getItem("access_token");
    if (!token) { 
      setHistoryLoading(false); 
      return; 
    }
    try {
      const res = await fetch(`${API_BASE}/history/?type=documents&page_size=5`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setDocHistory(data.data || []);
      } else if (res.status === 401) {
        console.warn("History fetch 401: Token might be expired. Please re-login.");
        setDocHistory([]);
      }
    } catch (error) {
      console.error("Document history fetch error:", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => { try { localStorage.setItem("documents_projects", String(projects)); } catch {} }, [projects]);
  useEffect(() => { 
    fetchDocHistory();
    return () => { if (stageIntervalRef.current) window.clearInterval(stageIntervalRef.current); if (doc?.objectUrl) URL.revokeObjectURL(doc.objectUrl); }; 
  }, [doc]);

  const handleFile = useCallback(async (file: File) => {
    const kind = detectKind(file);
    if (file.size > MAX_DOCUMENT_BYTES) { toast.error(`File too large. Maximum size is ${MAX_DOCUMENT_MB} MB.`); return; }
    try {
      let pagesData: PageData[] = []; let pageCount = 1;
      const objectUrl = kind === "image" || kind === "pdf" ? URL.createObjectURL(file) : undefined;
      if (kind === "text") { const result = await handleTextFile(file); pagesData = result.pagesData; pageCount = result.count; }
      else if (kind === "pdf") {
        try { const result = await extractPdf(file); pagesData = result.pagesData; pageCount = result.count; }
        catch (pdfError) {
          console.error("PDF extraction error:", pdfError); pagesData = [];
          try { const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), disableFontFace: false, stopAtErrors: false } as any); const pdf = await loadingTask.promise; pageCount = pdf.numPages; }
          catch { pageCount = 1; }
          toast("PDF uploaded, but some text could not be extracted.");
        }
      }
      const pages = Math.max(pageCount, 1);
      setDoc((previous) => {
        if (previous?.objectUrl) URL.revokeObjectURL(previous.objectUrl);
        return { file, name: file.name, size: file.size, mime: file.type || "application/octet-stream", kind, objectUrl, pagesData, pages, uploadedAt: Date.now() };
      });
      setProcessed(false); setTranslations({}); resetProgress(); setStageMessage(""); setViewTab("original"); setCurrentPage(1);
      toast.success(`"${file.name}" uploaded (${pages} page${pages > 1 ? "s" : ""}).`);
    } catch (error: any) { console.error("File upload error:", error); toast.error(error?.message || "Could not read this document."); }
  }, []);

  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => { event.preventDefault(); setIsDragging(false); const file = event.dataTransfer.files?.[0]; if (file) handleFile(file); }, [handleFile]);
  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) handleFile(file); event.target.value = ""; };
  const removeDoc = () => { if (doc?.objectUrl) URL.revokeObjectURL(doc.objectUrl); setDoc(null); setProcessed(false); setTranslations({}); resetProgress(); setStageMessage(""); setViewTab("original"); setCurrentPage(1); };

  const translateViaAPI = async (
    text: string,
    target: string,
    pageNumber?: number,
  ): Promise<string> => {
    let token = localStorage.getItem("access_token");
    const refreshToken = localStorage.getItem("refresh_token");
    const { protectedText, restore } = protectText(text);
    const sanitizedText = protectedText.replace(/\u0000/g, "").trim();

    if (!sanitizedText) {
      return "";
    }

    // 1) Use the Django page-translation endpoint first. This keeps the
    // translation tied to the exact source page and avoids the old
    // whole-document upload flow that could change the page count.
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      let response = await fetch(`${API_BASE}/translation/document-page/`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          source_text: sanitizedText,
          source_lang: originalLang,
          target_lang: target,
          page_number: pageNumber || 1,
        }),
      });

      if (response.status === 401 && refreshToken) {
        try {
          const refreshRes = await fetch(`${API_BASE}/token/refresh/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh: refreshToken }),
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            const newToken = String(refreshData.access || "");

            if (newToken) {
              token = newToken;
              localStorage.setItem("access_token", newToken);
              headers.Authorization = `Bearer ${newToken}`;

              response = await fetch(`${API_BASE}/translation/document-page/`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                  source_text: sanitizedText,
                  source_lang: originalLang,
                  target_lang: target,
                  page_number: pageNumber || 1,
                }),
              });
            }
          }
        } catch (refreshError) {
          console.warn("[TOKEN REFRESH] Failed", refreshError);
        }
      }

      if (response.ok) {
        const payload = await response.json();
        const translated =
          payload?.data?.translated_text || payload?.translated_text || "";

        if (typeof translated === "string" && translated.trim()) {
          return restore(translated.trim());
        }
      } else if (response.status === 401) {
        console.warn("[DOCUMENT TRANSLATION] Authentication required.");
      }
    } catch (error) {
      console.warn("[BACKEND DOCUMENT PAGE] Failed", error);
    }

    // 2) Google web fallback.
    try {
      const src = originalLang === "auto" ? "auto" : originalLang;
      const url =
        `https://translate.googleapis.com/translate_a/single?client=gtx` +
        `&sl=${encodeURIComponent(src)}` +
        `&tl=${encodeURIComponent(target)}` +
        `&dt=t&q=${encodeURIComponent(sanitizedText)}`;

      const res = await fetch(url);

      if (res.ok) {
        const data = await res.json();
        const parts = (Array.isArray(data) ? data[0] || [] : [])
          .map((seg: any) => (seg && seg[0] ? String(seg[0]) : ""))
          .join("");

        if (parts.trim()) {
          return restore(parts.trim());
        }
      }
    } catch (error) {
      console.warn("[GTX] Failed", error);
    }

    // 3) MyMemory final fallback.
    const translated = await myMemoryTranslate(
      sanitizedText,
      originalLang,
      target,
    );

    return restore(translated);
  };

  const translatePagePreservingLayout = async (page: PageData, target: string, pageNumber: number): Promise<string> => {
    const lines = getLineBlocks(page);
    if (!lines.some((l) => l.text.trim())) return lines.map((l) => l.text).join("\n");

    const translatedLines: string[] = new Array(lines.length).fill("");
    const chunks: number[][] = [];
    let curIdx: number[] = []; let curLen = 0;
    lines.forEach((l, i) => {
      if (!l.text.trim()) { translatedLines[i] = ""; return; }
      if (curLen + l.text.length + 1 > 900 && curIdx.length) { chunks.push(curIdx); curIdx = []; curLen = 0; }
      curIdx.push(i); curLen += l.text.length + 1;
    });
    if (curIdx.length) chunks.push(curIdx);

    for (const idxs of chunks) {
      const joined = idxs.map((i) => lines[i].text).join("\n");
      let outLines: string[] | null = null;
      try {
        const out = await translateViaAPI(joined, target, pageNumber);
        const arr = out.split(/\r?\n/);
        if (arr.length === idxs.length) outLines = arr;
      } catch {}
      if (outLines) {
        idxs.forEach((i, k) => { translatedLines[i] = (outLines as string[])[k].trim() || lines[i].text; });
      } else {
        for (const i of idxs) {
          try {
            const o = await translateViaAPI(lines[i].text, target, pageNumber);
            translatedLines[i] = o.trim() || lines[i].text;
          } catch { translatedLines[i] = lines[i].text; }
        }
      }
    }
    return translatedLines.join("\n");
  };

  const stopCycling = () => { if (stageIntervalRef.current) { window.clearInterval(stageIntervalRef.current); stageIntervalRef.current = null; } };
  const startCycling = () => {
    stopCycling(); messageIndexRef.current = 0;
    const buildMessages = () => {
      const info = cycleInfoRef.current;
      return [`Translating ${info.langIdx}/${info.totalLangs} → ${info.langName}… (${info.totalPages} page${info.totalPages > 1 ? "s" : ""})`, `Estimated time: ~${estimateMinRef.current} min`, "Please wait… translating your document"];
    };
    setStageMessage(buildMessages()[0]);
    stageIntervalRef.current = window.setInterval(() => {
      const messages = buildMessages();
      messageIndexRef.current = (messageIndexRef.current + 1) % messages.length;
      setStageMessage(messages[messageIndexRef.current]);
    }, 2500);
  };


  // ✅ UPDATED: Safe 401 handling without guessing refresh URLs
  const handleProcess = async () => {
    if (!doc) {
      toast.error("Please upload a document first.");
      return;
    }

    if (!targets.length) {
      toast.error("Select at least one target language.");
      return;
    }

    if (processing) return;

    const sourcePages = doc.pagesData || [];

    // For PDFs/text documents we keep a strict 1:1 page mapping.
    // Every source page produces exactly one translated page string.
    if (!sourcePages.length) {
      toast.error(
        doc.kind === "image"
          ? "Image translation needs readable/extracted text. Please use a text PDF or document."
          : "No readable document pages were extracted."
      );
      return;
    }

    setProcessing(true);
    setProcessed(false);
    resetProgress();
    setStageMessage("Preparing your document pages...");
    setBackendDownloadUrl("");
    setBackendFileName("");

    const totalWork = Math.max(targets.length * sourcePages.length, 1);
    let completedWork = 0;

    try {
      const allTranslations: Record<string, string[]> = {};

      stopCycling();
      setStageMessage(
        `Translating 1/${targets.length} → ${LANGS.find((l) => l.code === targets[0])?.name || targets[0]}… (page 1/${sourcePages.length})`
      );

      for (let langIndex = 0; langIndex < targets.length; langIndex++) {
        const target = targets[langIndex];
        const targetName = LANGS.find((l) => l.code === target)?.name || target;
        const translatedPages: string[] = new Array(sourcePages.length).fill("");

        cycleInfoRef.current = {
          langIdx: langIndex + 1,
          totalLangs: targets.length,
          langName: targetName,
          totalPages: sourcePages.length,
        };

        estimateMinRef.current = Math.max(
          1,
          Math.ceil(
            sourcePages.reduce((sum, page) => sum + (page.text?.length || 0), 0) / 1200
          )
        );

        setStageMessage(
          `Translating ${langIndex + 1}/${targets.length} → ${targetName}… (page 1/${sourcePages.length})`
        );

        for (let pageIndex = 0; pageIndex < sourcePages.length; pageIndex++) {
          const page = sourcePages[pageIndex];
          const pageNumber = pageIndex + 1;

          setStageMessage(
            `Translating ${langIndex + 1}/${targets.length} → ${targetName}… (page ${pageNumber}/${sourcePages.length})`
          );

          try {
            translatedPages[pageIndex] = await translatePagePreservingLayout(
              page,
              target,
              pageNumber,
            );
          } catch (pageError) {
            console.error(
              `Translation failed for ${targetName}, page ${pageNumber}:`,
              pageError,
            );
            // Keep the original page text rather than dropping a page.
            translatedPages[pageIndex] = page.text || "";
          }

          completedWork += 1;
          updateProgress((completedWork / totalWork) * 100);
        }

        // Enforce the exact source page count even if a future translation
        // provider returns unexpected data.
        allTranslations[target] = translatedPages.slice(0, sourcePages.length);
        setTranslations({ ...allTranslations });
        setViewLang(target);
      }

      // Final safety check: every selected language must contain exactly the
      // same number of translated pages as the original document.
      for (const target of targets) {
        const pages = allTranslations[target] || [];
        if (pages.length !== sourcePages.length) {
          allTranslations[target] = Array.from(
            { length: sourcePages.length },
            (_, index) => pages[index] ?? sourcePages[index]?.text ?? "",
          );
        }
      }

      setTranslations(allTranslations);
      updateProgress(100);
      setViewLang(targets[0]);
      setViewTab("translated");
      setCurrentPage(1);
      setProcessed(true);
      setProjects((value) => value + 1);

      // Keep the existing document-history refresh feature.
      await fetchDocHistory();

      toast.success(
        `Document translated successfully — ${sourcePages.length} source page${sourcePages.length === 1 ? "" : "s"} preserved.`,
      );
    } catch (error: any) {
      console.error("Document processing error:", error);
      const errorMsg = error?.message || "Translation failed.";
      toast.error(errorMsg);
    } finally {
      setProcessing(false);
      stopCycling();
    }
  };

  const activeDownloadLang = translations[viewLang] ? viewLang : Object.keys(translations)[0] || "";

  // ✅ UPDATED: Uses backend URL if available
  const downloadAs = async (format: "txt" | "doc" | "pdf" | "html") => {
    if (!processed) { toast.error("Process the document first."); return; }
    
    if (backendDownloadUrl) {
      const a = document.createElement("a");
      a.href = backendDownloadUrl;
      a.download = backendFileName || `translated_document.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success(`${format.toUpperCase()} download started.`);
      return;
    }

    const language = activeDownloadLang; 
    const translatedPages = translations[language];
    if (!language || !translatedPages?.length || !doc?.pagesData) { 
      toast.error("No translated content available."); return; 
    }
    const baseName = doc.name.replace(/\.[^.]+$/, ""); 
    const languageName = LANGS.find((lang) => lang.code === language)?.name || language; 
    const title = `${baseName} — ${languageName}`;

    if (format === "txt") triggerBlobDownload(new Blob([translatedPages.join("\n\n")], { type: "text/plain;charset=utf-8" }), `${baseName}_${language}.txt`);
    else if (format === "html") triggerBlobDownload(new Blob([await buildPagedDocument(title, doc.pagesData, translatedPages)], { type: "text/html;charset=utf-8" }), `${baseName}_${language}.html`);
    else if (format === "doc") triggerBlobDownload(new Blob([await buildPagedDocument(title, doc.pagesData, translatedPages, { word: true })], { type: "application/msword" }), `${baseName}_${language}.doc`);
    else {
      const printWindow = window.open("", "_blank");
      if (!printWindow) { toast.error("Popup blocked."); return; }
      printWindow.document.write(await buildPagedDocument(title, doc.pagesData, translatedPages));
      printWindow.document.close(); printWindow.focus();
      setTimeout(() => { try { printWindow.print(); } catch {} }, 700);
    }
    toast.success(`${format.toUpperCase()} download started.`);
  };

  const downloadAll = async () => {
    await downloadAs("txt");
    setTimeout(() => downloadAs("doc"), 400);
    setTimeout(() => downloadAs("html"), 800);
    setTimeout(() => downloadAs("pdf"), 1200);
  };

  const filteredLangs = useMemo(() => { const query = langSearch.trim().toLowerCase(); if (!query) return LANGS; return LANGS.filter((lang) => lang.name.toLowerCase().includes(query) || lang.code.toLowerCase().includes(query)); }, [langSearch]);
  const toggleTarget = (code: string) => { setTargets((previous) => previous.includes(code) ? previous.filter((item) => item !== code) : [...previous, code]); };

  const extension = doc ? (doc.name.split(".").pop() || "").toUpperCase() : "";
  const docTypeLabel = doc?.kind === "pdf" ? "Academic PDF" : doc?.kind === "image" ? "Scanned Image" : doc?.kind === "text" ? "Text Document" : "Document";
  const selectedViewLanguage = LANGS.find((lang) => lang.code === viewLang);
  const card = "min-w-0 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)] dark:border-cyan-500/20 dark:bg-[#0b1220] dark:shadow-[0_0_50px_-20px_rgba(34,211,238,0.25)]";
  const stepPill = "inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-400";
  const currentPageData = doc?.pagesData?.[currentPage - 1];
  const totalPages = doc?.pages || 1;
  const estimatedMinIdle = useMemo(() => { if (!doc?.pagesData?.length) return Math.max(1, targets.length); const characters = doc.pagesData.reduce((sum, page) => sum + page.text.length, 0); return Math.max(1, Math.ceil((characters / 1200) * targets.length)); }, [doc, targets.length]);

  return (
    <div className="mx-auto w-full max-w-[1500px] pb-10">
      <style>{`@keyframes fadeInOut { 0% { opacity: 0; transform: translateY(4px); } 15% { opacity: 1; transform: translateY(0); } 85% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-4px); } } .stage-message-anim { animation: fadeInOut 2.5s ease-in-out; }`}</style>
      <div className="mb-7">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl dark:text-white">Documents</h1>
        <p className="mt-2 text-sm text-slate-500 md:text-base dark:text-slate-400">Upload, translate and securely download multi-page documents in 24+ languages.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-[380px_minmax(0,1fr)_340px]">
        <section className={`${card} flex flex-col xl:row-span-2`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Book Page</span>
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
              {(["original", "translated"] as const).map((tab) => (
                <button key={tab} type="button" onClick={() => { setViewTab(tab); setCurrentPage(1); }} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${viewTab === tab ? "bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white" : "text-slate-500 dark:text-slate-400"}`}>
                  {tab === "original" ? "View Original" : "View Translated"}
                </button>
              ))}
            </div>
          </div>

          <div className="relative m-4 h-[440px] overflow-hidden rounded-2xl border border-slate-200 md:h-[500px] dark:border-slate-700">
            {!doc ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-50 p-8 text-center dark:bg-[#0d1526]">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-500">{Icons.globe}</div>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No document loaded</p>
                <p className="max-w-[220px] text-xs text-slate-400">Upload a PDF, image or text file to preview its pages here.</p>
              </div>
            ) : viewTab === "original" && doc.kind === "pdf" && doc.objectUrl ? (
              <iframe src={`${doc.objectUrl}#toolbar=0&navpanes=0&scrollbar=1`} title={doc.name} className="h-full w-full border-0 bg-white" />
            ) : viewTab === "original" && doc.kind === "image" && doc.objectUrl ? (
              <div className="flex h-full w-full items-center justify-center overflow-auto bg-slate-100 p-3 dark:bg-[#0d1526]">
                <img src={doc.objectUrl} alt={doc.name} className="max-h-full max-w-full rounded-lg object-contain shadow-md" />
              </div>
            ) : viewTab === "translated" && !translations[viewLang] ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-50 p-8 text-center dark:bg-[#0d1526]">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-500">{Icons.globe}</div>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Translation not ready</p>
                <p className="max-w-[220px] text-xs text-slate-400">Run Step 3 to see the translated document.</p>
              </div>
            ) : currentPageData ? (
              currentPageData.backgroundSrc ? (
                <OverlayPage page={currentPageData} translatedLines={viewTab === "translated" ? (translations[viewLang]?.[currentPage - 1] ?? "").split("\n") : (currentPageData.text || "").split("\n")} />
              ) : (
                <FlowPage page={currentPageData} translated={viewTab === "translated" ? translations[viewLang]?.[currentPage - 1] : undefined} />
              )
            ) : (
              <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-[#0d1526]"><p className="text-sm text-slate-500">No extracted text available.</p></div>
            )}
          </div>

          {doc && (
            <div className="px-4 pb-3">
              <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage <= 1} className="rounded-lg p-1.5 text-slate-600 transition hover:bg-white disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Previous page">{Icons.chevronLeft}</button>
                <div className="flex items-center gap-2">
                  {viewTab === "translated" && selectedViewLanguage && (<Flag country={selectedViewLanguage.country} size="xs" />)}
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Page {currentPage} of {totalPages}</span>
                </div>
                <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage >= totalPages} className="rounded-lg p-1.5 text-slate-600 transition hover:bg-white disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Next page">{Icons.chevronRight}</button>
              </div>
              {viewTab === "translated" && Object.keys(translations).length > 0 && (
                <select value={viewLang} onChange={(event) => { setViewLang(event.target.value); setCurrentPage(1); }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  {Object.keys(translations).map((code) => (<option key={code} value={code}>{LANGS.find((lang) => lang.code === code)?.name || code}</option>))}
                </select>
              )}
            </div>
          )}

          <div className="mx-4 mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#0d1526]">
            <p className="mb-3 truncate text-sm font-bold text-slate-800 dark:text-slate-100">{doc ? doc.name : "—"}</p>
            {[
              ["Document Type", doc ? docTypeLabel : "—"], ["Length", doc ? `${doc.pages} Pages` : "—"],
              ["Size", doc ? formatBytes(doc.size) : "—"], ["Format", doc ? extension : "—"],
              ["Language", originalLang === "auto" ? "Auto detect" : LANGS.find((lang) => lang.code === originalLang)?.name || "—"]
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between border-t border-slate-200/70 py-1.5 text-xs dark:border-slate-700/60">
                <span className="text-slate-400">{label}:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={`${card} p-5`}>
          <span className={stepPill}>Step 1 · Universal Uploader</span>
          <div onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={onDrop} onClick={() => fileInputRef.current?.click()} className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-7 text-center transition-all ${isDragging ? "border-cyan-400 bg-cyan-500/10" : "border-slate-300 hover:border-cyan-400/60 hover:bg-cyan-500/5 dark:border-slate-700"}`}>
            <div className="text-cyan-500">{Icons.upload}</div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Upload Your Files</p>
            <p className="text-xs text-slate-400">Drag & drop here, or <span className="font-semibold text-cyan-500">browse from file explorer</span></p>
            <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,.gif" className="hidden" onClick={(event) => event.stopPropagation()} onChange={onInputChange} />
          </div>
          {doc && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-[#0d1526]">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${doc.kind === "pdf" ? "bg-red-500/10 text-red-500" : doc.kind === "image" ? "bg-violet-500/10 text-violet-500" : "bg-blue-500/10 text-blue-500"}`}>
                  {doc.kind === "pdf" ? Icons.pdf : doc.kind === "image" ? Icons.image : Icons.file}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{doc.name}</p>
                  <p className="truncate text-[11px] text-slate-400">{formatBytes(doc.size)} · {doc.pages} page{doc.pages > 1 ? "s" : ""}</p>
                </div>
                <OcrBadge />
                <button type="button" onClick={removeDoc} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-500/10 hover:text-red-500" title="Remove file">{Icons.close}</button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[10px] font-semibold text-blue-500">● Multi-page</span>
                <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">1 – {doc.pages}</span>
                <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold text-cyan-600 dark:text-cyan-400">{doc.pagesData?.some((page) => page.text.trim()) ? "Text Ready" : "Image/Scanned Mode"}</span>
              </div>
            </div>
          )}
        </section>

        <section className={`${card} p-5`}>
          <h3 className="text-sm font-bold leading-5 text-slate-800 dark:text-slate-100">Live Translation Dashboard Summary</h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-[#0d1526]"><p className="text-xl font-bold text-cyan-500">{formatCount(translationTotal)}</p><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Translation</p></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-[#0d1526]"><p className="text-xl font-bold text-cyan-500">{projects}</p><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Projects</p></div>
          </div>
          <div className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Active Projects</p>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-[#0d1526]">
              <span className="min-w-0 truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{doc ? doc.name : "No active project"}</span>
              <span className="shrink-0 rounded-md bg-cyan-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-500">Neon</span>
            </div>
          </div>
        </section>

        <section className={`${card} p-5`}>
          <span className={stepPill}>Step 2 · Language Engine</span>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">Original</label><LanguageSelect value={originalLang} onChange={setOriginalLang} /></div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">Search languages</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{Icons.search}</span>
                <input value={langSearch} onChange={(event) => setLangSearch(event.target.value)} placeholder="Search for a language…" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
              </div>
            </div>
          </div>
          <p className="mb-2 mt-4 text-xs font-semibold text-slate-500 dark:text-slate-400">Translate To:</p>
          <div className="grid max-h-[190px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
            {filteredLangs.map((language) => {
              const active = targets.includes(language.code);
              return (
                <button key={language.code} type="button" onClick={() => toggleTarget(language.code)} className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-all ${active ? "border-cyan-400/60 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" : "border-slate-200 text-slate-600 hover:border-cyan-300 dark:border-slate-700 dark:text-slate-300"}`}>
                  <Flag country={language.country} size="sm" /><span className="truncate">{language.name}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">{targets.length} Target Language{targets.length === 1 ? "" : "s"} Selected:<span className="font-normal text-slate-400"> {targets.map((code) => LANGS.find((lang) => lang.code === code)?.name).filter(Boolean).join(", ") || "none"}</span></p>
        </section>

        <section className={`${card} p-5`}>
          <div><span className={stepPill}>Step 3 · Process & Secure Download</span></div>
          <div className="mt-5 flex items-center gap-4">
            <ProgressRing value={progress} />
            <div className="grid min-w-0 flex-1 grid-cols-3 gap-2"><PageThumb /><PageThumb /><PageThumb /></div>
          </div>
          <div className="mt-3 h-5">
            {processing ? (<p key={stageMessage} className="stage-message-anim text-xs font-semibold text-slate-500 dark:text-slate-400">{stageMessage}</p>)
              : processed ? (<p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">✓ Processing complete — downloads ready.</p>)
              : (<p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Estimated completion: ~{estimatedMinIdle} min</p>)}
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-[#0d1526]">
              <span className="shrink-0 text-cyan-500">{Icons.shield}</span>
              <p className="text-xs font-semibold leading-4 text-slate-600 dark:text-slate-300">Whole document translated — layout, borders & alignment preserved</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-[#0d1526]">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Download Options</p>
              <div className="flex gap-2">
                {(["pdf", "doc", "txt", "html"] as const).map((format) => (
                  <button key={format} type="button" onClick={() => downloadAs(format)} className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-2 text-[10px] font-bold text-slate-600 transition hover:border-cyan-400 hover:text-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    {Icons.download}{format === "doc" ? "DOCX" : format.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={handleProcess} disabled={processing} className="flex-1 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50">
              {processing ? "Processing…" : processed ? "Re-process Document" : "Process Document"}
            </button>
            <button type="button" onClick={downloadAll} disabled={!processed} className="flex-1 rounded-2xl border border-cyan-400/50 bg-cyan-500/10 px-6 py-3.5 text-sm font-bold text-cyan-600 transition hover:bg-cyan-500/20 disabled:opacity-40 dark:text-cyan-400">
              Download All Formats
            </button>
          </div>
        </section>
      </div>

      {/* ✅ NEW: RECENT DOCUMENT HISTORY SECTION */}
      <section className="mt-8 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)] dark:border-cyan-500/20 dark:bg-[#0b1220] dark:shadow-[0_0_50px_-20px_rgba(34,211,238,0.25)]">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-500">
              <Svg className="w-5 h-5"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></Svg>
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Recent Document History</h3>
          </div>
          <button 
            onClick={fetchDocHistory} 
            disabled={historyLoading}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Svg className={`w-3.5 h-3.5 ${historyLoading ? "animate-spin" : ""}`}><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></Svg>
            Refresh
          </button>
        </div>

        <div className="space-y-3">
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <Svg className="w-6 h-6 animate-spin text-cyan-500"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></Svg>
            </div>
          ) : docHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Svg className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></Svg>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No document history yet.</p>
              <p className="text-xs text-slate-400 mt-1">Upload and translate a document to see it here.</p>
            </div>
          ) : (
            docHistory.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 transition-all hover:border-cyan-300 dark:border-slate-700 dark:bg-[#0d1526] dark:hover:border-cyan-700">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Svg className="w-5 h-5"><path d="M5 12l4 4L19 6" /></Svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                    {item.metadata?.output || item.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400 font-bold uppercase">
                      {item.metadata?.outputFormat || "DOC"}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      {item.metadata?.pages ? `${item.metadata.pages} pages • ` : ""}
                      {item.metadata?.size ? `${(item.metadata.size / 1024 / 1024).toFixed(2)} MB` : ""}
                    </span>
                  </div>
                </div>
                
                {item.output_file_url ? (
                  <a 
                    href={`${API_BASE.replace('/api', '')}${item.output_file_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-2 text-[10px] font-bold text-white hover:bg-cyan-600 transition-colors shrink-0 shadow-sm"
                  >
                    <Svg className="w-3.5 h-3.5"><path d="M12 4v12" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></Svg>
                    Download
                  </a>
                ) : (
                  <button disabled className="flex items-center gap-1.5 rounded-lg bg-slate-300 dark:bg-slate-700 px-3.5 py-2 text-[10px] font-bold text-slate-500 cursor-not-allowed shrink-0">
                    <Svg className="w-3.5 h-3.5"><path d="M12 4v12" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></Svg>
                    Processing
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default DocumentsPage;