import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import toast from "react-hot-toast";

/* ============================================================
   TYPES
============================================================ */

interface Language {
  code: string;
  name: string;
  native: string;
}

interface TranslationHistory {
  id: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceText: string;
  translatedText: string;
  createdAt: string;
  audioUrl?: string;
}

type TranslateMode =
  | "text_to_text"
  | "text_to_speech"
  | "speech_to_text"
  | "speech_to_speech";

interface TranslationResult {
  translatedText: string;
  historyId?: string;
  audioUrl?: string;
}

/* ============================================================
   API
============================================================ */

const API_BASE = `${(process.env.REACT_APP_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "")}/api`;

const SPEECH_API_PATH =
  process.env.REACT_APP_SPEECH_API_PATH ||
  "/translation/speech-to-text/";

axios.defaults.baseURL = API_BASE;
axios.defaults.withCredentials = true;

/* ============================================================
   CONSTANTS
============================================================ */

const MAX_CHARACTERS = 5000;
const MIN_RECORDING_SIZE = 300;
const AUTO_TRANSLATE_DELAY = 1000; // 1 second debounce

const getHistoryLimit = (size: string) => {
  if (size === "small") return 10;
  if (size === "large") return 50;
  return 20; // medium
};

/* ============================================================
   LANGUAGES
============================================================ */

const LANGUAGES: Language[] = [
  { code: "auto", name: "Detect language", native: "Auto" },
  { code: "en", name: "English", native: "English" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "fr", name: "French", native: "Français" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "it", name: "Italian", native: "Italiano" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "ru", name: "Russian", native: "Русский" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "ko", name: "Korean", native: "한국어" },
  { code: "zh", name: "Chinese", native: "中文" },
  { code: "ar", name: "Arabic", native: "العربية" },
  { code: "tr", name: "Turkish", native: "Türkçe" },
  { code: "nl", name: "Dutch", native: "Nederlands" },
  { code: "pl", name: "Polish", native: "Polski" },
  { code: "sv", name: "Swedish", native: "Svenska" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
  { code: "uk", name: "Ukrainian", native: "Українська" },
  { code: "mr", name: "Marathi", native: "मराठी" },
  { code: "ta", name: "Tamil", native: "தமிழ்" },
  { code: "te", name: "Telugu", native: "తెలుగు" },
  { code: "ml", name: "Malayalam", native: "മലയാളം" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી" },
];

/* ============================================================
   HELPERS
============================================================ */

const getDefaultLanguages = () => {
  try {
    const settings = localStorage.getItem("quill_settings");
    if (settings) {
      const parsed = JSON.parse(settings);
      return {
        source: parsed.sourceLanguage || "auto",
        target: parsed.targetLanguage || "hi",
      };
    }
  } catch {
    // Ignore
  }
  return { source: "auto", target: "hi" };
};

const getLanguageName = (code: string): string => {
  return LANGUAGES.find((language) => language.code === code)?.name || code;
};

const createHistoryId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const buildMediaUrl = (url?: string | null): string | null => {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const backendOrigin = API_BASE.replace(/\/api\/?$/, "");
  return url.startsWith("/") ? `${backendOrigin}${url}` : `${backendOrigin}/${url}`;
};

const getAccessToken = (): string | null => {
  try {
    const token = localStorage.getItem("access_token");
    return token ? token.trim() : null;
  } catch {
    return null;
  }
};

const buildApiUrl = (path: string): string => {
  if (!path) return API_BASE;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}/${path.replace(/^\/+/, "")}`;
};

/* ============================================================
   SETTINGS HELPER
============================================================ */

const getSettingsFromStorage = () => {
  try {
    const settings = localStorage.getItem("quill_settings");
    if (settings) {
      return JSON.parse(settings);
    }
  } catch {
    // Ignore
  }
  return {
    autoSwap: true,
    autoTranslate: true,
    preserveFormatting: true,
    saveHistory: true,
    defaultEngine: "google",
    ttsVoice: "en-US-AriaNeural",
    autoDetectLanguage: true,
    showOriginalText: true,
    autoSave: true,
    cacheSize: "medium",
    exportFormat: "pdf",
  };
};

/* ============================================================
   MEDIA RECORDER
============================================================ */

const getSupportedMimeType = (): string => {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ];
  for (const candidate of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) return candidate;
    } catch {
      // Ignore
    }
  }
  return "";
};

const extensionFromMimeType = (mimeType: string): string => {
  const type = String(mimeType || "").toLowerCase();
  if (type.includes("ogg")) return "ogg";
  if (type.includes("mp4")) return "m4a";
  if (type.includes("wav")) return "wav";
  return "webm";
};

/* ============================================================
   API ERROR
============================================================ */

const getApiErrorMessage = (error: any, fallback: string): string => {
  const data = error?.response?.data;
  if (data?.message) return String(data.message);
  if (data?.detail) return String(data.detail);
  if (data?.errors) {
    try {
      return Object.values(data.errors).flat().join(" | ");
    } catch {
      // Ignore
    }
  }
  if (error?.message) return String(error.message);
  return fallback;
};

const getFetchErrorMessage = (payload: any, statusCode: number, fallback: string): string => {
  if (payload && typeof payload === "object") {
    if (payload.message) return String(payload.message);
    if (payload.detail) return String(payload.detail);
    if (payload.errors) {
      try {
        return Object.values(payload.errors).flat().join(" | ");
      } catch {
        // Ignore
      }
    }
  }
  if (statusCode === 401) return "Authentication expired. Please login again.";
  if (statusCode === 403) return "You are not allowed to use speech translation.";
  return fallback;
};

/* ============================================================
   FORMATTING HELPERS
============================================================ */

const applyFormattingPreservation = (text: string): { processedText: string; markers: Map<string, string> } => {
  const markers = new Map<string, string>();
  let counter = 0;
  
  let processed = text.replace(/\n/g, () => {
    const key = `__NL_${counter++}__`;
    markers.set(key, "\n");
    return key;
  });
  
  processed = processed.replace(/\*\*(.+?)\*\*/g, (match) => {
    const key = `__BOLD_${counter++}__`;
    markers.set(key, match);
    return key;
  });
  
  processed = processed.replace(/\*(.+?)\*/g, (match) => {
    const key = `__ITALIC_${counter++}__`;
    markers.set(key, match);
    return key;
  });
  
  processed = processed.replace(/`(.+?)`/g, (match) => {
    const key = `__CODE_${counter++}__`;
    markers.set(key, match);
    return key;
  });
  
  return { processedText: processed, markers };
};

const restoreFormatting = (text: string, markers: Map<string, string>): string => {
  let restored = text;
  markers.forEach((original, key) => {
    restored = restored.replace(new RegExp(key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), original);
  });
  return restored;
};

/* ============================================================
   ICONS
============================================================ */

const Icons = {
  language: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.4 2.5 3.7 5.5 3.7 9S14.4 18.5 12 21" />
      <path d="M12 3c-2.4 2.5-3.7 5.5-3.7 9S9.6 18.5 12 21" />
    </svg>
  ),
  swap: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3l4 4-4 4" />
      <path d="M3 7h18" />
      <path d="M7 21l-4-4 4-4" />
      <path d="M21 17H3" />
    </svg>
  ),
  mic: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0014 0" />
      <path d="M12 18v3" />
      <path d="M8 21h8" />
    </svg>
  ),
  copy: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  ),
  trash: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 14h10l1-14" />
      <path d="M9 7V4h6v3" />
    </svg>
  ),
  upload: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M5 20h14" />
    </svg>
  ),
  sparkle: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3z" />
      <path d="M19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15z" />
      <path d="M5 14l.6 1.9L7.5 17l-1.9.6L5 19.5l-.6-1.9L2.5 17l1.9-.6L5 14z" />
    </svg>
  ),
  arrow: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l4 4L19 6" />
    </svg>
  ),
  clock: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  file: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h6" />
    </svg>
  ),
  close: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  volume: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11" />
      <path d="M15.54 8.46a5 5 0 010 7.07" />
      <path d="M19.07 4.93a10 10 0 010 14.14" />
    </svg>
  ),
  stop: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  ),
  play: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  text: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7V4h16v3" />
      <path d="M9 20h6" />
      <path d="M12 4v16" />
    </svg>
  ),
  speech: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
      <path d="M19 10v2a7 7 0 01-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  chevron: (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 1.06l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
    </svg>
  ),
  download: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
};

/* ============================================================
   COMPONENT
============================================================ */

const TranslatePage: React.FC = () => {
  /* ==========================================================
     STATE
  ========================================================== */

  const [mode, setMode] = useState<TranslateMode>("text_to_text");
  
  const [sourceLanguage, setSourceLanguage] = useState(getDefaultLanguages().source);
  const [targetLanguage, setTargetLanguage] = useState(getDefaultLanguages().target);
  
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessingSpeech, setIsProcessingSpeech] = useState(false);
  
  // ✅ Settings state
  const [autoSwap, setAutoSwap] = useState(true);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [preserveFormatting, setPreserveFormatting] = useState(true);
  const [saveHistory, setSaveHistory] = useState(true);
  const [defaultEngine, setDefaultEngine] = useState("google");
  const [ttsVoice, setTtsVoice] = useState("en-US-AriaNeural");
  const [autoDetectLanguage, setAutoDetectLanguage] = useState(true);
  const [showOriginalText, setShowOriginalText] = useState(true);
  
  // ✅ NEW: Auto Save, Cache Size, Export Format
  const [autoSave, setAutoSave] = useState(true);
  const [cacheSize, setCacheSize] = useState("medium");
  const [exportFormat, setExportFormat] = useState("pdf");

  const [history, setHistory] = useState<TranslationHistory[]>(() => {
    try {
      const saved = localStorage.getItem("quill_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [translationCount, setTranslationCount] = useState<number>(() => {
    try {
      return Number(localStorage.getItem("quill_translation_count")) || 0;
    } catch {
      return 0;
    }
  });

  /* ==========================================================
     REFS
  ========================================================== */

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const isMountedRef = useRef(true);
  const processingSpeechRef = useRef(false);
  const stoppingRecorderRef = useRef(false);
  const autoTranslateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ==========================================================
     LOAD SETTINGS & LISTEN FOR CLEAR DATA
  ========================================================== */

  useEffect(() => {
    const settings = getSettingsFromStorage();
    setAutoSwap(settings.autoSwap ?? true);
    setAutoTranslate(settings.autoTranslate ?? true);
    setPreserveFormatting(settings.preserveFormatting ?? true);
    setSaveHistory(settings.saveHistory ?? true);
    setDefaultEngine(settings.defaultEngine ?? "google");
    setTtsVoice(settings.ttsVoice ?? "en-US-AriaNeural");
    setAutoDetectLanguage(settings.autoDetectLanguage ?? true);
    setShowOriginalText(settings.showOriginalText ?? true);
    setAutoSave(settings.autoSave ?? true);
    setCacheSize(settings.cacheSize ?? "medium");
    setExportFormat(settings.exportFormat ?? "pdf");

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "quill_settings") {
        const newSettings = JSON.parse(e.newValue || "{}");
        setAutoSwap(newSettings.autoSwap ?? true);
        setAutoTranslate(newSettings.autoTranslate ?? true);
        setPreserveFormatting(newSettings.preserveFormatting ?? true);
        setSaveHistory(newSettings.saveHistory ?? true);
        setDefaultEngine(newSettings.defaultEngine ?? "google");
        setTtsVoice(newSettings.ttsVoice ?? "en-US-AriaNeural");
        setAutoDetectLanguage(newSettings.autoDetectLanguage ?? true);
        setShowOriginalText(newSettings.showOriginalText ?? true);
        setAutoSave(newSettings.autoSave ?? true);
        setCacheSize(newSettings.cacheSize ?? "medium");
        setExportFormat(newSettings.exportFormat ?? "pdf");
        
        if (!sourceText.trim()) {
          setSourceLanguage(newSettings.sourceLanguage || "auto");
          setTargetLanguage(newSettings.targetLanguage || "hi");
        }
      }
    };

    // ✅ Listen for Clear App Data event from SettingsPage
    const handleClearData = () => {
      setHistory([]);
      setTranslationCount(0);
      setSourceText("");
      setTranslatedText("");
      setAudioUrl(null);
      localStorage.removeItem("quill_history");
      localStorage.removeItem("quill_translation_count");
      toast.success("Local translation data cleared.");
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("quill-history-cleared", handleClearData);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("quill-history-cleared", handleClearData);
    };
  }, [sourceText]);

  /* ==========================================================
     PERSISTENCE
  ========================================================== */

  useEffect(() => {
    if (saveHistory && autoSave) {
      try {
        localStorage.setItem("quill_history", JSON.stringify(history));
      } catch {
        // Ignore
      }
    }
  }, [history, saveHistory, autoSave]);

  useEffect(() => {
    try {
      localStorage.setItem("quill_translation_count", String(translationCount));
    } catch {
      // Ignore
    }
  }, [translationCount]);

  /* ==========================================================
     AUTO TRANSLATE EFFECT
  ========================================================== */

  useEffect(() => {
    if (!autoTranslate || !sourceText.trim() || mode !== "text_to_text") {
      return;
    }

    if (autoTranslateTimerRef.current) {
      clearTimeout(autoTranslateTimerRef.current);
    }

    autoTranslateTimerRef.current = setTimeout(() => {
      handleTranslate();
    }, AUTO_TRANSLATE_DELAY);

    return () => {
      if (autoTranslateTimerRef.current) {
        clearTimeout(autoTranslateTimerRef.current);
      }
    };
  }, [sourceText, autoTranslate, mode, sourceLanguage, targetLanguage]);

  /* ==========================================================
     AUDIO
  ========================================================== */

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.removeAttribute("src");
        audio.load();
      } catch {
        // Ignore
      }
    }
    audioRef.current = null;
    if (isMountedRef.current) setIsPlaying(false);
  }, []);

  const playAudio = useCallback(async (url?: string | null) => {
    const finalUrl = buildMediaUrl(url);
    if (!finalUrl) {
      toast.error("Audio is not available.");
      return;
    }

    try {
      stopAudio();
      const audio = new Audio(finalUrl);
      audio.preload = "auto";
      audioRef.current = audio;

      audio.onplay = () => {
        if (isMountedRef.current) setIsPlaying(true);
      };
      audio.onended = () => {
        if (isMountedRef.current) setIsPlaying(false);
      };
      audio.onerror = () => {
        if (isMountedRef.current) setIsPlaying(false);
        console.error("Audio playback error:", finalUrl);
        toast.error("Unable to play translated speech.");
      };

      await audio.play();
      if (isMountedRef.current) setIsPlaying(true);
    } catch (error) {
      console.error("Audio play error:", error);
      if (isMountedRef.current) setIsPlaying(false);
      toast.error("Unable to start audio.");
    }
  }, [stopAudio]);

  /* ==========================================================
     MEDIA STREAM CLEANUP
  ========================================================== */

  const releaseMediaStream = useCallback(() => {
    const stream = mediaStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore
        }
      });
    }
    mediaStreamRef.current = null;
  }, []);

  const resetRecorderRefs = useCallback(() => {
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
    stoppingRecorderRef.current = false;
    releaseMediaStream();
  }, [releaseMediaStream]);

  const stopRecordingInternal = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder) {
      try {
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
      } catch {
        // Ignore
      }
    }
    releaseMediaStream();
  }, [releaseMediaStream]);

  /* ==========================================================
     PROCESS RECORDED AUDIO
  ========================================================== */

  const processRecordedAudio = useCallback(async (
    blob: Blob,
    mimeType: string,
    sourceLangAtRecord: string,
    targetLangAtRecord: string,
    modeAtRecord: TranslateMode
  ) => {
    if (processingSpeechRef.current) return;
    if (!blob || blob.size < MIN_RECORDING_SIZE) {
      toast.error("The recording is too short or empty. Please speak for a little longer.");
      return;
    }

    const accessToken = getAccessToken();
    if (!accessToken) {
      toast.error("Authentication expired. Please login again.");
      return;
    }

    processingSpeechRef.current = true;
    if (isMountedRef.current) setIsProcessingSpeech(true);

    try {
      const finalMimeType = mimeType || blob.type || "audio/webm";
      const extension = extensionFromMimeType(finalMimeType);
      const file = new File([blob], `recording-${Date.now()}.${extension}`, { type: finalMimeType });

      if (file.size < MIN_RECORDING_SIZE) {
        throw new Error("The recorded audio is too small. Please speak for a little longer.");
      }

      const formData = new FormData();
      formData.append("audio", file, file.name);
      formData.append("source_lang", sourceLangAtRecord);
      formData.append("target_lang", targetLangAtRecord);
      formData.append("mode", modeAtRecord);
      formData.append("auto_detect", String(autoDetectLanguage && sourceLangAtRecord === "auto"));
      formData.append("localize_terms", "true");
      
      formData.append("engine", defaultEngine);
      formData.append("tts_voice", ttsVoice);
      formData.append("show_original_text", String(showOriginalText));

      const speechUrl = buildApiUrl(SPEECH_API_PATH);
      const response = await fetch(speechUrl, {
        method: "POST",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        body: formData,
      });

      const responseText = await response.text();
      let payload: any = null;
      try {
        payload = responseText ? JSON.parse(responseText) : null;
      } catch {
        payload = null;
      }

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        delete axios.defaults.headers.common["Authorization"];
        window.dispatchEvent(new Event("auth:logout"));
        throw new Error("Authentication credentials are invalid or expired. Please login again.");
      }

      if (!response.ok) {
        throw new Error(getFetchErrorMessage(payload, response.status, `Speech request failed with status ${response.status}.`));
      }

      const data = payload?.data || payload || {};
      const speechText = String(data?.source_text || "").trim();
      const translated = String(data?.translated_text || "").trim();
      const backendAudio = data?.audio_url ? String(data.audio_url) : undefined;

      if (!speechText) {
        throw new Error(payload?.message || "No speech was recognized.");
      }

      if (isMountedRef.current) {
        setSourceText(speechText.slice(0, MAX_CHARACTERS));
        if (modeAtRecord === "speech_to_text") {
          setTranslatedText("");
        } else {
          setTranslatedText(translated || speechText);
        }
        setAudioUrl(backendAudio || null);
      }

      const historyItem: TranslationHistory = {
        id: data?.history_id ? String(data.history_id) : createHistoryId(),
        sourceLanguage: sourceLangAtRecord,
        targetLanguage: targetLangAtRecord,
        sourceText: speechText,
        translatedText: translated || speechText,
        createdAt: new Date().toISOString(),
        audioUrl: backendAudio,
      };

      if (isMountedRef.current) {
        // ✅ Respect autoSave and cacheSize limits
        if (saveHistory && autoSave) {
          const limit = getHistoryLimit(cacheSize);
          setHistory((previous) => [historyItem, ...previous.filter((item) => item.id !== historyItem.id)].slice(0, limit));
        }
        setTranslationCount((previous) => previous + 1);
      }

      if (modeAtRecord === "speech_to_speech" && backendAudio) {
        window.setTimeout(() => {
          playAudio(backendAudio);
        }, 250);
      }

      toast.success("Speech processed successfully.");
    } catch (error: any) {
      console.error("Speech API error:", error);
      toast.error(error?.message || "Unable to process speech.");
    } finally {
      processingSpeechRef.current = false;
      if (isMountedRef.current) setIsProcessingSpeech(false);
    }
  }, [playAudio, saveHistory, autoSave, cacheSize, defaultEngine, ttsVoice, showOriginalText, autoDetectLanguage]);

  /* ==========================================================
     START LISTENING
  ========================================================== */

  const startListening = useCallback(async () => {
    if (isListening || isProcessingSpeech || processingSpeechRef.current) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error("Your browser does not support microphone recording.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      toast.error("Your browser does not support audio recording.");
      return;
    }

    const sourceLangAtRecord = sourceLanguage;
    const targetLangAtRecord = targetLanguage;
    const modeAtRecord = mode;

    try {
      stopRecordingInternal();
      const mimeType = getSupportedMimeType();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];
      stoppingRecorderRef.current = false;

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.onstart = () => {
        console.log("🎙️ MediaRecorder started:", { mimeType: recorder.mimeType, state: recorder.state });
        if (isMountedRef.current) setIsListening(true);
      };

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
          console.log("🎧 Audio chunk:", event.data.size);
        }
      };

      recorder.onerror = (event: any) => {
        console.error("🎙️ MediaRecorder error:", event);
        stoppingRecorderRef.current = true;
        releaseMediaStream();
        mediaRecorderRef.current = null;
        recordedChunksRef.current = [];
        if (isMountedRef.current) {
          setIsListening(false);
          setIsProcessingSpeech(false);
        }
        toast.error("Microphone recording failed.");
      };

      recorder.onstop = async () => {
        console.log("🎙️ MediaRecorder stopped");
        const chunks = [...recordedChunksRef.current];
        const actualMimeType = recorder.mimeType || mimeType || chunks.find((chunk) => Boolean(chunk.type))?.type || "audio/webm";
        const finalBlob = new Blob(chunks, { type: actualMimeType });

        console.log("🎧 Final recording:", { size: finalBlob.size, type: finalBlob.type, chunks: chunks.length });
        recordedChunksRef.current = [];
        mediaRecorderRef.current = null;
        releaseMediaStream();
        stoppingRecorderRef.current = false;
        if (isMountedRef.current) setIsListening(false);

        if (!finalBlob.size || finalBlob.size < MIN_RECORDING_SIZE) {
          toast.error("No usable audio was recorded. Please speak for a little longer.");
          return;
        }

        await processRecordedAudio(finalBlob, actualMimeType, sourceLangAtRecord, targetLangAtRecord, modeAtRecord);
      };

      recorder.start(250);
      if (isMountedRef.current) setIsListening(true);
      console.log("🎙️ Recording ready. Speak now.");
      toast.success("Microphone started. Speak now.");
    } catch (error: any) {
      console.error("Microphone start error:", error);
      resetRecorderRefs();
      if (isMountedRef.current) setIsListening(false);

      switch (error?.name) {
        case "NotAllowedError":
          toast.error("Microphone permission was denied. Allow microphone access and try again.");
          break;
        case "NotFoundError":
          toast.error("No microphone was found.");
          break;
        case "NotReadableError":
          toast.error("The microphone is already being used by another application.");
          break;
        case "SecurityError":
          toast.error("Microphone access is blocked by the browser.");
          break;
        case "OverconstrainedError":
          toast.error("The requested microphone settings are not supported by this device.");
          break;
        default:
          toast.error("Unable to access the microphone.");
      }
    }
  }, [isListening, isProcessingSpeech, mode, processRecordedAudio, releaseMediaStream, resetRecorderRefs, sourceLanguage, stopRecordingInternal, targetLanguage]);

  /* ==========================================================
     STOP LISTENING
  ========================================================== */

  const stopListening = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      if (isMountedRef.current) setIsListening(false);
      return;
    }
    if (stoppingRecorderRef.current) return;

    stoppingRecorderRef.current = true;
    console.log("🎙️ Stop requested");

    try {
      if (recorder.state === "recording") {
        recorder.stop();
      }
    } catch (error) {
      console.error("Recording stop error:", error);
      mediaRecorderRef.current = null;
      recordedChunksRef.current = [];
      releaseMediaStream();
      stoppingRecorderRef.current = false;
      if (isMountedRef.current) {
        setIsListening(false);
        setIsProcessingSpeech(false);
      }
    }
  }, [releaseMediaStream]);

  /* ==========================================================
     VOICE TOGGLE
  ========================================================== */

  const handleVoiceToggle = useCallback(() => {
    if (isListening) {
      stopListening();
      return;
    }
    startListening();
  }, [isListening, startListening, stopListening]);

  /* ==========================================================
     COMPONENT CLEANUP
  ========================================================== */

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stoppingRecorderRef.current = true;
      const recorder = mediaRecorderRef.current;
      if (recorder) {
        try {
          if (recorder.state !== "inactive") {
            recorder.ondataavailable = null;
            recorder.onstart = null;
            recorder.onerror = null;
            recorder.onstop = null;
            recorder.stop();
          }
        } catch {
          // Ignore
        }
      }
      mediaRecorderRef.current = null;
      recordedChunksRef.current = [];
      releaseMediaStream();
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.removeAttribute("src");
          audioRef.current.load();
        } catch {
          // Ignore
        }
        audioRef.current = null;
      }
      if (autoTranslateTimerRef.current) {
        clearTimeout(autoTranslateTimerRef.current);
      }
    };
  }, [releaseMediaStream]);

  /* ==========================================================
     MODE
  ========================================================== */

  const modeOptions: { value: TranslateMode; label: string }[] = [
    { value: "text_to_text", label: "Text → Text" },
    { value: "text_to_speech", label: "Text → Speech" },
    { value: "speech_to_text", label: "Speech → Text" },
    { value: "speech_to_speech", label: "Speech → Speech" },
  ];

  const isTextInput = mode === "text_to_text" || mode === "text_to_speech";
  const isSpeechInput = mode === "speech_to_text" || mode === "speech_to_speech";
  const isTextOutput = mode === "text_to_text" || mode === "speech_to_text";
  const isSpeechOutput = mode === "text_to_speech" || mode === "speech_to_speech";
  const characterCount = sourceText.length;
  const characterPercentage = Math.min((characterCount / MAX_CHARACTERS) * 100, 100);

  /* ==========================================================
     TRANSLATION API
  ========================================================== */

  const translateWithAPI = async (
    text: string,
    source: string,
    target: string,
    currentMode: TranslateMode
  ): Promise<TranslationResult> => {
    let textToSend = text;
    let markers = new Map<string, string>();

    if (preserveFormatting && currentMode === "text_to_text") {
      const preserved = applyFormattingPreservation(text);
      textToSend = preserved.processedText;
      markers = preserved.markers;
    }

    const payload = {
      source_text: textToSend.trim(),
      source_lang: source || "auto",
      target_lang: target || "en",
      mode: currentMode,
      engine: (defaultEngine || "google").toLowerCase(),
      auto_detect: autoDetectLanguage && source === "auto",
      localize_terms: true,
      tts_voice: ttsVoice || "",
      show_original_text: showOriginalText,
      translation_style: "balanced",
      formality_level: "neutral",
      translation_speed: "standard",
      preserve_formatting: preserveFormatting,
    };

    try {
      const response = await axios.post("/translation/translate/", payload);
      const data = response.data?.data || response.data;
      
      let translatedText = String(data?.translated_text || "").trim();

      if (preserveFormatting && currentMode === "text_to_text" && markers.size > 0) {
        translatedText = restoreFormatting(translatedText, markers);
      }

      if (!translatedText) {
        throw new Error(data?.message || "Translation failed.");
      }

      return {
        translatedText,
        historyId: data?.history_id ? String(data.history_id) : undefined,
        audioUrl: data?.audio_url ? String(data.audio_url) : undefined,
      };
    } catch (error: any) {
      console.error("❌ Backend Validation Errors:", error.response?.data);
      throw error;
    }
  };
  
  /* ==========================================================
     HANDLE TRANSLATE
  ========================================================== */

  const handleTranslate = async () => {
    if (!sourceText.trim()) {
      toast.error("Please enter text or record speech first.");
      return;
    }
    if (isTranslating || isProcessingSpeech) return;

    setIsTranslating(true);
    setCopied(false);
    stopAudio();

    try {
      const result = await translateWithAPI(sourceText, sourceLanguage, targetLanguage, mode);
      setTranslatedText(result.translatedText);
      setAudioUrl(result.audioUrl || null);

      const historyItem: TranslationHistory = {
        id: result.historyId || createHistoryId(),
        sourceLanguage: sourceLanguage,
        targetLanguage: targetLanguage,
        sourceText: sourceText.trim(),
        translatedText: result.translatedText,
        createdAt: new Date().toISOString(),
        audioUrl: result.audioUrl,
      };

      // ✅ Respect autoSave and cacheSize limits
      if (saveHistory && autoSave) {
        const limit = getHistoryLimit(cacheSize);
        setHistory((previous) => [historyItem, ...previous.filter((item) => item.id !== historyItem.id)].slice(0, limit));
      }
      setTranslationCount((previous) => previous + 1);

      if (autoSwap && mode === "text_to_text") {
        const oldSource = sourceLanguage;
        setSourceLanguage(targetLanguage);
        setTargetLanguage(oldSource);
        setSourceText(result.translatedText);
        setTranslatedText(sourceText.trim());
      }

      if (mode === "text_to_speech" && result.audioUrl) {
        window.setTimeout(() => {
          playAudio(result.audioUrl);
        }, 250);
      }

      if (mode === "text_to_speech" && !result.audioUrl) {
        toast.error("Translation completed, but speech audio was not generated.");
      }
    } catch (error) {
      console.error("Translation API error:", error);
      toast.error(getApiErrorMessage(error, "Translation failed. Please try again."));
    } finally {
      setIsTranslating(false);
    }
  };

  /* ==========================================================
     EXPORT FUNCTIONALITY
  ========================================================== */

  const handleExport = () => {
    if (!translatedText && history.length === 0) {
      toast.error("Nothing to export.");
      return;
    }

    let content = "";
    let filename = `translation_export_${Date.now()}`;
    let mimeType = "";

    const currentData = translatedText 
      ? { sourceText, translatedText, sourceLanguage, targetLanguage, date: new Date().toISOString() }
      : null;

    if (exportFormat === "txt") {
      if (currentData) {
        content = `Source (${getLanguageName(sourceLanguage)}):\n${sourceText}\n\nTranslation (${getLanguageName(targetLanguage)}):\n${translatedText}\n\nDate: ${new Date().toLocaleString()}`;
      } else {
        content = history.map(h => `[${new Date(h.createdAt).toLocaleString()}] ${getLanguageName(h.sourceLanguage)} -> ${getLanguageName(h.targetLanguage)}\nSource: ${h.sourceText}\nTranslation: ${h.translatedText}\n---`).join("\n");
      }
      mimeType = "text/plain";
      filename += ".txt";
    } else if (exportFormat === "html") {
      if (currentData) {
        content = `<html><body><h2>Translation</h2><p><strong>Source:</strong> ${sourceText}</p><p><strong>Translation:</strong> ${translatedText}</p></body></html>`;
      } else {
        content = `<html><body><h2>Translation History</h2>${history.map(h => `<p><strong>${h.sourceLanguage} -> ${h.targetLanguage}</strong><br>Source: ${h.sourceText}<br>Translation: ${h.translatedText}</p><hr>`).join("")}</body></html>`;
      }
      mimeType = "text/html";
      filename += ".html";
    } else if (exportFormat === "docx") {
      if (currentData) {
        content = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export</title></head><body><h3>Source:</h3><p>${sourceText}</p><h3>Translation:</h3><p>${translatedText}</p></body></html>`;
      } else {
        content = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>History</title></head><body>${history.map(h => `<p><b>${h.sourceLanguage} -> ${h.targetLanguage}</b><br>${h.sourceText}<br>${h.translatedText}</p><hr>`).join("")}</body></html>`;
      }
      mimeType = "application/msword";
      filename += ".doc";
    } else {
      // Fallback for PDF or others without heavy libraries like jsPDF
      content = JSON.stringify(currentData || history, null, 2);
      mimeType = "application/json";
      filename += ".json";
      if (exportFormat === "pdf") {
        toast("PDF export requires a dedicated library. Exporting as JSON for now.");
      }
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Exported successfully!");
  };

  /* ==========================================================
     SWAP
  ========================================================== */

  const handleSwap = () => {
    if (sourceLanguage === "auto") {
      toast.error("Select a source language before swapping.");
      return;
    }
    if (isListening) stopListening();

    const oldSource = sourceLanguage;
    const oldSourceText = sourceText;

    setSourceLanguage(targetLanguage);
    setTargetLanguage(oldSource);
    setSourceText(translatedText);
    setTranslatedText(oldSourceText);
    setAudioUrl(null);
    stopAudio();
  };

  /* ==========================================================
     COPY
  ========================================================== */

  const handleCopy = async () => {
    if (!translatedText) return;
    try {
      await navigator.clipboard.writeText(translatedText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Unable to copy text.");
    }
  };

  /* ==========================================================
     CLEAR
  ========================================================== */

  const handleClear = () => {
    stopAudio();
    if (isListening) stopListening();
    setSourceText("");
    setTranslatedText("");
    setAudioUrl(null);
    setCopied(false);
    if (autoTranslateTimerRef.current) {
      clearTimeout(autoTranslateTimerRef.current);
    }
  };

  /* ==========================================================
     FILE UPLOAD
  ========================================================== */

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedExtensions = [".txt", ".md", ".csv"];
    const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;

    if (!allowedExtensions.includes(extension)) {
      toast.error("Please upload a TXT, MD, or CSV file.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || "").slice(0, MAX_CHARACTERS);
      setSourceText(content);
      setTranslatedText("");
      setAudioUrl(null);
    };
    reader.onerror = () => toast.error("Unable to read the file.");
    reader.readAsText(file);
    event.target.value = "";
  };

  /* ==========================================================
     HISTORY
  ========================================================== */

  const loadHistoryItem = (item: TranslationHistory) => {
    if (isListening) stopListening();
    stopAudio();
    setSourceLanguage(item.sourceLanguage);
    setTargetLanguage(item.targetLanguage);
    setSourceText(item.sourceText);
    setTranslatedText(item.translatedText);
    setAudioUrl(item.audioUrl || null);
    setMode("text_to_text");
  };

  const deleteHistory = (id: string) => {
    setHistory((previous) => previous.filter((item) => item.id !== id));
  };

  const recentHistory = useMemo(() => history.slice(0, 3), [history]);

  /* ==========================================================
     TIME
  ========================================================== */

  const formatTime = (date: string) => {
    const difference = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(difference / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  /* ==========================================================
     LANGUAGE SELECT
  ========================================================== */

  const LanguageSelect = ({
    value,
    onChange,
    options,
    label,
  }: {
    value: string;
    onChange: (value: string) => void;
    options: Language[];
    label: string;
  }) => (
    <div className="flex-1">
      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 pr-10 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all cursor-pointer"
        >
          {options.map((language) => (
            <option key={language.code} value={language.code}>
              {language.name}{language.code !== "auto" ? ` · ${language.native}` : ""}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          {Icons.chevron}
        </div>
      </div>
    </div>
  );

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="w-full max-w-[1500px] mx-auto">
      {/* HEADER */}
      <div className="mb-7">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                {Icons.language}
              </div>
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">
                Translation Workspace
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              Translate anything.
            </h1>
            <p className="mt-2 text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-2xl">
              Fast, natural translations with text and voice support across 25 languages.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Translations</p>
              <p className="text-lg font-bold text-slate-800 dark:text-white">{translationCount.toLocaleString()}</p>
            </div>
            {isTextInput && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="hidden sm:flex items-center gap-2 px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400 transition-all shadow-sm"
              >
                {Icons.upload}
                Import text
              </button>
            )}
            {/* ✅ NEW: Export Button */}
            <button
              type="button"
              onClick={handleExport}
              className="hidden sm:flex items-center gap-2 px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400 transition-all shadow-sm"
            >
              {Icons.download}
              Export
            </button>
            <input ref={fileInputRef} type="file" accept=".txt,.md,.csv" className="hidden" onChange={handleFileUpload} />
          </div>
        </div>
      </div>

      {/* MODE SELECTOR */}
      <div className="mb-5 flex justify-center">
        <div className="inline-flex flex-wrap justify-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          {modeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                if (isListening) stopListening();
                stopAudio();
                setMode(option.value);
                setTranslatedText("");
                setAudioUrl(null);
              }}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                mode === option.value
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              <span className="flex items-center gap-2">
                {option.value.includes("text") ? Icons.text : Icons.speech}
                {option.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* TRANSLATION CARD */}
      <div className="rounded-[28px] border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)] overflow-hidden">
        {/* LANGUAGE TOOLBAR */}
        <div className="px-4 md:px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <LanguageSelect label="From" value={sourceLanguage} onChange={setSourceLanguage} options={LANGUAGES} />
            <button
              type="button"
              onClick={handleSwap}
              disabled={sourceLanguage === "auto"}
              className="self-center md:mt-5 w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
            >
              {Icons.swap}
            </button>
            <LanguageSelect
              label="To"
              value={targetLanguage}
              onChange={setTargetLanguage}
              options={LANGUAGES.filter((language) => language.code !== "auto")}
            />
          </div>
        </div>

        {/* AREAS */}
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* SOURCE */}
          <div className="min-h-[390px] border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between px-5 md:px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {isSpeechInput
                    ? isProcessingSpeech
                      ? "Processing speech..."
                      : "Voice input"
                    : sourceLanguage === "auto"
                    ? "Detected language"
                    : getLanguageName(sourceLanguage)}
                </span>
              </div>
              <button
                type="button"
                onClick={handleClear}
                disabled={!sourceText && !translatedText}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-red-500 disabled:opacity-30 transition-colors"
              >
                {Icons.trash}
                Clear
              </button>
            </div>
            <div className="px-5 md:px-6">
              {isTextInput ? (
                <textarea
                  value={sourceText}
                  onChange={(event) => setSourceText(event.target.value.slice(0, MAX_CHARACTERS))}
                  placeholder="Type or paste something to translate..."
                  className="w-full min-h-[265px] resize-none bg-transparent border-0 outline-none text-lg leading-8 text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-700"
                />
              ) : (
                <div className="w-full min-h-[265px] flex flex-col items-center justify-center text-center">
                  {isListening ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-500">
                          {Icons.mic}
                        </div>
                        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 animate-pulse" />
                      </div>
                      <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">Listening...</p>
                      <p className="text-sm text-slate-400 max-w-xs">Speak naturally, then press Stop.</p>
                      <button
                        type="button"
                        onClick={stopListening}
                        className="mt-2 px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition"
                      >
                        Stop listening
                      </button>
                    </div>
                  ) : isProcessingSpeech ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <span className="w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
                      </div>
                      <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">Processing speech...</p>
                      <p className="text-sm text-slate-400 max-w-xs">Converting your recording into text.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <button
                        type="button"
                        onClick={startListening}
                        className="w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center hover:scale-105 transition-transform"
                      >
                        {Icons.mic}
                      </button>
                      <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">Tap to speak</p>
                      <p className="text-sm text-slate-400 max-w-xs">Your browser records audio and the backend processes it.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SOURCE BOTTOM */}
            <div className="px-5 md:px-6 pb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isSpeechInput && (
                  <button
                    type="button"
                    onClick={handleVoiceToggle}
                    disabled={isProcessingSpeech}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all ${
                      isListening
                        ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-500"
                        : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-700"
                    } disabled:opacity-40`}
                  >
                    {isListening ? Icons.stop : Icons.mic}
                  </button>
                )}
                {isTextInput && (
                  <>
                    <button
                      type="button"
                      onClick={startListening}
                      className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-700 transition-all"
                      title="Record voice"
                    >
                      {Icons.mic}
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-700 transition-all"
                      title="Import file"
                    >
                      {Icons.file}
                    </button>
                  </>
                )}
              </div>
              {isTextInput && (
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-20 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${characterPercentage}%` }} />
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    {characterCount.toLocaleString()} / {MAX_CHARACTERS.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* OUTPUT */}
          <div className="min-h-[390px] bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex items-center justify-between px-5 md:px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {isSpeechOutput ? "Speech output" : getLanguageName(targetLanguage)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isTextOutput && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={!translatedText}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-blue-600 disabled:opacity-30 transition-colors"
                  >
                    {copied ? Icons.check : Icons.copy}
                    {copied ? "Copied" : "Copy"}
                  </button>
                )}
                {isSpeechOutput && translatedText && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isPlaying) stopAudio();
                      else playAudio(audioUrl);
                    }}
                    disabled={!audioUrl}
                    className={`flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                      isPlaying ? "text-red-500" : "text-slate-400 hover:text-blue-600"
                    }`}
                  >
                    {isPlaying ? Icons.stop : Icons.volume}
                    {isPlaying ? "Stop" : "Play"}
                  </button>
                )}
              </div>
            </div>
            <div className="px-5 md:px-6">
              {translatedText ? (
                isTextOutput ? (
                  <div className="min-h-[265px] text-lg leading-8 text-slate-800 dark:text-slate-100 whitespace-pre-wrap">
                    {translatedText}
                  </div>
                ) : (
                  <div className="min-h-[265px] flex flex-col items-center justify-center text-center gap-4">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isPlaying ? "bg-blue-100 dark:bg-blue-500/20 text-blue-600 animate-pulse" : "bg-blue-50 dark:bg-blue-500/10 text-blue-600"}`}>
                      {isPlaying ? Icons.volume : Icons.play}
                    </div>
                    <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                      {isPlaying ? "Speaking..." : "Ready to speak"}
                    </p>
                    <p className="text-sm text-slate-400 max-w-xs line-clamp-3">{translatedText}</p>
                    {!isPlaying && (
                      <button
                        type="button"
                        onClick={() => playAudio(audioUrl)}
                        disabled={!audioUrl}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold transition"
                      >
                        Play translation
                      </button>
                    )}
                  </div>
                )
              ) : (
                <div className="min-h-[265px] flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4">
                    {isSpeechOutput ? Icons.volume : Icons.sparkle}
                  </div>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {isSpeechOutput ? "Your speech will play here" : "Your translation will appear here"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400 max-w-xs">
                    {isSpeechInput
                      ? "Record speech, stop recording, then process it."
                      : isSpeechOutput
                      ? "Translate text to hear the result."
                      : "Enter text and translate it."}
                  </p>
                </div>
              )}
            </div>
            <div className="px-5 md:px-6 pb-5 flex items-center justify-end">
              <span className="text-[11px] text-slate-400">
                {translatedText.length ? `${translatedText.length.toLocaleString()} characters` : "Ready"}
              </span>
            </div>
          </div>
        </div>

        {/* ACTION BAR */}
        <div className="border-t border-slate-100 dark:border-slate-800 px-5 md:px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600">
              {Icons.check}
            </span>
            <span>Your translations are saved securely</span>
          </div>
          <button
            type="button"
            onClick={handleTranslate}
            disabled={!sourceText.trim() || isTranslating || isProcessingSpeech}
            className="group flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-sm shadow-lg hover:-translate-y-0.5 disabled:opacity-40 transition-all"
          >
            {isTranslating ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Translating...
              </>
            ) : (
              <>
                {isSpeechOutput ? Icons.volume : Icons.sparkle}
                {mode === "text_to_text"
                  ? "Translate"
                  : mode === "text_to_speech"
                  ? "Translate & Speak"
                  : mode === "speech_to_text"
                  ? "Transcribe"
                  : "Translate & Speak"}
                {Icons.arrow}
              </>
            )}
          </button>
        </div>
      </div>

      {/* RECENT TRANSLATIONS */}
      {recentHistory.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">{Icons.clock}</span>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Recent translations</h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">Your latest translation activity</p>
            </div>
            <span className="text-xs text-slate-400">{history.length} saved</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentHistory.map((item) => (
              <div
                key={item.id}
                className="group relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer"
                onClick={() => loadHistoryItem(item)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {getLanguageName(item.sourceLanguage)}
                    </span>
                    <span className="text-slate-300">→</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">
                      {getLanguageName(item.targetLanguage)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteHistory(item.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 transition-all"
                  >
                    {Icons.close}
                  </button>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 leading-6">{item.sourceText}</p>
                <div className="my-3 h-px bg-slate-100 dark:bg-slate-800" />
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-2 leading-6">{item.translatedText}</p>
                <p className="mt-3 text-[10px] text-slate-400">{formatTime(item.createdAt)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* INFO */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 pb-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center mb-4">
            {Icons.language}
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">25 languages</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">English, Hindi, Marathi, Tamil, Telugu, Malayalam, Bengali, Gujarati and more.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-4">
            {Icons.volume}
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Browser-independent voice</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">Microphone audio is recorded locally and processed by the Django backend.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center mb-4">
            {Icons.sparkle}
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Voice + text</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">Text, speech-to-text, text-to-speech and speech-to-speech share one translation workspace.</p>
        </div>
      </div>
    </div>
  );
};

export default TranslatePage;