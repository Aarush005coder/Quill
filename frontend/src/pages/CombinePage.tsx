import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
} from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FileImage,
  FileOutput,
  FileText,
  FileSpreadsheet,
  ImagePlus,
  RotateCw,
  Sparkles,
  Upload,
  WandSparkles,
  Zap,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
  History,
  Download,
  Clock,
  RefreshCw,
  MoreVertical,
  Trash2,
  Share2,
  Pin,
  Copy,
  Link2,
  Check,
  Palette,
  Grid3x3,
  Layout,
  Maximize2,
  Type,
  Target,
  Layers,
  List,
  Eye,
  GripVertical,
  Undo2,
  RotateCcw,
  Info,
  Settings,
  Sun,
  Contrast,
  MoveVertical,
  Files,
  Scissors,
  Rows3,
  Filter,
  Square,
  RectangleHorizontal,
  RectangleVertical,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { jsPDF } from "jspdf";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
} from "docx";
// @ts-ignore
import * as mammoth from "mammoth/mammoth.browser";

/* =========================================================
SOCIAL ICONS
========================================================= */
const WhatsAppIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579.487-.5-.669-.51-.173-.008-.371-.01-.57.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.485-8.413z" />
  </svg>
);
const TwitterIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

/* =========================================================
PDF JS
========================================================= */
const pdfjsVersion = (pdfjsLib as any).version || "4.0.379";
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
}

/* =========================================================
TOOLS
========================================================= */
const tools = [
  {
    name: "PDF Merge",
    description: "Merge multiple PDF files into a single document",
    category: "Merge",
    icon: FileText,
    iconBg: "bg-red-50 dark:bg-red-900/30",
    iconColor: "text-red-500",
    accept: ".pdf",
    multiple: true,
    endpoint: "/api/combine/pdf-merge/",
    historyType: "pdf_merge",
  },
  {
    name: "Image Merge",
    description: "Combine images side by side or vertically",
    category: "Merge",
    icon: ImagePlus,
    iconBg: "bg-purple-50 dark:bg-purple-900/30",
    iconColor: "text-purple-500",
    accept: "image/*",
    multiple: true,
    endpoint: "/api/combine/image-merge/",
    historyType: "image_merge",
  },
  {
    name: "Image to PDF",
    description: "Convert JPG, PNG, WEBP images to PDF",
    category: "Convert",
    icon: FileImage,
    iconBg: "bg-blue-50 dark:bg-blue-900/30",
    iconColor: "text-blue-500",
    accept: "image/*",
    multiple: true,
    endpoint: "/api/combine/image-to-pdf/",
    historyType: "image_to_pdf",
  },
  {
    name: "Image Converter",
    description: "Convert images to JPG, JPEG, PNG, WEBP, GIF, BMP, TIFF, ICO or SVG",
    category: "Convert",
    icon: FileImage,
    iconBg: "bg-violet-50 dark:bg-violet-900/30",
    iconColor: "text-violet-500",
    accept: "image/*",
    multiple: false,
    endpoint: "/api/combine/image-convert/",
    historyType: "image_convert",
  },
  {
    name: "Word Merge",
    description: "Merge multiple Word documents",
    category: "Merge",
    icon: FileText,
    iconBg: "bg-blue-50 dark:bg-blue-900/30",
    iconColor: "text-blue-600",
    accept: ".doc,.docx",
    multiple: true,
    endpoint: "/api/combine/word-merge/",
    historyType: "word_merge",
  },
  {
    name: "PDF to Word",
    description: "Convert PDF files to editable Word documents",
    category: "Convert",
    icon: FileOutput,
    iconBg: "bg-green-50 dark:bg-green-900/30",
    iconColor: "text-green-500",
    accept: ".pdf",
    multiple: false,
    endpoint: "/api/combine/pdf-to-word/",
    historyType: "pdf_to_word",
  },
  {
    name: "PDF to Excel",
    description: "Extract PDF tables and content into Excel",
    category: "Convert",
    icon: FileSpreadsheet,
    iconBg: "bg-emerald-50 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600",
    accept: ".pdf",
    multiple: false,
    endpoint: "/api/combine/pdf-to-excel/",
    historyType: "pdf_to_excel",
  },
  {
    name: "Excel to PDF",
    description: "Convert Excel spreadsheets into PDF documents",
    category: "Convert",
    icon: FileSpreadsheet,
    iconBg: "bg-green-50 dark:bg-green-900/30",
    iconColor: "text-green-600",
    accept: ".xlsx,.xls",
    multiple: false,
    endpoint: "/api/combine/excel-to-pdf/",
    historyType: "excel_to_pdf",
  },
  {
    name: "Word to PDF",
    description: "Convert Word documents to PDF files",
    category: "Convert",
    icon: FileText,
    iconBg: "bg-orange-50 dark:bg-orange-900/30",
    iconColor: "text-orange-500",
    accept: ".doc,.docx",
    multiple: false,
    endpoint: "/api/combine/word-to-pdf/",
    historyType: "word_to_pdf",
  },
  {
    name: "PDF Compress",
    description: "Reduce PDF file size without losing quality",
    category: "Optimize",
    icon: Zap,
    iconBg: "bg-red-50 dark:bg-red-900/30",
    iconColor: "text-red-500",
    accept: ".pdf",
    multiple: false,
    endpoint: "/api/combine/compress-pdf/",
    historyType: "compress_pdf",
  },
  {
    name: "Rotate PDF",
    description: "Rotate PDF pages to required orientation",
    category: "Edit",
    icon: RotateCw,
    iconBg: "bg-cyan-50 dark:bg-cyan-900/30",
    iconColor: "text-cyan-500",
    accept: ".pdf",
    multiple: false,
    endpoint: "/api/combine/rotate-pdf/",
    historyType: "rotate_pdf",
  },
  {
    name: "Split PDF",
    description: "Keep or remove specific PDF pages using all, even, odd or custom selection",
    category: "Edit",
    icon: Scissors,
    iconBg: "bg-amber-50 dark:bg-amber-900/30",
    iconColor: "text-amber-600",
    accept: ".pdf",
    multiple: false,
    endpoint: "/api/combine/split-pdf/",
    historyType: "split_pdf",
  },
  {
    name: "Organize PDF",
    description: "Reorder, remove, or arrange PDF pages in any order",
    category: "Edit",
    icon: Layout,
    iconBg: "bg-teal-50 dark:bg-teal-900/30",
    iconColor: "text-teal-500",
    accept: ".pdf",
    multiple: false,
    endpoint: "/api/combine/organize-pdf/",
    historyType: "organize_pdf",
  },
  {
    name: "Watermark PDF",
    description: "Add text or image watermark to PDF",
    category: "Edit",
    icon: WandSparkles,
    iconBg: "bg-purple-50 dark:bg-purple-900/30",
    iconColor: "text-purple-500",
    accept: ".pdf",
    multiple: false,
    endpoint: "/api/combine/watermark-pdf/",
    historyType: "watermark_pdf",
  },
  {
    name: "PDF Color Enhance",
    description: "Whiten BG + black text, grayscale, high contrast",
    category: "Edit",
    icon: Palette,
    iconBg: "bg-pink-50 dark:bg-pink-900/30",
    iconColor: "text-pink-500",
    accept: ".pdf",
    multiple: false,
    endpoint: "/api/combine/pdf-color-enhance/",
    historyType: "pdf_color_enhance",
  },
  {
    name: "N-up PDF",
    description: "Combine PDF pages OR images into a single sheet",
    category: "Optimize",
    icon: Grid3x3,
    iconBg: "bg-indigo-50 dark:bg-indigo-900/30",
    iconColor: "text-indigo-500",
    accept: ".pdf,image/*",
    multiple: true,
    endpoint: "/api/combine/nup-pdf/",
    historyType: "nup_pdf",
  },
];

const categories = ["All Tools", "Merge", "Convert", "Optimize", "Edit"];
const MIN_MERGE_FILES = 2;
const MAX_MERGE_FILES = 10;

/* =========================================================
HELPERS
========================================================= */
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const wrapHtml = (body: string, title: string) => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:20px;line-height:1.6;}p{margin:6px 0;}img{max-width:100%;margin:10px 0;}pre{white-space:pre-wrap;}</style></head><body>${body}</body></html>`;
const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
};

/* =========================================================
TYPES
========================================================= */
interface HistoryItem {
  id: string;
  operation_type: string;
  output_name: string;
  output_size: number;
  status: string;
  created_at: string;
  completed_at: string | null;
  download_url?: string;
}
interface Toast {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}
interface PageThumbnail {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

/* =========================================================
N-UP GRID PREVIEW
========================================================= */
const MiniGrid = ({ n, active }: { n: number; active: boolean }) => {
  const cols = n === 2 ? 2 : n === 3 ? 3 : n === 4 ? 2 : n === 6 ? 3 : 3;
  const rows = n === 2 ? 1 : n === 3 ? 1 : n === 4 ? 2 : n === 6 ? 2 : 3;
  return (
    <div className="grid gap-[2px] w-12 h-9 mx-auto" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className={`rounded-[2px] ${active ? "bg-indigo-500" : "bg-slate-300 dark:bg-slate-600"}`} />
      ))}
    </div>
  );
};

/* =========================================================
COMPONENT
========================================================= */
export default function CombinePage() {
  const [activeCategory, setActiveCategory] = useState("All Tools");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [activeTool, setActiveTool] = useState<typeof tools[0] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [processedFilename, setProcessedFilename] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [nupMode, setNupMode] = useState<"pdf" | "images">("pdf");
  const nupTouchX = useRef<number | null>(null);

  const [enhanceOpen, setEnhanceOpen] = useState(true);
  const [watermarkOpen, setWatermarkOpen] = useState(true);
  const [splitOpen, setSplitOpen] = useState(true);
  const [organizeOpen, setOrganizeOpen] = useState(true);
  const [nupOpen, setNupOpen] = useState(true);

  /* ORGANIZE */
  const [pageThumbnails, setPageThumbnails] = useState<PageThumbnail[]>([]);
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [originalPageOrder, setOriginalPageOrder] = useState<number[]>([]);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [draggedPageIndex, setDraggedPageIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [organizeHistory, setOrganizeHistory] = useState<number[][]>([]);
  const organizeScrollRef = useRef<HTMLDivElement | null>(null);
  const organizeAutoScrollRef = useRef<number | null>(null);

  const [toolOptions, setToolOptions] = useState<Record<string, any>>({
    quality: "medium",
    rotation: 90,
    watermark_text: "quill",
    watermark_pages: "all",
    watermark_custom_pages: "",
    watermark_size: "medium",
    split_mode: "keep",
    split_pages: "",
    split_parity: "all",
    image_output_format: "png",
    image_quality: 92,
    color_effects: [] as string[],
    color_intensity: 50,
    nup_pages: 4,
    nup_spacing: "small",
    nup_border: true,
    nup_layout: "grid",
    nup_page_size: "a4",
    nup_orientation: "portrait",
    nup_margin: "medium",
    nup_fit: "fit",
    nup_border_color: "#64748b",
    nup_bg_color: "#ffffff",
  });

  /* HISTORY */
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showClearHistoryModal, setShowClearHistoryModal] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareItem, setShareItem] = useState<HistoryItem | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    try {
      const value = localStorage.getItem("combine_pinned_ids");
      return value ? new Set(JSON.parse(value)) : new Set();
    } catch {
      return new Set();
    }
  });

  const menuRef = useRef<HTMLDivElement | null>(null);
  const toastIdRef = useRef(0);

  const filteredTools = activeCategory === "All Tools" ? tools : tools.filter((tool) => tool.category === activeCategory);
  const isEnhance = activeTool?.name === "PDF Color Enhance";
  const isWatermark = activeTool?.name === "Watermark PDF";
  const isSplit = activeTool?.name === "Split PDF";
  const isOrganize = activeTool?.name === "Organize PDF";
  const isNup = activeTool?.name === "N-up PDF";

  const showToast = (type: Toast["type"], message: string) => {
    const id = ++toastIdRef.current;
    setToasts((previous) => [...previous, { id, type, message }]);
    setTimeout(() => { setToasts((previous) => previous.filter((item) => item.id !== id)); }, 3000);
  };

  /* =========================================================
  MENU EVENTS
  ========================================================= */
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
        setMenuPosition(null);
      }
    };
    const closeMenu = () => { setActiveMenuId(null); setMenuPosition(null); };
    if (activeMenuId) {
      document.addEventListener("mousedown", handleClick);
      window.addEventListener("scroll", closeMenu, true);
      window.addEventListener("resize", closeMenu);
    }
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, [activeMenuId]);

  /* =========================================================
  ORGANIZE AUTO SCROLL
  ========================================================= */
  const stopOrganizeAutoScroll = () => {
    if (organizeAutoScrollRef.current !== null) {
      cancelAnimationFrame(organizeAutoScrollRef.current);
      organizeAutoScrollRef.current = null;
    }
  };
  useEffect(() => { return () => { stopOrganizeAutoScroll(); }; }, []);

  /* =========================================================
  VALIDATION
  ========================================================= */
  const validation = useMemo(() => {
    if (!activeTool) return { valid: true, message: "" };
    if (isWatermark && toolOptions.watermark_pages === "custom" && !toolOptions.watermark_custom_pages.trim()) {
      return { valid: false, message: "Please enter custom page numbers." };
    }
    if (isSplit && toolOptions.split_parity === "custom" && !toolOptions.split_pages.trim()) {
      return { valid: false, message: "Please enter custom pages, e.g. 1-5, 7, 9." };
    }
    if (isOrganize) {
      if (selectedFiles.length === 0) return { valid: false, message: "Please upload a PDF file." };
      if (pageOrder.length === 0) return { valid: false, message: "At least one page must remain." };
      return { valid: true, message: `✓ ${pageOrder.length} pages ready to organize` };
    }
    const count = selectedFiles.length;
    const isMerge = activeTool.category === "Merge";
    if (count === 0) return { valid: false, message: "Please upload at least 1 file." };
    if (isMerge) {
      if (count < MIN_MERGE_FILES) return { valid: false, message: `At least ${MIN_MERGE_FILES} files required.` };
      if (count > MAX_MERGE_FILES) return { valid: false, message: `Maximum ${MAX_MERGE_FILES} files allowed.` };
    }
    if (!isMerge && !activeTool.multiple && count > 1) return { valid: false, message: "This tool accepts only 1 file." };
    if (activeTool.multiple && count > MAX_MERGE_FILES) return { valid: false, message: `Maximum ${MAX_MERGE_FILES} files allowed.` };
    return { valid: true, message: `✓ ${count} file${count > 1 ? "s" : ""} ready to process` };
  }, [activeTool, selectedFiles, pageOrder, isOrganize, isWatermark, isSplit, toolOptions.watermark_pages, toolOptions.watermark_custom_pages, toolOptions.split_parity, toolOptions.split_pages]);

  /* =========================================================
  COMPRESS PREVIEW
  ========================================================= */
  const compressPreview = useMemo(() => {
    if (activeTool?.name !== "PDF Compress" || selectedFiles.length === 0) return null;
    const originalSize = selectedFiles[0].size;
    const ratioMap = { low: 0.45, medium: 0.65, high: 0.85 };
    const ratio = ratioMap[toolOptions.quality as keyof typeof ratioMap] || 0.65;
    const compressedSize = Math.round(originalSize * ratio);
    const savedPercent = Math.round(((originalSize - compressedSize) / originalSize) * 100);
    return { originalSize, compressedSize, savedPercent };
  }, [activeTool, selectedFiles, toolOptions.quality]);

  /* =========================================================
  N-UP CALCULATION
  ========================================================= */
  const nupColsRows = useMemo((): [number, number] => {
    const count = toolOptions.nup_pages;
    if (toolOptions.nup_layout === "horizontal") return [count, 1];
    if (toolOptions.nup_layout === "vertical") return [1, count];
    const map: Record<number, [number, number]> = {
      2: [2, 1], 3: [3, 1], 4: [2, 2], 5: [3, 2], 6: [3, 2],
      7: [4, 2], 8: [4, 2], 9: [3, 3], 10: [5, 2],
    };
    return map[count] || [2, 2];
  }, [toolOptions.nup_pages, toolOptions.nup_layout]);

  const nupGapPx = ({ none: "0px", small: "3px", medium: "6px", large: "10px" } as any)[toolOptions.nup_spacing] || "3px";
  const uploadAccept = activeTool ? (activeTool.name === "N-up PDF" ? (nupMode === "pdf" ? ".pdf" : "image/*") : activeTool.accept) : "";

  /* =========================================================
  ENHANCE
  ========================================================= */
  const toggleColorEffect = (value: string) => {
    setToolOptions((previous) => {
      let next = [...(previous.color_effects || [])];
      if (value === "original") next = [];
      else next = next.includes(value) ? next.filter((item) => item !== value) : [...next, value];
      return { ...previous, color_effects: next };
    });
  };

  /* =========================================================
  N-UP SWITCH
  ========================================================= */
  const changeNupMode = (mode: "pdf" | "images") => {
    if (mode === nupMode) return;
    setNupMode(mode);
    setSelectedFiles([]);
    setProcessedBlob(null);
    setStatusMsg(null);
  };

  /* =========================================================
  AUTH
  ========================================================= */
  const getAuthToken = async (API_BASE: string): Promise<string | null> => {
    let token = localStorage.getItem("access_token");
    const refreshToken = localStorage.getItem("refresh_token");
    if (!token) return null;
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1]));
      if (payload.exp - Date.now() / 1000 < 60 && refreshToken) {
        const response = await fetch(`${API_BASE}/api/token/refresh/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh: refreshToken }) });
        if (response.ok) {
          const data = await response.json();
          if (data.access) { token = data.access; localStorage.setItem("access_token", data.access); }
          if (data.refresh) localStorage.setItem("refresh_token", data.refresh);
        } else return null;
      }
    } catch (error) { console.error("Token error:", error); }
    return token;
  };

  /* =========================================================
  HISTORY
  ========================================================= */
  const fetchHistory = async (tool: typeof tools[0]) => {
    setHistoryLoading(true);
    const API_BASE = (process.env.REACT_APP_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "") + "/api";
    const token = await getAuthToken(API_BASE);
    if (!token) { setHistoryLoading(false); return; }
    const url = `${API_BASE}/api/combine/history/?type=${tool.historyType}&page_size=10`;
    try {
      let response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (response.status === 401) {
        const secondToken = await getAuthToken(API_BASE);
        if (secondToken) response = await fetch(url, { headers: { Authorization: `Bearer ${secondToken}` } });
      }
      if (response.ok) { const data = await response.json(); setHistory(data.data || []); }
    } catch (error) { console.error("History error:", error); } finally { setHistoryLoading(false); }
  };

  useEffect(() => {
    if (!activeTool) { setHistory([]); return; }
    fetchHistory(activeTool);
  }, [activeTool]);

  /* =========================================================
  ORGANIZE PAGES
  ========================================================= */
  const loadOrganizePages = async (file: File) => {
    setIsLoadingPages(true);
    try {
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
      const thumbnails: PageThumbnail[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.38 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width; canvas.height = viewport.height;
        const context = canvas.getContext("2d");
        if (!context) continue;
        await page.render({ canvasContext: context, viewport } as any).promise;
        thumbnails.push({ pageNumber: i, dataUrl: canvas.toDataURL("image/jpeg", 0.82), width: viewport.width, height: viewport.height });
      }
      const order = thumbnails.map((item) => item.pageNumber);
      setPageThumbnails(thumbnails); setPageOrder(order); setOriginalPageOrder([...order]); setOrganizeHistory([]); setOrganizeOpen(true);
    } catch (error) { console.error("PDF page load error:", error); showToast("error", "Failed to load PDF pages."); } finally { setIsLoadingPages(false); }
  };

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files) return;
    const array = Array.from(files);
    if (isOrganize) {
      const file = array[0];
      if (!file || !file.name.toLowerCase().endsWith(".pdf")) { showToast("error", "Please select a PDF file."); return; }
      setSelectedFiles([file]); setProcessedBlob(null); setStatusMsg(null);
      await loadOrganizePages(file); return;
    }
    setSelectedFiles((previous) => (activeTool && !activeTool.multiple ? [array[array.length - 1]] : [...previous, ...array]));
    if (activeTool?.name === "PDF Color Enhance") setEnhanceOpen(true);
    if (activeTool?.name === "Watermark PDF") setWatermarkOpen(true);
    if (activeTool?.name === "Split PDF") setSplitOpen(true);
    if (activeTool?.name === "N-up PDF") setNupOpen(true);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); void handleFiles(event.dataTransfer.files); };
  const removeFile = (index: number) => {
    setSelectedFiles((previous) => previous.filter((_, i) => i !== index));
    if (isOrganize) { setPageThumbnails([]); setPageOrder([]); setOriginalPageOrder([]); setOrganizeHistory([]); }
  };

  const clearOrganizeState = () => {
    stopOrganizeAutoScroll(); setPageThumbnails([]); setPageOrder([]); setOriginalPageOrder([]); setOrganizeHistory([]); setDraggedPageIndex(null); setDragOverIndex(null);
  };

  const handleBack = () => {
    setActiveTool(null); setSelectedFiles([]); setProcessedBlob(null); setProcessedFilename(""); setStatusMsg(null); setProcessStep(""); clearOrganizeState(); setEnhanceOpen(true); setWatermarkOpen(true); setSplitOpen(true); setNupOpen(true); setOrganizeOpen(true);
  };

  const handleProcessAnother = () => {
    setSelectedFiles([]); setProcessedBlob(null); setProcessedFilename(""); setStatusMsg(null); setProcessStep(""); clearOrganizeState(); setEnhanceOpen(true); setWatermarkOpen(true); setSplitOpen(true); setNupOpen(true); setOrganizeOpen(true);
  };

  /* =========================================================
  ORGANIZE ACTIONS
  ========================================================= */
  const saveOrganizeSnapshot = () => { setOrganizeHistory((previous) => [...previous, [...pageOrder]]); };
  const moveOrganizePage = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= pageOrder.length || to >= pageOrder.length) return;
    saveOrganizeSnapshot();
    setPageOrder((previous) => { const next = [...previous]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); return next; });
  };

  const removeOrganizePage = (index: number) => {
    if (pageOrder.length <= 1) { showToast("error", "At least one page must remain."); return; }
    saveOrganizeSnapshot(); setPageOrder((previous) => previous.filter((_, i) => i !== index)); showToast("success", "Page removed from output.");
  };

  const resetOrganizeOrder = () => { setPageOrder([...originalPageOrder]); setOrganizeHistory([]); setDraggedPageIndex(null); setDragOverIndex(null); showToast("success", "Page order reset."); };
  const undoOrganizeAction = () => {
    setOrganizeHistory((previous) => {
      if (previous.length === 0) return previous;
      const next = [...previous]; const last = next.pop();
      if (last) setPageOrder([...last]);
      return next;
    });
    showToast("success", "Last change undone.");
  };

  const startOrganizeAutoScroll = (direction: "up" | "down") => {
    if (organizeAutoScrollRef.current !== null) return;
    const tick = () => {
      const container = organizeScrollRef.current;
      if (!container) { organizeAutoScrollRef.current = null; return; }
      container.scrollTop += direction === "up" ? -8 : 8;
      organizeAutoScrollRef.current = requestAnimationFrame(tick);
    };
    organizeAutoScrollRef.current = requestAnimationFrame(tick);
  };

  const handleOrganizeDragStart = (event: React.DragEvent, index: number) => { setDraggedPageIndex(index); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(index)); };
  const handleOrganizeDragOver = (event: React.DragEvent, index: number) => {
    event.preventDefault();
    const container = organizeScrollRef.current;
    if (container) {
      const rect = container.getBoundingClientRect(); const threshold = 100;
      if (event.clientY < rect.top + threshold) startOrganizeAutoScroll("up");
      else if (event.clientY > rect.bottom - threshold) startOrganizeAutoScroll("down");
      else stopOrganizeAutoScroll();
    }
    setDragOverIndex(index);
  };

  const handleOrganizeDrop = (event: React.DragEvent, index: number) => {
    event.preventDefault(); stopOrganizeAutoScroll();
    const raw = event.dataTransfer.getData("text/plain"); const from = Number(raw);
    if (!Number.isNaN(from)) moveOrganizePage(from, index);
    setDraggedPageIndex(null); setDragOverIndex(null);
  };

  const handleOrganizeDragEnd = () => { stopOrganizeAutoScroll(); setDraggedPageIndex(null); setDragOverIndex(null); };

  /* =========================================================
  PDF HELPERS
  ========================================================= */
  const extractTextFromPdf = async (blob: Blob): Promise<string> => {
    try {
      const buffer = await blob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
      let result = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(" ").trim();
        if (pageText) result += pageText + "\n";
      }
      return result.trim();
    } catch { return ""; }
  };

  const pdfToPageImages = async (blob: Blob, maxPages = 50) => {
    try {
      const buffer = await blob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
      const images: { dataUrl: string; w: number; h: number }[] = [];
      const count = Math.min(pdf.numPages, maxPages);
      for (let i = 1; i <= count; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width; canvas.height = viewport.height;
        const context = canvas.getContext("2d");
        if (!context) continue;
        await page.render({ canvas, canvasContext: context, viewport } as any).promise;
        images.push({ dataUrl: canvas.toDataURL("image/png"), w: viewport.width, h: viewport.height });
      }
      return images;
    } catch { return []; }
  };

  const dataUrlToUint8 = (dataUrl: string) => {
    const binary = atob(dataUrl.split(",")[1]);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    return array;
  };

  const dataUrlToBlob = (dataUrl: string, type: string) => {
    const binary = atob(dataUrl.split(",")[1]);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    return new Blob([array], { type });
  };

  const dataUrlToJpgBlob = (dataUrl: string): Promise<Blob> => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) { reject(new Error("No canvas context")); return; }
      context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Conversion failed")), "image/jpeg", 0.92);
    };
    image.onerror = reject; image.src = dataUrl;
  });

  const docxToText = async (blob: Blob) => { try { const buffer = await blob.arrayBuffer(); const result = await mammoth.extractRawText({ arrayBuffer: buffer }); return result.value || ""; } catch { return ""; } };
  const docxToHtml = async (blob: Blob) => { try { const buffer = await blob.arrayBuffer(); const result = await mammoth.convertToHtml({ arrayBuffer: buffer }); return result.value || ""; } catch { return ""; } };

  const textToPdfBlob = (text: string) => {
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40; const width = pdf.internal.pageSize.getWidth(); const height = pdf.internal.pageSize.getHeight();
    const lines = pdf.splitTextToSize(text, width - margin * 2);
    let y = margin;
    for (const line of lines) {
      if (y + 14 > height - margin) { pdf.addPage(); y = margin; }
      pdf.text(line, margin, y); y += 14;
    }
    return pdf.output("blob");
  };

  const imageToPdfBlob = (blob: Blob): Promise<Blob> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const pdf = new jsPDF({ orientation: image.width > image.height ? "landscape" : "portrait", unit: "pt", format: [image.width, image.height] });
        pdf.addImage(reader.result as string, "JPEG", 0, 0, image.width, image.height);
        resolve(pdf.output("blob"));
      };
      image.onerror = reject; image.src = reader.result as string;
    };
    reader.onerror = reject; reader.readAsDataURL(blob);
  });

  const convertImage = (blob: Blob, format: string): Promise<Blob> => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) { URL.revokeObjectURL(url); reject(new Error("No canvas context")); return; }
      if (format !== "png") { context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height); }
      context.drawImage(image, 0, 0);
      canvas.toBlob((result) => { URL.revokeObjectURL(url); result ? resolve(result) : reject(new Error("Conversion failed")); }, format === "png" ? "image/png" : "image/jpeg", 0.92);
    };
    image.onerror = reject; image.src = url;
  });

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    URL.revokeObjectURL(url);
  };

  /* =========================================================
  DOWNLOAD FORMAT
  ========================================================= */
  const getExt = (filename: string) => filename.toLowerCase().split(".").pop() || "";
  const isImageExt = (extension: string) => ["jpg", "jpeg", "png", "webp"].includes(extension);
  const getDownloadFormats = (filename: string) => {
    const extension = getExt(filename);
    if (extension === "pdf") return ["pdf", "txt", "html", "docx"];
    if (extension === "docx" || extension === "doc") return ["docx", "pdf", "txt", "html"];
    if (["jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "ico", "svg"].includes(extension)) return ["original"];
    return ["original"];
  };

  const downloadPdfAsImages = async (format: "png" | "jpg") => {
    if (!processedBlob) return;
    const images = await pdfToPageImages(processedBlob, 50);
    if (!images.length) { showToast("error", "No pages to convert."); return; }
    const base = processedFilename.replace(/\.[^.]+$/, "");
    for (let i = 0; i < images.length; i++) {
      if (format === "png") triggerDownload(dataUrlToBlob(images[i].dataUrl, "image/png"), `${base}_page_${i + 1}.png`);
      else triggerDownload(await dataUrlToJpgBlob(images[i].dataUrl), `${base}_page_${i + 1}.jpg`);
    }
    showToast("success", "Download successfully!");
  };

  const downloadAs = async (format: string) => {
    if (!processedBlob) return;
    const extension = getExt(processedFilename);
    const base = processedFilename.replace(/\.[^.]+$/, "");
    setIsExtracting(true);
    try {
      if (format === "original") { triggerDownload(processedBlob, processedFilename); showToast("success", "Download successfully!"); return; }
      if (extension === "pdf" && ["png", "jpg"].includes(format)) { await downloadPdfAsImages(format as "png" | "jpg"); return; }
      let text = ""; let html = ""; let images: any[] = [];
      if (extension === "pdf") { text = await extractTextFromPdf(processedBlob); if (!text) images = await pdfToPageImages(processedBlob, 5); }
      if (extension === "docx" || extension === "doc") { text = await docxToText(processedBlob); html = await docxToHtml(processedBlob); }
      switch (format) {
        case "txt": triggerDownload(new Blob([text || "(No extractable text)"], { type: "text/plain;charset=utf-8" }), `${base}.txt`); break;
        case "html": {
          let body = "";
          if (html) body = html;
          else if (text) body = text.split(/\n/).filter((item) => item.trim()).map((item) => `<p>${escapeHtml(item)}</p>`).join("");
          else if (images.length) body = images.map((item) => `<img src="${item.dataUrl}" style="max-width:100%;margin:10px 0;"/>`).join("");
          else body = "<p>No content available.</p>";
          triggerDownload(new Blob([wrapHtml(body, base)], { type: "text/html;charset=utf-8" }), `${base}.html`); break;
        }
        case "docx": {
          const children: any[] = [];
          if (text) text.split(/\n/).forEach((line) => children.push(new Paragraph({ children: [new TextRun(line)] })));
          else if (images.length) images.forEach((image) => children.push(new Paragraph({ children: [new ImageRun({ type: "png", data: dataUrlToUint8(image.dataUrl), transformation: { width: 600, height: Math.round(600 * image.h / image.w) } } as any)] })));
          const document = new Document({ sections: [{ children }] });
          triggerDownload(await Packer.toBlob(document), `${base}.docx`); break;
        }
        case "pdf":
          if (extension === "pdf") triggerDownload(processedBlob, processedFilename);
          else if (isImageExt(extension)) triggerDownload(await imageToPdfBlob(processedBlob), `${base}.pdf`);
          else triggerDownload(textToPdfBlob(text), `${base}.pdf`);
          break;
        case "png": case "jpg": triggerDownload(await convertImage(processedBlob, format), `${base}.${format}`); break;
      }
      showToast("success", "Download successfully!");
    } catch { showToast("error", `Conversion to ${format.toUpperCase()} failed.`); } finally { setIsExtracting(false); }
  };

  /* =========================================================
  HISTORY DOWNLOAD
  ========================================================= */
  const downloadFromHistory = async (item: HistoryItem) => {
    if (!item.download_url) return;
    const API_BASE = `${(process.env.REACT_APP_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "")}/api`;
    const token = await getAuthToken(API_BASE);
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE}${item.download_url}`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) { triggerDownload(await response.blob(), item.output_name || "download"); showToast("success", "Download successfully!"); }
    } catch (error) { console.error("Download error:", error); }
  };

  const refreshHistory = async () => { if (activeTool) await fetchHistory(activeTool); };

  /* =========================================================
  DELETE
  ========================================================= */
  const deleteHistoryItem = async (item: HistoryItem) => {
    setDeletingIds((previous) => new Set(previous).add(item.id));
    setActiveMenuId(null); setMenuPosition(null);
    const API_BASE = `${(process.env.REACT_APP_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "")}/api`;
    try {
      const token = await getAuthToken(API_BASE);
      await fetch(`${API_BASE}/api/combine/${item.id}/delete/`, { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : {} });
    } catch (error) { console.error("Delete error:", error); }
    setHistory((previous) => previous.filter((entry) => entry.id !== item.id));
    showToast("success", `${item.output_name} deleted`);
    setDeletingIds((previous) => { const next = new Set(previous); next.delete(item.id); return next; });
  };

  const clearAllHistory = async () => {
    setClearingHistory(true);
    const API_BASE = `${(process.env.REACT_APP_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "")}/api`;
    const token = await getAuthToken(API_BASE);
    for (const item of history) { try { await fetch(`${API_BASE}/api/combine/${item.id}/delete/`, { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : {} }); } catch {} }
    setHistory([]); setClearingHistory(false); setShowClearHistoryModal(false); showToast("success", "All history deleted");
  };

  const togglePin = (id: string) => {
    const next = new Set(pinnedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPinnedIds(next); localStorage.setItem("combine_pinned_ids", JSON.stringify(Array.from(next)));
    setActiveMenuId(null); setMenuPosition(null);
  };

  const getShareUrl = (item: HistoryItem) => `${(process.env.REACT_APP_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "")}${item.download_url}`;
  const openShareModal = (item: HistoryItem) => { setShareItem(item); setShowShareModal(true); setCopiedLink(false); };
  const copyShareLink = async (item: HistoryItem) => {
    const url = getShareUrl(item);
    try { await navigator.clipboard.writeText(url); } catch {}
    setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000);
    showToast("success", "Link copied to clipboard");
  };

  const shareToWhatsApp = (item: HistoryItem) => { window.open(`https://wa.me/?text=${encodeURIComponent(`Check out my file: ${item.output_name}`)}`, "_blank"); };
  const shareToTwitter = (item: HistoryItem) => { window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Just processed "${item.output_name}" using quill!`)}`, "_blank"); };

  const openMenu = (event: React.MouseEvent, item: HistoryItem) => {
    event.stopPropagation();
    if (activeMenuId === item.id) { setActiveMenuId(null); setMenuPosition(null); return; }
    const rect = event.currentTarget.getBoundingClientRect();
    setMenuPosition({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    setActiveMenuId(item.id);
  };

  /* =========================================================
  PROCESS
  ========================================================= */
  const activeEffects = toolOptions.color_effects || [];
  const canProcessEnhance = !isEnhance || activeEffects.length > 0;

  const handleProcess = async () => {
    if (!activeTool || selectedFiles.length === 0 || !validation.valid || !canProcessEnhance) return;
    setIsProcessing(true); setStatusMsg(null); setProcessedBlob(null); setProcessStep("Preparing files...");
    const API_BASE = `${(process.env.REACT_APP_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "")}/api`;
    const formData = new FormData();
    if (activeTool.multiple) selectedFiles.forEach((file) => formData.append("files", file));
    else formData.append("file", selectedFiles[0]);

    if (activeTool.name === "PDF Compress") formData.append("quality", toolOptions.quality);
    if (activeTool.name === "Rotate PDF") formData.append("rotation", String(toolOptions.rotation));
    if (activeTool.name === "Organize PDF") formData.append("page_order", pageOrder.join(","));
    if (activeTool.name === "Watermark PDF") {
      formData.append("watermark_text", toolOptions.watermark_text);
      formData.append("watermark_pages", toolOptions.watermark_pages);
      if (toolOptions.watermark_pages === "custom") formData.append("watermark_custom_pages", toolOptions.watermark_custom_pages);
      formData.append("watermark_size", toolOptions.watermark_size);
    }
    if (activeTool.name === "Split PDF") {
      formData.append("split_mode", toolOptions.split_mode);
      formData.append("split_parity", toolOptions.split_parity);
      if (toolOptions.split_parity === "custom") formData.append("split_pages", toolOptions.split_pages);
      else formData.append("split_pages", toolOptions.split_pages || "");
    }
    if (activeTool.name === "Image Converter") { formData.append("output_format", toolOptions.image_output_format); formData.append("quality", String(toolOptions.image_quality)); }
    if (activeTool.name === "PDF Color Enhance") { formData.append("effects", activeEffects.join(",")); formData.append("intensity", String(toolOptions.color_intensity)); }
    if (activeTool.name === "N-up PDF") {
      formData.append("pages_per_sheet", String(toolOptions.nup_pages));
      formData.append("spacing", toolOptions.nup_spacing);
      formData.append("border", toolOptions.nup_border ? "true" : "false");
      formData.append("layout", toolOptions.nup_layout);
      formData.append("page_size", toolOptions.nup_page_size);
      formData.append("orientation", toolOptions.nup_orientation);
      formData.append("margin", toolOptions.nup_margin);
      formData.append("fit_mode", toolOptions.nup_fit);
      formData.append("border_color", toolOptions.nup_border_color);
      formData.append("bg_color", toolOptions.nup_bg_color);
    }
    if (activeTool.name === "Excel to PDF") formData.append("source_format", getExt(selectedFiles[0].name));

    try {
      const token = await getAuthToken(API_BASE);
      if (!token) throw new Error("Session expired. Please login again.");
      setProcessStep("Uploading & processing...");
      const headers = { Authorization: `Bearer ${token}` };
      const response = await fetch(`${API_BASE}${activeTool.endpoint}`, { method: "POST", headers, body: formData });
      if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.message || `Processing failed (${response.status})`); }
      const data = await response.json();
      if (!data.success || !data.download_url) throw new Error(data.message || "No download URL");
      setProcessStep("Preparing download...");
      const downloadResponse = await fetch(`${API_BASE}${data.download_url}`, { headers });
      if (!downloadResponse.ok) throw new Error("Download failed.");
      const blob = await downloadResponse.blob();
      const contentDisposition = downloadResponse.headers.get("Content-Disposition");
      let filename = data.output_name || "result.pdf";
      if (contentDisposition) { const match = /filename="([^"]*)"/.exec(contentDisposition); if (match?.[1]) filename = match[1]; }
      setProcessedBlob(blob); setProcessedFilename(filename);
      setStatusMsg({ type: "success", text: data.message || "Processing complete!" });
      setSelectedFiles([]); setProcessStep("");
      if (data.operation_id) {
        setHistory((previous) => [{ id: data.operation_id, operation_type: activeTool.historyType, output_name: filename, output_size: blob.size, status: "completed", created_at: new Date().toISOString(), completed_at: new Date().toISOString(), download_url: data.download_url }, ...previous].slice(0, 10));
      }
      if (isOrganize) clearOrganizeState();
    } catch (error: any) { setStatusMsg({ type: "error", text: error.message || "Failed to process files." }); setProcessStep(""); } finally { setIsProcessing(false); }
  };

  /* =========================================================
  FORMAT META
  ========================================================= */
  const downloadFormats = activeTool?.name === "N-up PDF" ? ["pdf", "png", "jpg"] : processedFilename ? getDownloadFormats(processedFilename) : [];
  const formatMeta: Record<string, { label: string; icon: React.ElementType }> = {
    original: { label: `Original (${getExt(processedFilename).toUpperCase()})`, icon: FileText },
    pdf: { label: "PDF", icon: FileText }, txt: { label: "TXT", icon: FileOutput },
    html: { label: "HTML", icon: FileImage }, docx: { label: "DOCX", icon: FileOutput },
    png: { label: "PNG", icon: FileImage }, jpg: { label: "JPG", icon: FileImage },
  };

  /* =========================================================
  SORT HISTORY
  ========================================================= */
  const sortedHistory = useMemo(() => [...history].sort((a, b) => {
    const aPin = pinnedIds.has(a.id) ? 1 : 0; const bPin = pinnedIds.has(b.id) ? 1 : 0;
    if (aPin !== bPin) return bPin - aPin;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  }), [history, pinnedIds]);

  const currentMenuItem = activeMenuId && menuPosition ? sortedHistory.find((item) => item.id === activeMenuId) : null;

  /* =========================================================
  RETURN
  ========================================================= */
  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#101828] dark:bg-[#0f172a] dark:text-slate-100">
      {/* TOAST */}
      <div className="fixed top-4 left-0 right-0 z-[400] flex flex-col items-center gap-2 pointer-events-none px-4">
        {toasts.map((toast) => (
          <div key={toast.id} className={`animate-[toastIn_0.3s_ease-out] inline-flex items-center gap-2.5 rounded-full border-2 px-5 py-2.5 shadow-lg ${toast.type === "success" ? "border-green-500 bg-green-50 dark:bg-green-900/30 dark:border-green-700" : toast.type === "error" ? "border-red-500 bg-red-50 dark:bg-red-900/30 dark:border-red-700" : "border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-700"}`}>
            {toast.type === "success" ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" /> : toast.type === "error" ? <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" /> : <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
            <p className={`text-xs font-bold ${toast.type === "success" ? "text-green-700 dark:text-green-400" : toast.type === "error" ? "text-red-700 dark:text-red-400" : "text-blue-700 dark:text-blue-400"}`}>{toast.message}</p>
          </div>
        ))}
      </div>

      {/* PDF COLOR ENHANCE SIDEBAR */}
      {isEnhance && selectedFiles.length > 0 && !processedBlob && (
        <>
          <button type="button" onClick={() => setEnhanceOpen(true)} className={`fixed right-0 top-1/2 z-[360] -translate-y-1/2 flex h-12 w-9 items-center justify-center rounded-l-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 shadow-lg transition-all duration-300 ${enhanceOpen ? "pointer-events-none translate-x-full opacity-0" : "translate-x-0 opacity-100"}`}>
            <ChevronRight className="h-5 w-5" />
          </button>
          <aside className={`fixed right-4 top-1/2 z-[350] w-[380px] max-w-[calc(100vw-32px)] -translate-y-1/2 rounded-2xl border border-pink-100 dark:border-pink-900/50 bg-white dark:bg-slate-800 shadow-2xl transition-all duration-500 ${enhanceOpen ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-[calc(100%+32px)] opacity-0"}`}>
            <button type="button" onClick={() => setEnhanceOpen(false)} className="absolute -left-3 top-6 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="p-5">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 text-white">
                  <Palette className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold">PDF Enhancement</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Clean • sharpen • improve scans</p>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { value: "whiten", label: "Black → White", desc: "White background + black text", icon: Sun },
                  { value: "grayscale", label: "Grayscale", desc: "Convert pages to clean gray", icon: Palette },
                  { value: "high_contrast", label: "High Contrast", desc: "Dark text + brighter background", icon: Contrast },
                  { value: "sharpen", label: "Sharpen Text", desc: "Make faded text and lines clearer", icon: Sparkles },
                  { value: "denoise", label: "Denoise / Despeckle", desc: "Reduce scan dots and paper noise", icon: WandSparkles },
                ].map((option) => {
                  const enabled = activeEffects.includes(option.value);
                  const Icon = option.icon;
                  return (
                    <button key={option.value} type="button" onClick={() => toggleColorEffect(option.value)} className={`group flex w-full items-center gap-3 rounded-xl border-2 px-3 py-3 text-left transition-all ${enabled ? "border-pink-500 bg-pink-50 dark:bg-pink-900/30" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"}`}>
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${enabled ? "bg-white dark:bg-slate-700 text-pink-500" : "bg-slate-50 dark:bg-slate-700 text-slate-400"}`}><Icon className="h-5 w-5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold">{option.label}</span>
                        <span className="mt-0.5 block text-[9px] text-slate-500 dark:text-slate-400">{option.desc}</span>
                      </span>
                      <span className={`relative h-6 w-11 shrink-0 rounded-full ${enabled ? "bg-pink-500" : "bg-slate-200 dark:bg-slate-600"}`}>
                        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Intensity</span>
                  <span className="text-[10px] font-bold text-pink-600">{toolOptions.color_intensity}%</span>
                </div>
                <input type="range" min="10" max="100" value={toolOptions.color_intensity} onChange={(e) => setToolOptions({ ...toolOptions, color_intensity: Number(e.target.value) })} className="enhance-range w-full" />
              </div>
            </div>
          </aside>
        </>
      )}

      {/* WATERMARK SIDEBAR */}
      {isWatermark && selectedFiles.length > 0 && !processedBlob && (
        <>
          <button type="button" onClick={() => setWatermarkOpen(true)} className={`fixed right-0 top-1/2 z-[360] -translate-y-1/2 flex h-12 w-9 items-center justify-center rounded-l-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${watermarkOpen ? "pointer-events-none opacity-0" : "opacity-100"}`}>
            <ChevronRight className="h-5 w-5" />
          </button>
          <aside className={`fixed right-4 top-1/2 z-[350] w-[380px] max-w-[calc(100vw-32px)] -translate-y-1/2 rounded-2xl bg-white dark:bg-slate-800 shadow-2xl transition-all duration-500 ${watermarkOpen ? "translate-x-0 opacity-100" : "translate-x-[calc(100%+32px)] opacity-0 pointer-events-none"}`}>
            <button onClick={() => setWatermarkOpen(false)} className="absolute -left-3 top-6 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="p-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 text-white">
                  <WandSparkles className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold">Watermark PDF</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Choose where and how the watermark appears</p>
                </div>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-bold"><Type className="h-4 w-4 text-purple-500" />WATERMARK TEXT</label>
                  <input type="text" value={toolOptions.watermark_text} onChange={(e) => setToolOptions({ ...toolOptions, watermark_text: e.target.value })} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm font-semibold" />
                </div>
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-bold"><Target className="h-4 w-4 text-purple-500" />APPLY WATERMARK TO</label>
                  <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 p-1">
                    {[["all", "All"], ["even", "Even"], ["odd", "Odd"], ["custom", "Custom"]].map((option) => (
                      <button key={option[0]} onClick={() => setToolOptions({ ...toolOptions, watermark_pages: option[0] })} className={`rounded-lg py-2.5 text-xs font-bold ${toolOptions.watermark_pages === option[0] ? "bg-white dark:bg-slate-800 text-purple-600 shadow-sm" : "text-slate-500"}`}>{option[1]}</button>
                    ))}
                  </div>
                  {toolOptions.watermark_pages === "custom" && <input type="text" value={toolOptions.watermark_custom_pages} onChange={(e) => setToolOptions({ ...toolOptions, watermark_custom_pages: e.target.value })} placeholder="1-5, 7, 9" className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 px-4 py-2.5 text-sm" />}
                </div>
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-bold"><Layers className="h-4 w-4 text-purple-500" />WATERMARK SIZE</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[{ value: "small", label: "Small", icon: Type }, { value: "medium", label: "Medium", icon: Layers }, { value: "large", label: "Large", icon: Maximize2 }].map((option) => {
                      const Icon = option.icon; const active = toolOptions.watermark_size === option.value;
                      return (
                        <button key={option.value} onClick={() => setToolOptions({ ...toolOptions, watermark_size: option.value })} className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 ${active ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30" : "border-slate-200 dark:border-slate-700"}`}>
                          <Icon className="h-5 w-5" /><span className="text-xs font-bold">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* SPLIT PDF SIDEBAR */}
      {isSplit && selectedFiles.length > 0 && !processedBlob && (
        <>
          <button type="button" onClick={() => setSplitOpen(true)} className={`fixed right-0 top-1/2 z-[360] -translate-y-1/2 flex h-12 w-9 items-center justify-center rounded-l-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${splitOpen ? "pointer-events-none translate-x-full opacity-0" : "translate-x-0 opacity-100"}`}>
            <ChevronRight className="h-5 w-5" />
          </button>
          <aside className={`fixed right-4 top-1/2 z-[350] w-[380px] max-w-[calc(100vw-32px)] -translate-y-1/2 rounded-2xl border border-amber-100 dark:border-amber-900/50 bg-white dark:bg-slate-800 shadow-2xl transition-all duration-500 ${splitOpen ? "translate-x-0 opacity-100" : "translate-x-[calc(100%+32px)] opacity-0 pointer-events-none"}`}>
            <button type="button" onClick={() => setSplitOpen(false)} className="absolute -left-3 top-6 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="p-5">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white">
                  <Scissors className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold">Split PDF</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Keep or remove selected pages</p>
                </div>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-bold"><Filter className="h-4 w-4 text-amber-500" />ACTION</label>
                  <div className="relative grid grid-cols-2 rounded-xl bg-slate-100 dark:bg-slate-700 p-1">
                    <div className={`absolute inset-y-1 w-[calc(50%-4px)] rounded-lg bg-white dark:bg-slate-800 shadow transition-transform duration-300 ${toolOptions.split_mode === "remove" ? "translate-x-[calc(100%+4px)]" : "translate-x-0"}`} />
                    <button type="button" onClick={() => setToolOptions({ ...toolOptions, split_mode: "keep" })} className={`relative z-10 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold ${toolOptions.split_mode === "keep" ? "text-amber-600" : "text-slate-500"}`}><CheckCircle2 className="h-4 w-4" />Keep</button>
                    <button type="button" onClick={() => setToolOptions({ ...toolOptions, split_mode: "remove" })} className={`relative z-10 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold ${toolOptions.split_mode === "remove" ? "text-red-600" : "text-slate-500"}`}><Trash2 className="h-4 w-4" />Remove</button>
                  </div>
                </div>
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-bold"><List className="h-4 w-4 text-amber-500" />PAGE SELECTION</label>
                  <div className="relative grid grid-cols-4 rounded-xl bg-slate-100 dark:bg-slate-700 p-1">
                    <div className={`absolute inset-y-1 w-[calc(25%-4px)] rounded-lg bg-white dark:bg-slate-800 shadow transition-transform duration-300 ${toolOptions.split_parity === "even" ? "translate-x-[calc(100%+4px)]" : toolOptions.split_parity === "odd" ? "translate-x-[calc(200%+8px)]" : toolOptions.split_parity === "custom" ? "translate-x-[calc(300%+12px)]" : "translate-x-0"}`} />
                    {[{ value: "all", label: "All", icon: Files }, { value: "even", label: "Even", icon: Rows3 }, { value: "odd", label: "Odd", icon: MoveVertical }, { value: "custom", label: "Custom", icon: List }].map((option) => {
                      const Icon = option.icon;
                      return (
                        <button key={option.value} type="button" onClick={() => setToolOptions({ ...toolOptions, split_parity: option.value })} className={`relative z-10 flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-[10px] font-bold ${toolOptions.split_parity === option.value ? "text-amber-600" : "text-slate-500"}`}>
                          <Icon className="h-4 w-4" />{option.label}
                        </button>
                      );
                    })}
                  </div>
                  {toolOptions.split_parity === "custom" && <input type="text" value={toolOptions.split_pages} onChange={(e) => setToolOptions({ ...toolOptions, split_pages: e.target.value })} placeholder="e.g. 1-5, 7, 9" className="mt-3 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm font-semibold" />}
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* ✅ N-UP PDF ADVANCED SIDEBAR */}
      {isNup && selectedFiles.length > 0 && !processedBlob && (
        <>
          <button type="button" onClick={() => setNupOpen(true)} className={`fixed right-0 top-1/2 z-[360] -translate-y-1/2 flex h-12 w-9 items-center justify-center rounded-l-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 shadow-lg transition-all duration-300 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 ${nupOpen ? "pointer-events-none translate-x-full opacity-0" : "translate-x-0 opacity-100"}`}>
            <ChevronRight className="h-5 w-5" />
          </button>
          <aside className={`fixed right-4 top-1/2 z-[350] w-[400px] max-w-[calc(100vw-32px)] -translate-y-1/2 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 bg-white dark:bg-slate-800 shadow-2xl shadow-slate-900/15 transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${nupOpen ? "translate-x-0 opacity-100" : "translate-x-[calc(100%+32px)] opacity-0 pointer-events-none"}`}>
            <button type="button" onClick={() => setNupOpen(false)} className="absolute -left-3 top-6 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 shadow-md transition-all duration-200 hover:scale-105 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="p-5 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar">
              {/* HEADER */}
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25">
                  <Grid3x3 className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">N-up PDF</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Combine multiple pages into one sheet</p>
                </div>
              </div>

              {/* SOURCE TYPE TOGGLE */}
              <div className="mb-5">
                <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                  <Files className="h-4 w-4 text-indigo-500" />SOURCE TYPE
                </label>
                <div className="relative grid grid-cols-2 rounded-xl bg-slate-100 dark:bg-slate-700 p-1">
                  <div className={`absolute inset-y-1 w-[calc(50%-4px)] rounded-lg bg-white dark:bg-slate-800 shadow transition-transform duration-300 ${nupMode === "images" ? "translate-x-[calc(100%+4px)]" : "translate-x-0"}`} />
                  <button type="button" onClick={() => changeNupMode("pdf")} className={`relative z-10 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold ${nupMode === "pdf" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500"}`}>
                    <FileText className="h-4 w-4" />PDF Pages
                  </button>
                  <button type="button" onClick={() => changeNupMode("images")} className={`relative z-10 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold ${nupMode === "images" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500"}`}>
                    <ImagePlus className="h-4 w-4" />Images
                  </button>
                </div>
              </div>

              {/* PAGES PER SHEET - VISUAL GRID SELECTOR */}
              <div className="mb-5">
                <label className="mb-2 flex items-center justify-between text-sm font-bold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-2"><Grid3x3 className="h-4 w-4 text-indigo-500" />PAGES PER SHEET</span>
                  <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/30 px-2.5 py-0.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">{toolOptions.nup_pages} pages</span>
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
                    const active = toolOptions.nup_pages === n;
                    const [cols, rows] = n === 2 ? [2, 1] : n === 3 ? [3, 1] : n === 4 ? [2, 2] : n === 6 ? [3, 2] : n === 9 ? [3, 3] : [3, 2];
                    return (
                      <button key={n} type="button" onClick={() => setToolOptions({ ...toolOptions, nup_pages: n })} className={`relative flex flex-col items-center justify-center rounded-xl border-2 p-2.5 transition-all ${active ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 shadow-sm" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-600"}`}>
                        <div className="grid gap-[1.5px] w-8 h-6 mb-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
                          {Array.from({ length: n }).map((_, i) => (
                            <div key={i} className={`rounded-[1px] ${active ? "bg-indigo-500" : "bg-slate-300 dark:bg-slate-600"}`} />
                          ))}
                        </div>
                        <span className={`text-[10px] font-bold ${active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400"}`}>{n}×</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* LAYOUT */}
              <div className="mb-5">
                <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                  <Layout className="h-4 w-4 text-indigo-500" />LAYOUT
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "grid", label: "Grid", icon: Grid3x3 },
                    { value: "horizontal", label: "Horizontal", icon: RectangleHorizontal },
                    { value: "vertical", label: "Vertical", icon: RectangleVertical },
                  ].map((option) => {
                    const Icon = option.icon; const active = toolOptions.nup_layout === option.value;
                    return (
                      <button key={option.value} type="button" onClick={() => setToolOptions({ ...toolOptions, nup_layout: option.value })} className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all ${active ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"}`}>
                        <Icon className={`h-5 w-5 ${active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`} />
                        <span className={`text-[10px] font-bold ${active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400"}`}>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PAGE SIZE */}
              <div className="mb-5">
                <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                  <Square className="h-4 w-4 text-indigo-500" />PAGE SIZE
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["a4", "letter", "a3"].map((size) => {
                    const active = toolOptions.nup_page_size === size;
                    return (
                      <button key={size} type="button" onClick={() => setToolOptions({ ...toolOptions, nup_page_size: size })} className={`rounded-xl border-2 py-2.5 text-xs font-bold uppercase transition-all ${active ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ORIENTATION */}
              <div className="mb-5">
                <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                  <Maximize2 className="h-4 w-4 text-indigo-500" />ORIENTATION
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "portrait", label: "Portrait", icon: RectangleVertical },
                    { value: "landscape", label: "Landscape", icon: RectangleHorizontal },
                  ].map((option) => {
                    const Icon = option.icon; const active = toolOptions.nup_orientation === option.value;
                    return (
                      <button key={option.value} type="button" onClick={() => setToolOptions({ ...toolOptions, nup_orientation: option.value })} className={`flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-xs font-bold transition-all ${active ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>
                        <Icon className="h-4 w-4" />{option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SPACING */}
              <div className="mb-5">
                <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                  <Layers className="h-4 w-4 text-indigo-500" />SPACING
                </label>
                <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 p-1">
                  {["none", "small", "medium", "large"].map((opt) => (
                    <button key={opt} type="button" onClick={() => setToolOptions({ ...toolOptions, nup_spacing: opt })} className={`rounded-lg py-2 text-[10px] font-bold capitalize ${toolOptions.nup_spacing === opt ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500"}`}>{opt}</button>
                  ))}
                </div>
              </div>

              {/* BORDER TOGGLE */}
              <div className="mb-5">
                <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                  <Square className="h-4 w-4 text-indigo-500" />BORDER
                </label>
                <div className="relative grid grid-cols-2 rounded-xl bg-slate-100 dark:bg-slate-700 p-1">
                  <div className={`absolute inset-y-1 w-[calc(50%-4px)] rounded-lg bg-white dark:bg-slate-800 shadow transition-transform duration-300 ${!toolOptions.nup_border ? "translate-x-[calc(100%+4px)]" : "translate-x-0"}`} />
                  <button type="button" onClick={() => setToolOptions({ ...toolOptions, nup_border: true })} className={`relative z-10 py-2.5 text-xs font-bold ${toolOptions.nup_border ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500"}`}>On</button>
                  <button type="button" onClick={() => setToolOptions({ ...toolOptions, nup_border: false })} className={`relative z-10 py-2.5 text-xs font-bold ${!toolOptions.nup_border ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500"}`}>Off</button>
                </div>
              </div>

              {/* LIVE PREVIEW */}
              <div className="mb-5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-900/10 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Eye className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">LIVE PREVIEW</span>
                </div>
                <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
                  <div className={`grid gap-1 bg-slate-100 dark:bg-slate-700 p-2 rounded-lg`} style={{ gridTemplateColumns: `repeat(${nupColsRows[0]}, 1fr)`, gridTemplateRows: `repeat(${nupColsRows[1]}, 1fr)`, width: toolOptions.nup_layout === "vertical" ? "60px" : "140px", height: toolOptions.nup_layout === "horizontal" ? "60px" : "100px" }}>
                    {Array.from({ length: toolOptions.nup_pages }).map((_, i) => (
                      <div key={i} className="rounded-sm bg-indigo-400 dark:bg-indigo-500" />
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-center text-[10px] text-slate-500 dark:text-slate-400">
                  {toolOptions.nup_pages} pages per sheet • {toolOptions.nup_layout} • {toolOptions.nup_page_size.toUpperCase()}
                </p>
              </div>

              {/* SUMMARY */}
              <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/70 dark:bg-indigo-900/20 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                    <Grid3x3 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400">N-up Configuration</p>
                    <p className="mt-1 text-[10px] leading-4 text-indigo-600 dark:text-indigo-500">
                      {selectedFiles.length} {nupMode === "pdf" ? "PDF pages" : "images"} → {toolOptions.nup_pages} per sheet
                    </p>
                    <p className="mt-0.5 text-[10px] text-indigo-500 dark:text-indigo-500/70">
                      {Math.ceil(selectedFiles.length / toolOptions.nup_pages)} output sheet{Math.ceil(selectedFiles.length / toolOptions.nup_pages) > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* MAIN */}
      <main className="mx-auto max-w-[1450px] px-5 py-8 md:px-8 lg:px-10 -mt-10">
        {!activeTool ? (
          <>
            <section>
              <div className="text-center md:text-left">
                <div className="flex items-center justify-center gap-2 md:justify-start">
                  <h2 className="text-3xl font-bold tracking-tight md:text-4xl text-slate-900 dark:text-slate-100">Combine & <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">Convert</span></h2>
                  <Sparkles className="h-5 w-5 text-purple-500" />
                </div>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 md:text-base">Powerful tools to merge, convert, compress and manage your documents in one place.</p>
              </div>
            </section>
            <div className="mt-6 flex justify-center">
              <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 shadow-sm">
                {categories.map((category) => (
                  <button key={category} onClick={() => setActiveCategory(category)} className={`shrink-0 rounded-xl px-4 py-2 text-xs font-medium ${activeCategory === category ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>{category}</button>
                ))}
              </div>
            </div>
            <section className="mt-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {filteredTools.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <div key={tool.name} onClick={() => setActiveTool(tool)} className="group relative min-h-[128px] cursor-pointer rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm transition-all hover:-translate-y-1 hover:border-blue-200 dark:hover:border-blue-700 hover:shadow-lg">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tool.iconBg}`}><Icon className={`h-5 w-5 ${tool.iconColor}`} /></div>
                      <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-slate-100">{tool.name}</h3>
                      <p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{tool.description}</p>
                      <div className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700"><ArrowRight className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" /></div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          <section className="mx-auto max-w-3xl">
            <div className="mb-6 flex items-center justify-between">
              <button onClick={handleBack} className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-semibold shadow-sm"><ChevronLeft className="h-4 w-4" />Back</button>
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${activeTool.iconBg}`}><activeTool.icon className={`h-5 w-5 ${activeTool.iconColor}`} /></div>
                <h2 className="text-lg font-bold">{activeTool.name}</h2>
              </div>
              <div className="w-20" />
            </div>

            {!processedBlob && (
              <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} className={`rounded-2xl border-2 border-dashed p-8 text-center ${dragging ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-indigo-200 dark:border-indigo-900 bg-white dark:bg-slate-800"}`}>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-400 to-purple-500 text-white"><Upload className="h-7 w-7" /></div>
                <h3 className="mt-3 text-base font-bold">Drag & drop your files here</h3>
                <p className="mt-1 text-xs text-slate-400">or</p>
                <label className="mx-auto mt-2 flex w-fit cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-xs font-semibold text-white">
                  <Upload className="h-4 w-4" />Choose Files
                  <input type="file" multiple={activeTool.multiple} accept={uploadAccept} className="hidden" onChange={(e) => void handleFiles(e.target.files)} />
                </label>
                <p className="mt-3 text-[10px] text-slate-400">Accepted: {uploadAccept}</p>
              </div>
            )}

            {isOrganize && selectedFiles.length > 0 && !processedBlob && (
              <div className="mt-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2"><Layout className="h-4 w-4 text-teal-500" /><h3 className="text-sm font-bold">Organize PDF Pages</h3></div>
                    <p className="mt-1 text-[10px] text-slate-400">{selectedFiles[0].name}</p>
                  </div>
                  <button onClick={() => removeFile(0)} className="text-xs font-semibold text-red-500">Change File</button>
                </div>
                {isLoadingPages ? (
                  <div className="flex flex-col items-center justify-center py-14"><Loader2 className="h-8 w-8 animate-spin text-teal-500" /><p className="mt-3 text-xs text-slate-500">Loading PDF pages...</p></div>
                ) : (
                  <>
                    <div className="mt-4 flex items-center justify-between rounded-xl border border-teal-100 dark:border-teal-900/50 bg-teal-50 dark:bg-teal-900/20 px-3 py-2">
                      <div className="flex items-center gap-2"><Files className="h-4 w-4 text-teal-600" /><span className="text-[10px] font-bold">{pageOrder.length} pages</span></div>
                      <span className="flex items-center gap-1 text-[9px] text-teal-600"><MoveVertical className="h-3.5 w-3.5" />Drag to reorder</span>
                    </div>
                    <div ref={organizeScrollRef} className="mt-4 max-h-[560px] overflow-y-auto pr-1">
                      <div className="space-y-2">
                        {pageOrder.map((pageNumber, index) => {
                          const thumbnail = pageThumbnails.find((item) => item.pageNumber === pageNumber);
                          const isDragging = draggedPageIndex === index;
                          const isDropTarget = dragOverIndex === index && draggedPageIndex !== index;
                          return (
                            <React.Fragment key={`${pageNumber}-${index}`}>
                              {isDropTarget && <div className="h-1.5 rounded-full bg-teal-400" />}
                              <div draggable onDragStart={(e) => handleOrganizeDragStart(e, index)} onDragOver={(e) => handleOrganizeDragOver(e, index)} onDrop={(e) => handleOrganizeDrop(e, index)} onDragEnd={handleOrganizeDragEnd} className={`group flex items-center gap-3 rounded-xl border-2 bg-white dark:bg-slate-800 p-3 transition-all ${isDragging ? "scale-[0.98] border-teal-400 bg-teal-50 dark:bg-teal-900/30 opacity-50" : "border-slate-200 dark:border-slate-700 hover:border-teal-300"}`}>
                                <div className="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-700"><GripVertical className="h-5 w-5 text-slate-400" /></div>
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-900/30 text-[11px] font-bold text-teal-600">{index + 1}</div>
                                <div className="flex h-[96px] w-[70px] shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-slate-50 dark:bg-slate-700">{thumbnail ? <img src={thumbnail.dataUrl} alt={`Page ${pageNumber}`} draggable={false} className="h-full w-full object-contain" /> : <FileText className="h-7 w-7 text-slate-300" />}</div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold">Page {pageNumber}</p>
                                  <p className="mt-1 text-[10px] text-slate-400">Original page {pageNumber}</p>
                                  <p className="mt-1 text-[10px] font-semibold text-teal-600">Position #{index + 1}</p>
                                </div>
                                <button type="button" onClick={() => removeOrganizePage(index)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-red-50 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                              </div>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-4 rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-xs font-semibold text-green-700 dark:text-green-400">
                      <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{validation.message}</div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button type="button" onClick={resetOrganizeOrder} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-3 text-xs font-semibold"><RotateCcw className="h-4 w-4" />Reset Order</button>
                      <button type="button" onClick={handleProcess} disabled={isProcessing || !validation.valid} className="flex items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-xs font-semibold text-white disabled:opacity-50">{isProcessing ? <><Loader2 className="h-4 w-4 animate-spin" />{processStep || "Processing..."}</> : <><Layout className="h-4 w-4" />Proceed</>}</button>
                    </div>
                    <div className="mt-2 flex justify-center">
                      <button type="button" onClick={undoOrganizeAction} disabled={organizeHistory.length === 0} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-semibold disabled:opacity-40"><Undo2 className="h-3 w-3" />Undo Last Change</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {selectedFiles.length > 0 && !processedBlob && !isOrganize && (
              <div className="mt-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">{selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""} selected</h3>
                  <button onClick={() => setSelectedFiles([])} className="text-xs font-semibold text-red-500">Clear All</button>
                </div>
                <div className="mt-4 space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 p-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white dark:bg-slate-800">{file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls") ? <FileSpreadsheet className="h-4 w-4 text-green-600" /> : <FileText className="h-4 w-4 text-blue-500" />}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">{file.name}</p>
                        <p className="text-[10px] text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button onClick={() => removeFile(index)}><X className="h-4 w-4 text-slate-400 hover:text-red-500" /></button>
                    </div>
                  ))}
                </div>
                {activeTool.name === "PDF Compress" && compressPreview && (
                  <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                    <div className="mb-3 flex items-center gap-2"><Settings className="h-4 w-4 text-slate-500" /><h4 className="text-xs font-bold">Compression Settings</h4></div>
                    <div className="grid grid-cols-3 gap-2">
                      {[{ value: "low", label: "High Compression" }, { value: "medium", label: "Balanced" }, { value: "high", label: "High Quality" }].map((option) => (
                        <button key={option.value} onClick={() => setToolOptions({ ...toolOptions, quality: option.value })} className={`rounded-lg border-2 p-3 text-left ${toolOptions.quality === option.value ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30" : "border-slate-200 dark:border-slate-700"}`}><p className="text-[10px] font-bold">{option.label}</p></button>
                      ))}
                    </div>
                  </div>
                )}
                {activeTool.name === "Rotate PDF" && (
                  <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                    <div className="mb-3 flex items-center gap-2"><RotateCw className="h-4 w-4 text-cyan-500" /><h4 className="text-xs font-bold">Rotation Angle</h4></div>
                    <div className="grid grid-cols-4 gap-2">
                      {[90, 180, 270, 360].map((angle) => (
                        <button key={angle} onClick={() => setToolOptions({ ...toolOptions, rotation: angle })} className={`rounded-lg border-2 p-3 ${toolOptions.rotation === angle ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-900/30" : "border-slate-200 dark:border-slate-700"}`}><RotateCw className="mx-auto mb-1 h-5 w-5" /><p className="text-xs font-bold">{angle}°</p></button>
                      ))}
                    </div>
                  </div>
                )}
                <div className={`mt-4 rounded-lg p-3 text-xs font-semibold ${validation.valid ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"}`}>
                  <div className="flex items-center gap-2">{validation.valid ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}{validation.message}</div>
                </div>
                <button onClick={handleProcess} disabled={isProcessing || !validation.valid || (isEnhance && activeEffects.length === 0)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                  {isProcessing ? <><Loader2 className="h-4 w-4 animate-spin" />{processStep || "Processing..."}</> : <>{isNup ? <Grid3x3 className="h-4 w-4" /> : isSplit ? <Scissors className="h-4 w-4" /> : isEnhance ? <Sparkles className="h-4 w-4" /> : <Zap className="h-4 w-4" />}{isNup ? "Process N-up PDF" : isSplit ? "Split PDF" : isEnhance ? "Process Enhanced PDF" : activeTool.name === "Excel to PDF" ? "Convert Excel to PDF" : `Process ${selectedFiles.length} File${selectedFiles.length > 1 ? "s" : ""}`}</>}
                </button>
              </div>
            )}

            {processedBlob && (
              <div className="mt-6 rounded-2xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50 text-green-600"><CheckCircle2 className="h-6 w-6" /></div>
                <h3 className="mt-3 text-lg font-bold text-green-800 dark:text-green-400">Processing Complete!</h3>
                <p className="mt-1 text-sm text-green-600 dark:text-green-500">{processedFilename}</p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  {downloadFormats.map((format) => {
                    const Meta = formatMeta[format]; const Icon = Meta.icon;
                    return (
                      <button key={format} onClick={() => downloadAs(format)} disabled={isExtracting} className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-2.5 text-sm font-semibold disabled:opacity-50">
                        {isExtracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}{Meta.label}
                      </button>
                    );
                  })}
                </div>
                <button onClick={handleProcessAnother} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white"><RefreshCw className="h-3.5 w-3.5" />Process another file</button>
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><History className="h-4 w-4 text-slate-500" /><h3 className="text-sm font-bold">Recent {activeTool.name} History</h3></div>
                <button onClick={refreshHistory} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-500"><RefreshCw className="h-3 w-3" />Refresh</button>
              </div>
              <div className="mt-4 space-y-2">
                {history.length === 0 ? (
                  <div className="py-6 text-center"><Clock className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-xs text-slate-500">No history yet.</p></div>
                ) : (
                  sortedHistory.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 p-3">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">{item.output_name}</p>
                        <p className="text-[10px] text-slate-500">{formatBytes(item.output_size)}</p>
                      </div>
                      <button onClick={() => downloadFromHistory(item)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-[10px] font-semibold text-white"><Download className="inline h-3 w-3" /> Download</button>
                      <button onClick={(e) => openMenu(e, item)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400"><MoreVertical className="h-4 w-4" /></button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      {activeMenuId && menuPosition && currentMenuItem && (
        <div ref={menuRef} style={{ position: "fixed", top: menuPosition.top, right: menuPosition.right }} className="z-[200] w-48 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 shadow-2xl">
          <button onClick={() => openShareModal(currentMenuItem)} className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/30"><Share2 className="h-3.5 w-3.5" />Share</button>
          <button onClick={() => togglePin(currentMenuItem.id)} className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-amber-50 dark:hover:bg-amber-900/30"><Pin className="h-3.5 w-3.5" />Pin to Top</button>
          <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
          <button onClick={() => deleteHistoryItem(currentMenuItem)} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"><Trash2 className="h-3.5 w-3.5" />Delete</button>
        </div>
      )}

      {showShareModal && shareItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowShareModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Share2 className="h-5 w-5 text-blue-600" /><h3 className="text-base font-bold">Share File</h3></div>
              <button onClick={() => setShowShareModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="mt-5 rounded-xl bg-slate-50 dark:bg-slate-700 p-3">
              <p className="truncate text-sm font-bold">{shareItem.output_name}</p>
              <p className="mt-1 text-[10px] text-slate-500">{formatBytes(shareItem.output_size)}</p>
            </div>
            <div className="mt-4 flex gap-2">
              <input readOnly value={getShareUrl(shareItem)} className="flex-1 truncate rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 px-3 py-2 text-xs" />
              <button onClick={() => copyShareLink(shareItem)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">{copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button>
            </div>
            <div className="mt-5 grid grid-cols-4 gap-2">
              <button onClick={() => shareToWhatsApp(shareItem)} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3"><WhatsAppIcon className="mx-auto h-5 w-5 text-green-500" /><span className="mt-1 block text-[9px]">WhatsApp</span></button>
              <button onClick={() => shareToTwitter(shareItem)} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3"><TwitterIcon className="mx-auto h-5 w-5" /><span className="mt-1 block text-[9px]">Twitter</span></button>
              <button onClick={() => copyShareLink(shareItem)} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3"><Link2 className="mx-auto h-5 w-5 text-blue-500" /><span className="mt-1 block text-[9px]">Copy</span></button>
              <button onClick={() => downloadFromHistory(shareItem)} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3"><Download className="mx-auto h-5 w-5 text-purple-500" /><span className="mt-1 block text-[9px]">Download</span></button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn { 0% { opacity: 0; transform: translateX(35px) scale(0.97); } 60% { opacity: 1; transform: translateX(-4px) scale(1); } 100% { opacity: 1; transform: translateX(0) scale(1); } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(-20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .enhance-range { height: 6px; appearance: none; -webkit-appearance: none; border-radius: 9999px; background: linear-gradient(90deg, #f9a8d4 0%, #db2777 100%); }
        .enhance-range::-webkit-slider-runnable-track { height: 6px; border-radius: 9999px; background: transparent; }
        .enhance-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 17px; height: 17px; margin-top: -5.5px; border-radius: 9999px; background: #db2777; border: 2px solid white; box-shadow: 0 1px 5px rgba(0,0,0,.2); }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.5); border-radius: 20px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(75, 85, 99, 0.5); }
      `}</style>
    </div>
  );
}