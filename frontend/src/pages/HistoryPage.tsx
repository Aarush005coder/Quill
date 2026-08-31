import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import {
  Download,
  Trash2,
  Languages,
  Wrench,
  File as FileIcon,
  Link as LinkIcon,
  Calendar,
  Clock,
  Eye,
  FileText,
  Calculator,
  DollarSign,
  Ruler,
  Database,
  Image as ImageIcon,
  Mic,
  Type,
  AlertTriangle,
  BarChart3,
  Filter,
  X,
  RefreshCw,
  CheckCircle2,
  FileSpreadsheet,
  FileDown,
  Zap,
  RotateCw,
  Layout,
  WandSparkles,
  Palette,
  Grid3x3,
  FileOutput,
  Search,
} from "lucide-react";
import jsPDF from "jspdf";

/* =========================================================
TYPES
========================================================= */

type HistoryCategory =
  | "translate"
  | "tools"
  | "documents"
  | "combine";

type HistoryTab =
  | "all"
  | "translate"
  | "tools"
  | "documents"
  | "combine";

interface HistoryMetadata {
  sourceLang?: string;
  targetLang?: string;
  toolType?: string;
  conversionType?: string;
  fromUnit?: string;
  toUnit?: string;
  pages?: number;
  files?: number;
  size?: string | number;
  output?: string;
  output_size?: number;
  method?: string;
  characters?: number;
  rows?: number;
  columns?: number;
  fileName?: string;
  originalName?: string;
  operation?: string;
  [key: string]: unknown;
}

interface HistoryItem {
  id: string;
  userId?: string;
  category?: HistoryCategory;
  operation_type?: string;
  type?: string;
  activity?: string;
  details?: string;
  output_name?: string;
  output_size?: number;
  output_file_url?: string | null;
  metadata?: HistoryMetadata;
  timestamp?: string;
  created_at?: string;
  createdAt: Date;
  source?: "local" | "api" | "sample";
}

interface Stats {
  all: number;
  translate: number;
  tools: number;
  documents: number;
  combine: number;
}

interface DeleteState {
  show: boolean;
  id: string | null;
}

/* =========================================================
CATEGORY ICONS & COLORS
========================================================= */

const categoryIcons: Record<HistoryCategory, React.ElementType> = {
  translate: Languages,
  tools: Wrench,
  documents: FileIcon,
  combine: LinkIcon,
};

const categoryColors: Record<HistoryCategory, string> = {
  translate: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  tools: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  documents: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  combine: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
};

const categoryBorderColors: Record<HistoryCategory, string> = {
  translate: "border-green-200 dark:border-green-800/60",
  tools: "border-purple-200 dark:border-purple-800/60",
  documents: "border-orange-200 dark:border-orange-800/60",
  combine: "border-pink-200 dark:border-pink-800/60",
};

const toolIcons: Record<string, React.ElementType> = {
  "Text to Text": Type,
  "Text to Speech": Mic,
  "Speech to Text": Mic,
  "Speech to Speech": Mic,
  "Number Converter": Calculator,
  "Currency Converter": DollarSign,
  "Unit Converter": Ruler,
  "Data Converter": Database,
  "Image Converter": ImageIcon,
  "PDF Merge": LinkIcon,
  "PDF Split": LinkIcon,
  "Image Merge": ImageIcon,
  "Image to PDF": ImageIcon,
  "Word Merge": FileText,
  "PDF to Word": FileOutput,
  "Word to PDF": FileText,
  "PDF Compress": Zap,
  "Rotate PDF": RotateCw,
  "Organize PDF": Layout,
  "Watermark PDF": WandSparkles,
  "PDF Color Enhance": Palette,
  "N-up PDF": Grid3x3,
  "PDF to Excel": FileSpreadsheet,
  "Excel to PDF": FileSpreadsheet,
};

const statColors: Record<keyof Stats, string> = {
  all: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
  translate: "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400",
  tools: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
  documents: "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400",
  combine: "bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400",
};

/* =========================================================
HELPERS
========================================================= */

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const safeJsonParse = <T,>(value: string | null): T | null => {
  if (!value) return null;
  try { return JSON.parse(value) as T; } catch { return null; }
};

const normalizeDate = (item: Partial<HistoryItem>): Date => {
  if (item.createdAt instanceof Date) return item.createdAt;
  const value = item.createdAt || item.created_at || item.timestamp;
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const normalizeActivityName = (value: string): string => {
  if (!value) return "Activity";
  let normalized = value.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ").toLowerCase();
  normalized = normalized.replace(/\btext\s+text\b/g, "text").replace(/\bspeech\s+speech\b/g, "speech").trim();
  const compactKey = normalized.replace(/\s+/g, "");
  
  const activityMap: Record<string, string> = {
    texttext: "Text to Text", texttotext: "Text to Text", texttospeech: "Text to Speech",
    speechtotext: "Speech to Text", speechtext: "Speech to Text", speechtospeech: "Speech to Speech",
    translation: "Translation", documenttranslation: "Document Translation",
    numberconverter: "Number Converter", currencyconverter: "Currency Converter",
    unitconverter: "Unit Converter", dataconverter: "Data Converter", imageconverter: "Image Converter",
    pdfmerge: "PDF Merge", pdfsplit: "PDF Split", splitpdf: "PDF Split", imagemerge: "Image Merge",
    imagetopdf: "Image to PDF", wordmerge: "Word Merge", pdftoword: "PDF to Word", wordtopdf: "Word to PDF",
    compresspdf: "PDF Compress", pdfcompress: "PDF Compress", rotatepdf: "Rotate PDF",
    organizepdf: "Organize PDF", watermarkpdf: "Watermark PDF", pdfcolorenhance: "PDF Color Enhance",
    nuppdf: "N-up PDF", pdftoexcel: "PDF to Excel", exceltopdf: "Excel to PDF",
  };

  if (activityMap[compactKey]) return activityMap[compactKey];
  
  if (normalized.includes("pdf merge")) return "PDF Merge";
  if (normalized.includes("pdf split") || normalized.includes("split pdf")) return "PDF Split";
  if (normalized.includes("compress pdf") || normalized.includes("pdf compress")) return "PDF Compress";
  if (normalized.includes("color enhance")) return "PDF Color Enhance";
  if (normalized.includes("watermark pdf")) return "Watermark PDF";
  if (normalized.includes("rotate pdf")) return "Rotate PDF";
  if (normalized.includes("organize pdf")) return "Organize PDF";
  if (normalized.includes("pdf to word")) return "PDF to Word";
  if (normalized.includes("word to pdf")) return "Word to PDF";
  if (normalized.includes("pdf to excel")) return "PDF to Excel";
  if (normalized.includes("excel to pdf")) return "Excel to PDF";
  if (normalized.includes("image to pdf")) return "Image to PDF";
  if (normalized.includes("image converter")) return "Image Converter";

  return normalized.split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
};

const getDisplayData = (item: HistoryItem) => {
  const rawOperation = item.operation_type || item.type || "";
  const sourceActivity = item.activity || rawOperation || "Activity";
  return {
    activity: normalizeActivityName(sourceActivity),
    details: item.details || item.output_name || "Operation completed successfully",
  };
};

const getToolIcon = (item: HistoryItem): React.ElementType | null => {
  const { activity } = getDisplayData(item);
  if (toolIcons[activity]) return toolIcons[activity];
  return toolIcons[normalizeActivityName(activity)] || null;
};

const determineCategory = (item: Partial<HistoryItem>): HistoryCategory => {
  if (item.category) return item.category;
  const opType = (item.operation_type || item.type || "").toLowerCase();
  const activity = (item.activity || "").toLowerCase();
  const details = (item.details || "").toLowerCase();
  const combined = `${opType} ${activity} ${details}`;

  if (combined.includes("translate") || combined.includes("translation") || combined.includes("language") || combined.includes("text_to_text") || combined.includes("text to text") || combined.includes("text_to_speech") || combined.includes("speech_to_text") || combined.includes("speech_to_speech")) {
    return "translate";
  }
  if (opType.includes("merge") || opType.includes("split") || opType.includes("nup") || opType.includes("combine") || opType.includes("compress") || opType.includes("rotate") || opType.includes("organize") || opType.includes("watermark") || opType.includes("enhance") || opType.includes("pdf_to_word") || opType.includes("word_to_pdf") || opType.includes("image_to_pdf") || opType.includes("pdf_to_excel") || opType.includes("excel_to_pdf") || opType.includes("image_convert")) {
    return "combine";
  }
  if (opType.includes("document") || opType.includes("upload") || combined.includes("document")) {
    return "documents";
  }
  return "tools";
};

const getCurrentUserId = (): string => {
  try {
    const token = localStorage.getItem("access_token");
    if (token) {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
        return String(payload.user_id || payload.userId || payload.sub || "guest");
      }
    }
  } catch { /* ignore */ }
  return "guest";
};

const getHistoryStorageKey = (): string => `history_${getCurrentUserId()}`;

const normalizeHistoryItem = (item: Partial<HistoryItem>, fallbackUserId: string, source: "local" | "api" | "sample" = "local"): HistoryItem | null => {
  if (!item || typeof item !== "object") return null;
  const generatedId = item.id || `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    id: String(generatedId),
    userId: item.userId || fallbackUserId,
    category: item.category,
    operation_type: item.operation_type,
    type: item.type,
    activity: item.activity,
    details: item.details,
    output_name: item.output_name,
    output_size: item.output_size,
    output_file_url: item.output_file_url,
    metadata: item.metadata,
    timestamp: item.timestamp,
    created_at: item.created_at,
    createdAt: normalizeDate(item),
    source,
  };
};

const loadHistoryFromStorage = (key: string): HistoryItem[] => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = safeJsonParse<Partial<HistoryItem>[]>(raw);
    if (!Array.isArray(parsed)) return [];
    const userId = getCurrentUserId();
    return parsed.map((item) => normalizeHistoryItem(item, userId, "local")).filter((item): item is HistoryItem => item !== null);
  } catch (error) {
    console.error("Error loading local history:", error);
    return [];
  }
};

const saveHistoryToStorage = (key: string, items: HistoryItem[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("quill-history-updated", { detail: { key, count: items.length } }));
  } catch (error) {
    console.error("Failed to save history:", error);
  }
};

/* =========================================================
COMPONENT
========================================================= */

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<HistoryTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteState, setDeleteState] = useState<DeleteState>({ show: false, id: null });
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<HistoryTab>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3000);
  };

  const userId = useMemo(() => getCurrentUserId(), []);
  const storageKey = useMemo(() => `history_${userId}`, [userId]);

  const loadHistory = useCallback(async () => {
    setIsRefreshing(true);
    const token = localStorage.getItem("access_token");

    if (!token) {
      const localHistory = loadHistoryFromStorage(storageKey);
      setHistory(localHistory);
      setIsRefreshing(false);
      setHistoryReady(true);
      return;
    }

    try {
      const API_BASE = `${(process.env.REACT_APP_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "")}/api`;

      // ✅ FIX: Removed extra '/api/' to prevent double '/api/api/'
      const response = await fetch(`${API_BASE}/history/?page=1&page_size=100`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (response.status === 401) {
        console.warn("Token expired or invalid. Falling back to local history.");
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        const localHistory = loadHistoryFromStorage(storageKey);
        setHistory(localHistory);
        setIsRefreshing(false);
        setHistoryReady(true);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        const apiItems = Array.isArray(data?.data) ? data.data : [];

        const mappedData: HistoryItem[] = apiItems
          .map((item: any) => {
            const metadata = item.metadata || {};
            return normalizeHistoryItem(
              {
                id: item.id,
                category: item.history_type as HistoryCategory,
                operation_type: metadata.operation || item.operation_type || item.source_model || "",
                activity: item.title,
                details: item.description,
                output_name: metadata.output || "",
                output_size: typeof metadata.output_size === "number" ? metadata.output_size : typeof metadata.size === "number" ? metadata.size : 0,
                output_file_url: item.output_file_url || null,
                metadata,
                created_at: item.created_at,
              },
              userId,
              "api"
            );
          })
          .filter((item: HistoryItem | null): item is HistoryItem => item !== null);

        setHistory(mappedData);
      } else {
        const localHistory = loadHistoryFromStorage(storageKey);
        setHistory(localHistory);
      }
    } catch (error) {
      console.error("Error fetching history from API:", error);
      const localHistory = loadHistoryFromStorage(storageKey);
      setHistory(localHistory);
    } finally {
      setIsRefreshing(false);
      setHistoryReady(true);
    }
  }, [storageKey, userId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const interval = window.setInterval(() => { void loadHistory(); }, 3000);
    return () => { window.clearInterval(interval); };
  }, [loadHistory]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      const latest = loadHistoryFromStorage(storageKey);
      setHistory(latest);
    };
    const handleCustomEvent = () => {
      const latest = loadHistoryFromStorage(storageKey);
      if (!localStorage.getItem("access_token")) setHistory(latest);
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("quill-history-updated", handleCustomEvent);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("quill-history-updated", handleCustomEvent);
    };
  }, [storageKey]);

  const stats: Stats = useMemo(() => ({
    all: history.length,
    translate: history.filter((item) => determineCategory(item) === "translate").length,
    tools: history.filter((item) => determineCategory(item) === "tools").length,
    documents: history.filter((item) => determineCategory(item) === "documents").length,
    combine: history.filter((item) => determineCategory(item) === "combine").length,
  }), [history]);

  const filteredHistory = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const result = history.filter((item) => {
      const category = determineCategory(item);
      if (activeTab !== "all" && category !== activeTab) return false;
      if (categoryFilter !== "all" && category !== categoryFilter) return false;
      if (!query) return true;

      const searchableText = [
        item.activity, item.details, item.output_name, item.operation_type, item.type,
        item.metadata?.toolType, item.metadata?.method, item.metadata?.sourceLang,
        item.metadata?.targetLang, item.metadata?.conversionType, item.metadata?.operation,
      ].filter(Boolean).join(" ").toLowerCase();

      return searchableText.includes(query);
    });
    return [...result].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [history, activeTab, categoryFilter, searchQuery]);

  const formatDate = (date: Date) => date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  const formatTime = (date: Date) => date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  const formatCategoryLabel = (category: string) => category.charAt(0).toUpperCase() + category.slice(1);

  const handleDelete = async (id: string) => {
    const token = localStorage.getItem("access_token");
    const API_BASE = `${(process.env.REACT_APP_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "")}/api`;

    try {
      if (token) {
        // ✅ FIX: Removed extra '/api/'
        const response = await fetch(`${API_BASE}/history/${id}/`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok && response.status !== 404) {
          throw new Error(`Delete failed: ${response.status}`);
        }
      }

      setHistory((previous) => {
        const next = previous.filter((item) => item.id !== id);
        saveHistoryToStorage(storageKey, next);
        return next;
      });

      if (selectedItem?.id === id) {
        setSelectedItem(null);
        setShowPreview(false);
      }
      showToast("success", "Item deleted successfully!");
    } catch (error) {
      console.error("Error deleting item:", error);
      showToast("error", "Failed to delete item.");
    }
  };

  const handleDeleteAll = () => {
    setDeleteState({ show: true, id: "all" });
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteState({ show: false, id: null });
  };

  const confirmDelete = async () => {
    const id = deleteState.id;
    if (!id) return;

    const token = localStorage.getItem("access_token");
    const API_BASE = `${(process.env.REACT_APP_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "")}/api`;

    try {
      if (id === "all") {
        if (token) {
          // ✅ FIX: Removed extra '/api/'
          const response = await fetch(`${API_BASE}/history/delete-all/`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok && response.status !== 404) {
            throw new Error("Failed to delete all history");
          }
        }
        setHistory([]);
        localStorage.removeItem(storageKey);
        window.dispatchEvent(new CustomEvent("quill-history-updated"));
        showToast("success", "All history deleted successfully!");
      }
    } catch (error) {
      console.error("Error deleting history:", error);
      showToast("error", "Failed to delete history.");
    }
    setShowDeleteModal(false);
    setDeleteState({ show: false, id: null });
    setSelectedItem(null);
    setShowPreview(false);
  };

  const openPreview = (item: HistoryItem) => {
    setSelectedItem(item);
    setShowPreview(true);
  };

  const downloadHistoryFile = async (item: HistoryItem) => {
    const token = localStorage.getItem("access_token");
    if (!item.output_file_url) {
      showToast("error", "Download file is not available.");
      return;
    }

    try {
      // ✅ FIX: Ensure relative paths are prefixed with the backend base URL
      const baseUrl = (process.env.REACT_APP_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
      const downloadUrl = item.output_file_url.startsWith("http")
        ? item.output_file_url
        : `${baseUrl}/${item.output_file_url}`;

      const response = await fetch(downloadUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = item.output_name || "download";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showToast("success", "Download started.");
    } catch (error) {
      console.error("Download error:", error);
      showToast("error", "Failed to download file.");
    }
  };

  const exportToPDF = () => {
    if (!filteredHistory.length) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("quill - Activity History", 14, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`User: ${userId}`, 14, 29);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 35);
    doc.setFontSize(12);
    doc.text(`Total Activities: ${filteredHistory.length}`, 14, 45);

    let y = 60;
    const drawHeaders = () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Category", 14, y);
      doc.text("Activity", 45, y);
      doc.text("Details", 95, y);
      doc.text("Date & Time", 150, y);
      y += 5;
      doc.setDrawColor(210, 210, 210);
      doc.line(14, y, pageWidth - 14, y);
      y += 7;
      doc.setFont("helvetica", "normal");
    };

    drawHeaders();
    filteredHistory.slice(0, 250).forEach((item) => {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
        drawHeaders();
      }
      const category = determineCategory(item);
      const { activity, details } = getDisplayData(item);
      doc.text(formatCategoryLabel(category).substring(0, 12), 14, y);
      doc.text(activity.substring(0, 25), 45, y);
      doc.text(details.substring(0, 30), 95, y);
      doc.text(`${formatDate(item.createdAt)} ${formatTime(item.createdAt)}`.substring(0, 24), 150, y);
      y += 8;
    });
    doc.save(`quill-history-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setActiveTab("all");
    setCategoryFilter("all");
  };

  const refresh = () => { void loadHistory(); };

  const tabs: { id: HistoryTab; label: string; count: number }[] = [
    { id: "all", label: "All Activity", count: stats.all },
    { id: "translate", label: "Translate", count: stats.translate },
    { id: "tools", label: "Tools", count: stats.tools },
    { id: "documents", label: "Documents", count: stats.documents },
    { id: "combine", label: "Combine", count: stats.combine },
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-white transition-colors duration-300">
      {toast && (
        <div className={`fixed top-4 right-4 z-[300] px-4 py-3 rounded-lg shadow-lg text-white font-medium animate-[slideIn_0.3s_ease-out] ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          {toast.message}
        </div>
      )}

      <div className="mx-auto w-full max-w-[1550px] p-4 md:p-6 lg:p-8">
        <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-3 -mt-10">
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">Your Complete Activity Timeline</h1>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 dark:border-gray-700 dark:bg-gray-900">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                {historyReady ? "History loaded" : "Loading history"}
              </span>
              <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 dark:border-gray-700 dark:bg-gray-900">User: {userId}</span>
              <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 dark:border-gray-700 dark:bg-gray-900">{history.length} activities</span>
            </div>
          </div>

          <div className="flex w-full max-w-xl items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search history..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              className={`flex h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-all ${showFilters || categoryFilter !== "all" ? "border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-400" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"}`}
            >
              <Filter className="h-4 w-4" /> Filters
            </button>
            <button
              type="button"
              onClick={refresh}
              disabled={isRefreshing}
              className="flex h-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-gray-600 transition-all hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Activity filters</p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Filter your history without losing previous activities.</p>
              </div>
              <button type="button" onClick={clearFilters} className="inline-flex w-fit items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition-all hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                <X className="h-3.5 w-3.5" /> Clear Filters
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(["all", "translate", "tools", "documents", "combine"] as HistoryTab[]).map((category) => {
                const active = categoryFilter === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setCategoryFilter(category)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all ${active ? "bg-blue-600 text-white shadow-sm" : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"}`}
                  >
                    {formatCategoryLabel(category)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {(Object.keys(stats) as Array<keyof Stats>).map((key) => {
            const Icon = key === "all" ? BarChart3 : categoryIcons[key as HistoryCategory];
            return (
              <button
                key={key}
                type="button"
                onClick={() => { setActiveTab(key); setCategoryFilter(key); }}
                className={`group rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:bg-gray-900 ${key !== "all" ? categoryBorderColors[key as HistoryCategory] : "border-blue-200 dark:border-blue-900/50"} border-gray-200 dark:border-gray-800`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{key === "all" ? "All Activity" : key}</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{stats[key]}</p>
                    <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                      {key === "all" ? "Total activities" : key === "translate" ? "Completed translations" : key === "tools" ? "Tool operations" : key === "documents" ? "Document activities" : "Combined operations"}
                    </p>
                  </div>
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${statColors[key]}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-4 pt-4 dark:border-gray-800 md:px-6">
            <div className="flex items-center gap-1 overflow-x-auto">
              {tabs.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex shrink-0 items-center gap-2 rounded-t-xl border-b-2 px-4 py-3 text-sm font-semibold transition-all ${active ? "border-blue-600 bg-blue-50/70 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"}`}
                  >
                    {tab.id === "all" ? <BarChart3 className="h-4 w-4" /> : React.createElement(categoryIcons[tab.id as HistoryCategory], { className: "h-4 w-4" })}
                    {tab.label}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-4 dark:border-gray-800 md:flex-row md:items-center md:justify-between md:px-6">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Activity timeline</p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Showing {filteredHistory.length} activities</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={exportToPDF} disabled={filteredHistory.length === 0} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">
                <FileDown className="h-4 w-4" /> Export PDF
              </button>
              <button type="button" onClick={handleDeleteAll} disabled={history.length === 0} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 transition-all hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:bg-gray-900 dark:text-red-400 dark:hover:bg-red-900/20">
                <Trash2 className="h-4 w-4" /> Delete All
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
              <table className="w-full min-w-[920px]">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm dark:bg-gray-950/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Activity</th>
                    <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 max-w-xs">Details</th>
                    <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Category</th>
                    <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 w-48">Date & Time</th>
                    <th className="px-6 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-900">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center">
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
                            <Calendar className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                          </div>
                          <h3 className="mt-4 text-sm font-bold text-gray-900 dark:text-white">No history found</h3>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Try changing your search or filters.</p>
                          {(searchQuery || activeTab !== "all" || categoryFilter !== "all") && (
                            <button type="button" onClick={clearFilters} className="mt-4 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                              Clear filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((item) => {
                      const category = determineCategory(item);
                      const CategoryIcon = categoryIcons[category];
                      const { activity, details } = getDisplayData(item);
                      const ToolIcon = getToolIcon(item);
                      const meta = item.metadata;

                      return (
                        <tr key={item.id} className="group transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${categoryColors[category]}`}>
                                {ToolIcon ? <ToolIcon className="h-5 w-5" /> : <CategoryIcon className="h-5 w-5" />}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{activity}</p>
                                <div className="mt-1 flex items-center gap-2">
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ${categoryColors[category]}`}>{formatCategoryLabel(category)}</span>
                                  {item.source === "api" && <span className="text-[9px] font-medium text-green-600 dark:text-green-400">Live</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 max-w-xs">
                            <div className="max-w-xs">
                              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{details}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-gray-500 dark:text-gray-400">
                                {meta?.sourceLang && meta?.targetLang && <span>{meta.sourceLang} → {meta.targetLang}</span>}
                                {meta?.method && <span>{meta.method}</span>}
                                {meta?.conversionType && <span>{meta.conversionType}</span>}
                                {typeof meta?.pages === "number" && <span>{meta.pages} pages</span>}
                                {typeof meta?.files === "number" && <span>{meta.files} files</span>}
                                {typeof meta?.characters === "number" && <span>{meta.characters} chars</span>}
                                {typeof meta?.rows === "number" && <span>{meta.rows} rows</span>}
                                {typeof item.output_size === "number" && item.output_size > 0 && <span>{formatBytes(item.output_size)}</span>}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${categoryColors[category]} ${categoryBorderColors[category]}`}>
                              <CategoryIcon className="h-3 w-3" /> {formatCategoryLabel(category)}
                            </span>
                          </td>
                          <td className="px-6 py-4 w-48">
                            <div>
                              <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                                <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" /> {formatDate(item.createdAt)}
                              </div>
                              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                <Clock className="h-3.5 w-3.5 shrink-0" /> {formatTime(item.createdAt)}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-1.5 opacity-80 transition-opacity group-hover:opacity-100">
                              <button type="button" onClick={() => openPreview(item)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400" title="View details">
                                <Eye className="h-4 w-4" />
                              </button>
                              {item.output_file_url && (
                                <button type="button" onClick={() => void downloadHistoryFile(item)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/20 dark:hover:text-green-400" title="Download">
                                  <Download className="h-4 w-4" />
                                </button>
                              )}
                              <button type="button" onClick={() => void handleDelete(item.id)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400" title="Delete">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showPreview && selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setShowPreview(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${categoryColors[determineCategory(selectedItem)]}`}>
                  {React.createElement(categoryIcons[determineCategory(selectedItem)], { className: "h-5 w-5" })}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Activity Details</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{getDisplayData(selectedItem).activity}</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowPreview(false)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6 space-y-3">
              <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Details</p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{getDisplayData(selectedItem).details}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Category</p>
                  <p className="mt-1 text-sm font-semibold capitalize text-gray-900 dark:text-white">{determineCategory(selectedItem)}</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Operation</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{normalizeActivityName(selectedItem.operation_type || selectedItem.type || "Unknown")}</p>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Date & Time</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-semibold text-gray-900 dark:text-white">
                  <span className="inline-flex items-center gap-2"><Calendar className="h-4 w-4 text-blue-500" /> {formatDate(selectedItem.createdAt)}</span>
                  <span className="inline-flex items-center gap-2"><Clock className="h-4 w-4 text-purple-500" /> {formatTime(selectedItem.createdAt)}</span>
                </div>
              </div>
              {selectedItem.metadata && Object.keys(selectedItem.metadata).length > 0 && (
                <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Metadata</p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {Object.entries(selectedItem.metadata).map(([key, value]: [string, unknown]) => (
                      <div key={key} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                        <p className="text-[9px] font-medium uppercase tracking-wide text-gray-400">{key.replace(/([A-Z])/g, " $1")}</p>
                        <p className="mt-0.5 break-words text-xs font-semibold text-gray-800 dark:text-gray-200">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {typeof selectedItem.output_size === "number" && selectedItem.output_size > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-900/20">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Output Size</span>
                  </div>
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-300">{formatBytes(selectedItem.output_size)}</span>
                </div>
              )}
            </div>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={() => setShowPreview(false)} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">Close</button>
              {selectedItem.output_file_url && (
                <button type="button" onClick={() => void downloadHistoryFile(selectedItem)} className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-green-700">
                  <Download className="h-3.5 w-3.5" /> Download
                </button>
              )}
              <button type="button" onClick={() => void handleDelete(selectedItem.id)} className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-center text-lg font-bold text-gray-900 dark:text-white">Delete All History?</h3>
            <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">All saved history for this user will be removed. This action cannot be undone.</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={closeDeleteModal} className="flex-1 rounded-xl border border-gray-200 bg-gray-100 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">Cancel</button>
              <button type="button" onClick={confirmDelete} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700">Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto mt-5 flex w-full max-w-[1550px] flex-col gap-2 px-4 pb-6 text-[10px] text-gray-400 dark:text-gray-500 md:flex-row md:items-center md:justify-between md:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          <span>History is synced with your account.</span>
        </div>
        <span>{filteredHistory.length} result{filteredHistory.length !== 1 ? "s" : ""}</span>
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.5); border-radius: 20px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(75, 85, 99, 0.5); }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(107, 114, 128, 0.8); }
      `}</style>
    </div>
  );
}