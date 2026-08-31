import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  Settings,
  Palette,
  Languages,
  Bell,
  Shield,
  Database,
  User,
  Sliders,
  Globe,
  Zap,
  FileText,
  History,
  ArrowRightLeft,
  Sparkles,
  CheckCircle2,
  RotateCcw,
  ChevronDown,
  Moon,
  Sun,
  Monitor,
  Mail,
  Lock,
  HardDrive,
  CreditCard,
  Code2,
  X,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
  Volume2,
  Info,
} from "lucide-react";

/* =========================================================
TYPES
========================================================= */
type ThemeMode = "light" | "dark" | "system";
type ActiveSection =
  | "general"
  | "appearance"
  | "translation"
  | "notifications"
  | "privacy"
  | "data"
  | "account"
  | "advanced";

interface SettingsState {
  sourceLanguage: string;
  targetLanguage: string;
  autoSwap: boolean;
  autoTranslate: boolean;
  preserveFormatting: boolean;
  saveHistory: boolean;
  translationStyle: string;
  formalityLevel: string;
  translationSpeed: string;
  theme: ThemeMode;
  fontSize: string;
  compactMode: boolean;
  showAnimations: boolean;
  defaultEngine: string;
  autoDetectLanguage: boolean;
  showOriginalText: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  translationComplete: boolean;
  weeklyReport: boolean;
  shareUsageData: boolean;
  allowAnalytics: boolean;
  twoFactorAuth: boolean;
  autoSave: boolean;
  cacheSize: string;
  exportFormat: string;
  developerMode: boolean;
  ttsVoice: string;
}

interface UserProfile {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar?: string | null;
  auth_provider?: string | null;
  font_size?: string;
  compact_mode?: boolean;
  show_animations?: boolean;
  theme?: ThemeMode;
  language?: string;
  notifications_enabled?: boolean;
  auto_save?: boolean;
  email_notifications?: boolean;
  push_notifications?: boolean;
  translation_complete?: boolean;
  weekly_report?: boolean;
  share_usage_data?: boolean;
  allow_analytics?: boolean;
  two_factor_auth?: boolean;
  cache_size?: string;
  export_format?: string;
  developer_mode?: boolean;
  api_config?: Record<string, unknown>;
}

interface SelectOption {
  code: string;
  name: string;
}

interface Notification {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  customEndpoint: string;
  timeout: number;
}

interface AccountActivity {
  id: string;
  action: string;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

/* =========================================================
API
========================================================= */
const API_BASE = `${(process.env.REACT_APP_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "")}/api`;

const getToken = (): string | null => {
  return localStorage.getItem("access_token");
};

const refreshAuthToken = async (): Promise<boolean> => {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch(
      `${API_BASE}/api/auth/token/refresh/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refresh: refreshToken,
        }),
      }
    );

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    if (data?.access) {
      localStorage.setItem(
        "access_token",
        data.access
      );
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

const getCurrentUserStorageId = (): string => {
  try {
    const token = getToken();
    if (!token) {
      return "guest";
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      return "guest";
    }

    const normalizedPayload =
      parts[1]
        .replace(/-/g, "+")
        .replace(/_/g, "/");
    const payload = JSON.parse(
      atob(normalizedPayload)
    );

    return String(
      payload.user_id ||
        payload.userId ||
        payload.sub ||
        "guest"
    );
  } catch {
    return "guest";
  }
};

const getSettingsStorageKey = (): string => {
  return `quill_settings_${getCurrentUserStorageId()}`;
};

/* =========================================================
DEFAULT SETTINGS
========================================================= */
const DEFAULT_SETTINGS: SettingsState = {
  sourceLanguage: "auto",
  targetLanguage: "en",
  autoSwap: true,
  autoTranslate: true,
  preserveFormatting: true,
  saveHistory: true,
  translationStyle: "balanced",
  formalityLevel: "neutral",
  translationSpeed: "standard",
  theme: "light",
  fontSize: "medium",
  compactMode: false,
  showAnimations: true,
  defaultEngine: "google",
  autoDetectLanguage: true,
  showOriginalText: true,
  emailNotifications: true,
  pushNotifications: false,
  translationComplete: true,
  weeklyReport: false,
  shareUsageData: false,
  allowAnalytics: true,
  twoFactorAuth: false,
  autoSave: true,
  cacheSize: "medium",
  exportFormat: "pdf",
  developerMode: false,
  ttsVoice: "en-US-AriaNeural",
};

/* =========================================================
OPTIONS
========================================================= */
const TRANSLATION_ENGINES: SelectOption[] = [
  {
    code: "google",
    name: "Google Translate",
  },
  {
    code: "deepl",
    name: "DeepL",
  },
  {
    code: "microsoft",
    name: "Microsoft Translator",
  },
  {
    code: "myMemory",
    name: "MyMemory",
  },
];

const VOICE_OPTIONS: SelectOption[] = [
  {
    code: "en-US-AriaNeural",
    name: "Aria (Female, US)",
  },
  {
    code: "en-US-GuyNeural",
    name: "Guy (Male, US)",
  },
  {
    code: "en-US-JennyNeural",
    name: "Jenny (Female, US)",
  },
  {
    code: "en-GB-SoniaNeural",
    name: "Sonia (Female, UK)",
  },
  {
    code: "en-GB-RyanNeural",
    name: "Ryan (Male, UK)",
  },
  {
    code: "en-AU-NatashaNeural",
    name: "Natasha (Female, AU)",
  },
  {
    code: "en-AU-WilliamNeural",
    name: "William (Male, AU)",
  },
  {
    code: "en-IN-NeerjaNeural",
    name: "Neerja (Female, IN)",
  },
  {
    code: "en-IN-PrabhatNeural",
    name: "Prabhat (Male, IN)",
  },
  {
    code: "hi-IN-SwaraNeural",
    name: "Swara (Female, Hindi)",
  },
];

const LANGUAGES: SelectOption[] = [
  {
    code: "auto",
    name: "Detect Language",
  },
  {
    code: "en",
    name: "English",
  },
  {
    code: "hi",
    name: "Hindi",
  },
  {
    code: "es",
    name: "Spanish",
  },
  {
    code: "fr",
    name: "French",
  },
  {
    code: "de",
    name: "German",
  },
  {
    code: "it",
    name: "Italian",
  },
  {
    code: "pt",
    name: "Portuguese",
  },
  {
    code: "ru",
    name: "Russian",
  },
  {
    code: "ja",
    name: "Japanese",
  },
  {
    code: "ko",
    name: "Korean",
  },
  {
    code: "zh",
    name: "Chinese",
  },
  {
    code: "ar",
    name: "Arabic",
  },
  {
    code: "tr",
    name: "Turkish",
  },
  {
    code: "nl",
    name: "Dutch",
  },
  {
    code: "pl",
    name: "Polish",
  },
  {
    code: "sv",
    name: "Swedish",
  },
  {
    code: "id",
    name: "Indonesian",
  },
  {
    code: "vi",
    name: "Vietnamese",
  },
  {
    code: "uk",
    name: "Ukrainian",
  },
  {
    code: "mr",
    name: "Marathi",
  },
  {
    code: "ta",
    name: "Tamil",
  },
  {
    code: "te",
    name: "Telugu",
  },
  {
    code: "bn",
    name: "Bengali",
  },
  {
    code: "gu",
    name: "Gujarati",
  },
];

const sidebarItems: {
  id: ActiveSection;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    id: "general",
    label: "General",
    description: "Basic preferences",
    icon: Settings,
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Customize the look",
    icon: Palette,
  },
  {
    id: "translation",
    label: "Translation",
    description: "Default languages, style",
    icon: Languages,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Manage alerts & emails",
    icon: Bell,
  },
  {
    id: "privacy",
    label: "Privacy & Security",
    description: "Your data and security",
    icon: Shield,
  },
  {
    id: "data",
    label: "Data & Storage",
    description: "Cache, history, exports",
    icon: Database,
  },
  {
    id: "account",
    label: "Account",
    description: "Profile, plan, billing & activity",
    icon: User,
  },
  {
    id: "advanced",
    label: "Advanced",
    description: "Developer & advanced settings",
    icon: Sliders,
  },
];

/* =========================================================
HELPER COMPONENTS
========================================================= */
const Toggle = ({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
}) => (
  <button
    type="button"
    aria-pressed={enabled}
    onClick={() => onChange(!enabled)}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
      enabled
        ? "bg-blue-600"
        : "bg-slate-300 dark:bg-slate-600"
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
        enabled
          ? "translate-x-6"
          : "translate-x-1"
      }`}
    />
  </button>
);

const Select = ({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
}) => {
  const [open, setOpen] =
    useState(false);
  const dropdownRef =
    useRef<HTMLDivElement>(null);

  const selected = options.find(
    (option) =>
      option.code === value
  );

  useEffect(() => {
    const handleClickOutside = (
      event: MouseEvent
    ) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener(
        "mousedown",
        handleClickOutside
      );
    }

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, [open]);

  return (
    <div
      ref={dropdownRef}
      className="relative"
    >
      <button
        type="button"
        onClick={() =>
          setOpen((prev) => !prev)
        }
        className="flex min-w-[180px] items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700"
      >
        <span className="truncate">
          {selected?.name || value}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform ${
            open
              ? "rotate-180"
              : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[100] mt-1.5 w-full min-w-[180px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">
          <div className="max-h-60 overflow-y-auto py-1">
            {options.map(
              (option) => {
                const isSelected =
                  value ===
                  option.code;

                return (
                  <button
                    key={
                      option.code
                    }
                    type="button"
                    onClick={() => {
                      onChange(
                        option.code
                      );
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-600/20 dark:text-blue-400"
                        : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    <span>
                      {option.name}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="h-4 w-4 text-blue-500" />
                    )}
                  </button>
                );
              }
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const SettingsRow = ({
  icon,
  iconBg,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  iconBg: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) => {
  const Icon = icon;

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-slate-700">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>
      </div>
      <div className="shrink-0">
        {children}
      </div>
    </div>
  );
};

/* =========================================================
CONFIRMATION MODAL
========================================================= */
const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Yes",
  cancelText = "No",
  isDanger = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-4 flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              isDanger
                ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            }`}
          >
            {isDanger ? (
              <AlertCircle className="h-5 w-5" />
            ) : (
              <Info className="h-5 w-5" />
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {title}
          </h3>
        </div>

        <p className="mb-6 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {message}
        </p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${
              isDanger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================================
2FA SETUP MODAL
========================================================= */
const TwoFactorSetupModal = ({
  isOpen,
  onClose,
  onEnabled,
}: {
  isOpen: boolean;
  onClose: () => void;
  onEnabled: () => void;
}) => {
  const [step, setStep] = useState<
    "show-qr" | "verify"
  >("show-qr");
  const [qrCodeUri, setQrCodeUri] =
    useState("");
  const [otpCode, setOtpCode] =
    useState("");
  const [loading, setLoading] =
    useState(false);
  const [error, setError] =
    useState("");
  const [emailSent, setEmailSent] =
    useState(false);

  useEffect(() => {
    if (isOpen) {
      void fetchSetupData();
    } else {
      setStep("show-qr");
      setOtpCode("");
      setError("");
      setQrCodeUri("");
      setEmailSent(false);
    }
  }, [isOpen]);

  const fetchSetupData =
    async () => {
      setLoading(true);
      setError("");

      try {
        let token = getToken();
        if (!token) {
          setError(
            "You must be logged in to set up 2FA."
          );
          return;
        }

        let response =
          await fetch(
            `${API_BASE}/auth/2fa/setup/`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        if (
          response.status === 401
        ) {
          const refreshed =
            await refreshAuthToken();
          if (refreshed) {
            token = getToken();
            response =
              await fetch(
                `${API_BASE}/auth/2fa/setup/`,
                {
                  headers: {
                    Authorization:
                      `Bearer ${token}`,
                  },
                }
              );
          }
        }

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        const data =
          await response.json();
        if (
          data?.success &&
          data?.data?.uri
        ) {
          setQrCodeUri(
            data.data.uri
          );
        } else {
          setError(
            data?.message ||
              "Failed to load 2FA setup data."
          );
        }
      } catch (error) {
        console.error(
          "2FA Setup Error:",
          error
        );
        setError(
          "Network error or backend issue."
        );
      } finally {
        setLoading(false);
      }
    };

  const handleVerify = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (otpCode.length !== 6) {
      setError(
        "Enter the 6-digit code."
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = getToken();
      const response =
        await fetch(
          `${API_BASE}/auth/2fa/verify/`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${token}`,
            },
            body: JSON.stringify({
              otp_code: otpCode,
            }),
          }
        );

      const data =
        await response.json();
      if (data?.success) {
        onEnabled();
        onClose();
      } else {
        setError(
          data?.message ||
            "Invalid verification code."
        );
      }
    } catch {
      setError(
        "Verification failed."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEmailFallback =
    async () => {
      setLoading(true);
      setError("");

      try {
        const token = getToken();
        const response =
          await fetch(
            `${API_BASE}/auth/2fa/email-fallback/`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await response.json();
        if (data?.success) {
          setEmailSent(true);
        } else {
          setError(
            data?.message ||
              "Failed to send verification email."
          );
        }
      } catch {
        setError(
          "Network error."
        );
      } finally {
        setLoading(false);
      }
    };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Setup 2FA
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading &&
        step === "show-qr" ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="mt-2 text-sm text-slate-500">
              Generating QR code...
            </p>
          </div>
        ) : step === "show-qr" ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              <p className="font-semibold">
                Step 1: Scan QR Code
              </p>
              <p className="mt-1">
                Scan this code with Google Authenticator,
                Authy, or Microsoft Authenticator.
              </p>
            </div>

            <div className="flex justify-center rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-700">
              {qrCodeUri ? (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                    qrCodeUri
                  )}`}
                  alt="2FA QR Code"
                  className="h-48 w-48 rounded-lg"
                />
              ) : (
                <div className="flex h-48 w-48 items-center justify-center rounded-lg bg-slate-100 p-4 text-center text-xs text-slate-400 dark:bg-slate-600">
                  QR code unavailable.
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                setStep("verify")
              }
              className="w-full rounded-lg bg-blue-600 py-2.5 font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Next: Verify Code
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleVerify}
            className="space-y-4"
          >
            <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              <p className="font-semibold">
                Step 2: Enter Verification Code
              </p>
              <p className="mt-1">
                Open your authenticator app and enter the
                6-digit code for your account.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                6-Digit Code
              </label>
              <input
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(event) =>
                  setOtpCode(
                    event.target.value.replace(
                      /\D/g,
                      ""
                    )
                  )
                }
                placeholder="000000"
                autoFocus
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-widest outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-700 dark:text-white"
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">
                Don't have an authenticator app?
              </p>
              <button
                type="button"
                onClick={
                  handleEmailFallback
                }
                disabled={
                  loading ||
                  emailSent
                }
                className="flex w-full items-center justify-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-600 shadow-sm transition-colors hover:bg-blue-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-blue-400 dark:hover:bg-slate-600"
              >
                {emailSent ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-green-600 dark:text-green-400">
                      Code sent to your email
                    </span>
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    <span>
                      Send verification code to Email
                    </span>
                  </>
                )}
              </button>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setStep("show-qr");
                  setOtpCode("");
                  setError("");
                  setEmailSent(false);
                }}
                className="flex-1 rounded-lg border border-slate-300 py-2.5 font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={
                  loading ||
                  otpCode.length !== 6
                }
                className="flex-1 rounded-lg bg-blue-600 py-2.5 font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                ) : (
                  "Verify & Enable"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

/* =========================================================
PROFILE EDIT MODAL
========================================================= */
const ProfileEditModal = ({
  isOpen,
  onClose,
  profile,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  onSave: (
    data: Partial<UserProfile> & {
      new_password?: string;
    }
  ) => Promise<void>;
}) => {
  const [step, setStep] =
    useState<"form" | "otp">("form");
  const [formData, setFormData] =
    useState({
      email: "",
      first_name: "",
      last_name: "",
      new_email: "",
      new_password: "",
    });
  const [showPassword, setShowPassword] =
    useState(false);
  const [otp, setOtp] =
    useState("");
  const [loading, setLoading] =
    useState(false);
  const [error, setError] =
    useState("");
  const [timeLeft, setTimeLeft] =
    useState(60);

  useEffect(() => {
    if (profile && isOpen) {
      setFormData({
        email:
          profile.email || "",
        first_name:
          profile.first_name || "",
        last_name:
          profile.last_name || "",
        new_email: "",
        new_password: "",
      });
      setStep("form");
      setOtp("");
      setError("");
      setTimeLeft(60);
      setShowPassword(false);
    }
  }, [profile, isOpen]);

  useEffect(() => {
    if (
      step !== "otp" ||
      timeLeft <= 0
    ) {
      return;
    }

    const timer =
      window.setTimeout(() => {
        setTimeLeft(
          (prev) =>
            prev - 1
        );
      }, 1000);

    return () =>
      window.clearTimeout(timer);
  }, [step, timeLeft]);

  if (!isOpen) {
    return null;
  }

  const requestOTP =
    async (): Promise<boolean> => {
      setError("");
      setLoading(true);

      try {
        const token = getToken();
        const response =
          await fetch(
            `${API_BASE}/api/auth/otp/request/`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
                ...(token
                  ? {
                      Authorization:
                        `Bearer ${token}`,
                    }
                  : {}),
              },
              body: JSON.stringify({
                purpose:
                  "email_change",
                email:
                  formData.new_email,
              }),
            }
          );

        const data =
          await response.json();
        if (
          response.ok &&
          data?.success
        ) {
          setTimeLeft(60);
          return true;
        }

        setError(
          data?.message ||
            "Failed to send OTP."
        );
        return false;
      } catch (error) {
        console.error(
          "OTP request failed:",
          error
        );
        setError(
          "Failed to request OTP."
        );
        return false;
      } finally {
        setLoading(false);
      }
    };

  const handleSubmit =
    async (
      event: React.FormEvent
    ) => {
      event.preventDefault();
      setError("");

      const wantsEmailChange =
        formData.new_email.trim() &&
        formData.new_email
          .trim()
          .toLowerCase() !==
          profile?.email
            ?.trim()
            .toLowerCase();

      if (wantsEmailChange) {
        const success =
          await requestOTP();
        if (success) {
          setStep("otp");
        }
        return;
      }

      setLoading(true);

      try {
        const payload: Partial<
          UserProfile
        > & {
          new_password?: string;
        } = {
          email:
            formData.email,
          first_name:
            formData.first_name,
          last_name:
            formData.last_name,
        };

        if (
          formData.new_password
            .trim()
        ) {
          payload.new_password =
            formData.new_password;
        }

        await onSave(
          payload
        );
        onClose();
      } catch (error: any) {
        setError(
          error?.message ||
            "An error occurred while saving."
        );
      } finally {
        setLoading(false);
      }
    };

  const handleVerifyOTP =
    async (
      event: React.FormEvent
    ) => {
      event.preventDefault();
      setError("");

      if (otp.length !== 6) {
        setError(
          "Enter the 6-digit OTP."
        );
        return;
      }

      setLoading(true);

      try {
        const token =
          getToken();
        const response =
          await fetch(
            `${API_BASE}/api/auth/otp/verify/`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
                Authorization:
                  `Bearer ${token}`,
              },
              body: JSON.stringify({
                otp_code: otp,
                purpose:
                  "email_change",
                new_email:
                  formData.new_email,
              }),
            }
          );

        const data =
          await response.json();
        if (!response.ok) {
          const validationMessage =
            data?.errors?.otp_code?.[0] ||
            data?.errors?.otp?.[0];
          setError(
            validationMessage ||
              data?.message ||
              "Invalid OTP. Please try again."
          );
          return;
        }

        if (!data?.success) {
          setError(
            data?.message ||
              "Invalid OTP."
          );
          return;
        }

        const payload: Partial<
          UserProfile
        > & {
          new_password?: string;
        } = {
          email:
            formData.new_email,
          first_name:
            formData.first_name,
          last_name:
            formData.last_name,
        };

        if (
          formData.new_password
            .trim()
        ) {
          payload.new_password =
            formData.new_password;
        }

        await onSave(
          payload
        );
        onClose();
      } catch (error: any) {
        setError(
          error?.message ||
            "Verification failed."
        );
      } finally {
        setLoading(false);
      }
    };

  const formatTime = (
    seconds: number
  ) => {
    const minutes =
      Math.floor(seconds / 60);
    const remainingSeconds =
      seconds % 60;
    return `${minutes
      .toString()
      .padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {step === "form"
              ? "Edit Profile"
              : "Verify Email Change"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {error}
            </span>
          </div>
        )}

        {step === "form" ? (
          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                First Name
              </label>
              <input
                type="text"
                value={
                  formData.first_name
                }
                onChange={(
                  event
                ) =>
                  setFormData(
                    (prev) => ({
                      ...prev,
                      first_name:
                        event.target
                          .value,
                    })
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-700 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Last Name
              </label>
              <input
                type="text"
                value={
                  formData.last_name
                }
                onChange={(
                  event
                ) =>
                  setFormData(
                    (prev) => ({
                      ...prev,
                      last_name:
                        event.target
                          .value,
                    })
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-700 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Current Email
              </label>
              <input
                type="email"
                value={
                  formData.email
                }
                disabled
                className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-700"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                New Email{" "}
                <span className="text-slate-400">
                  (optional)
                </span>
              </label>
              <input
                type="email"
                value={
                  formData.new_email
                }
                onChange={(
                  event
                ) =>
                  setFormData(
                    (prev) => ({
                      ...prev,
                      new_email:
                        event.target
                          .value,
                    })
                  )
                }
                placeholder="newemail@example.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-700 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                New Password{" "}
                <span className="text-slate-400">
                  (optional)
                </span>
              </label>
              <div className="relative">
                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={
                    formData.new_password
                  }
                  onChange={(
                    event
                  ) =>
                    setFormData(
                      (prev) => ({
                        ...prev,
                        new_password:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  placeholder="Enter new password"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-700 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (prev) =>
                        !prev
                    )
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg bg-blue-600 py-2.5 font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Save Changes"
              )}
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleVerifyOTP}
            className="space-y-4"
          >
            <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              <p className="font-semibold">
                OTP Sent
              </p>
              <p className="mt-1">
                Verification code sent to:
              </p>
              <p className="mt-1 break-all font-semibold">
                {formData.new_email}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Enter OTP
              </label>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(
                  event
                ) =>
                  setOtp(
                    event.target.value.replace(
                      /\D/g,
                      ""
                    )
                  )
                }
                placeholder="000000"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-widest outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-700 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">
                Expires in{" "}
                <span className="font-mono font-semibold">
                  {formatTime(
                    timeLeft
                  )}
                </span>
              </span>
              {timeLeft === 0 && (
                <button
                  type="button"
                  onClick={() =>
                    void requestOTP()
                  }
                  disabled={loading}
                  className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  Resend OTP
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep("form");
                  setOtp("");
                  setError("");
                }}
                className="flex-1 rounded-lg border border-slate-300 py-2.5 font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={
                  loading ||
                  otp.length !== 6
                }
                className="flex-1 rounded-lg bg-blue-600 py-2.5 font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                ) : (
                  "Verify"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

/* =========================================================
PASSWORD CHANGE MODAL
========================================================= */
const PasswordChangeModal = ({
  isOpen,
  onClose,
  onChangePassword,
}: {
  isOpen: boolean;
  onClose: () => void;
  onChangePassword: (
    oldPass: string,
    newPass: string
  ) => Promise<void>;
}) => {
  const [oldPassword, setOldPassword] =
    useState("");
  const [newPassword, setNewPassword] =
    useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [showOld, setShowOld] =
    useState(false);
  const [showNew, setShowNew] =
    useState(false);
  const [loading, setLoading] =
    useState(false);
  const [error, setError] =
    useState("");

  if (!isOpen) {
    return null;
  }

  const handleSubmit =
    async (
      event: React.FormEvent
    ) => {
      event.preventDefault();
      setError("");

      if (
        newPassword !==
        confirmPassword
      ) {
        setError(
          "Passwords do not match."
        );
        return;
      }

      if (
        newPassword.length < 8
      ) {
        setError(
          "Password must be at least 8 characters."
        );
        return;
      }

      setLoading(true);

      try {
        await onChangePassword(
          oldPassword,
          newPassword
        );
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        onClose();
      } catch (error: any) {
        setError(
          error?.message ||
            "Failed to change password."
        );
      } finally {
        setLoading(false);
      }
    };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Change Password
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Current Password
            </label>
            <div className="relative">
              <input
                type={
                  showOld
                    ? "text"
                    : "password"
                }
                value={oldPassword}
                onChange={(
                  event
                ) =>
                  setOldPassword(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-700 dark:text-white"
              />
              <button
                type="button"
                onClick={() =>
                  setShowOld(
                    (prev) =>
                      !prev
                  )
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showOld ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              New Password
            </label>
            <div className="relative">
              <input
                type={
                  showNew
                    ? "text"
                    : "password"
                }
                value={newPassword}
                onChange={(
                  event
                ) =>
                  setNewPassword(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-700 dark:text-white"
              />
              <button
                type="button"
                onClick={() =>
                  setShowNew(
                    (prev) =>
                      !prev
                  )
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showNew ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(
                event
              ) =>
                setConfirmPassword(
                  event.target.value
                )
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-700 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-lg bg-blue-600 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "Change Password"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

/* =========================================================
API CONFIG MODAL
========================================================= */
const ApiConfigModal = ({
  isOpen,
  onClose,
  config,
  setConfig,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  config: ApiConfig;
  setConfig: React.Dispatch<
    React.SetStateAction<ApiConfig>
  >;
  onSave: () => void;
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            API Configuration
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Base URL
            </label>
            <input
              type="text"
              value={config.baseUrl}
              onChange={(event) =>
                setConfig({
                  ...config,
                  baseUrl:
                    event.target.value,
                })
              }
              placeholder={process.env.REACT_APP_API_URL || "https://your-backend.onrender.com"}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-700 dark:text-white"
            />
            <p className="mt-1 text-xs text-slate-500">
              Backend API base URL
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              API Key (Optional)
            </label>
            <input
              type="password"
              value={config.apiKey}
              onChange={(event) =>
                setConfig({
                  ...config,
                  apiKey:
                    event.target.value,
                })
              }
              placeholder="Enter API key if required"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-700 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Custom Endpoint (Optional)
            </label>
            <input
              type="text"
              value={config.customEndpoint}
              onChange={(event) =>
                setConfig({
                  ...config,
                  customEndpoint:
                    event.target.value,
                })
              }
              placeholder="/api/custom"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-700 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Request Timeout (ms)
            </label>
            <input
              type="number"
              value={config.timeout}
              onChange={(event) =>
                setConfig({
                  ...config,
                  timeout: Number(
                    event.target.value
                  ),
                })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-700 dark:text-white"
            />
            <p className="mt-1 text-xs text-slate-500">
              Default: 30000ms
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-300 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="flex-1 rounded-lg bg-blue-600 py-2.5 font-semibold text-white hover:bg-blue-700"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================================
MAIN COMPONENT
========================================================= */
export default function SettingsPage() {
  const [
    activeSection,
    setActiveSection,
  ] =
    useState<ActiveSection>(
      "general"
    );
  const [
    notifications,
    setNotifications,
  ] = useState<Notification[]>(
    []
  );
  const [
    settings,
    setSettings,
  ] =
    useState<SettingsState>(() => {
      try {
        const key =
          getSettingsStorageKey();
        const saved =
          localStorage.getItem(key);
        const parsed = saved
          ? JSON.parse(saved)
          : {};
        const globalTheme =
          localStorage.getItem(
            "quill_theme"
          ) as ThemeMode | null;

        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          theme:
            globalTheme ===
              "light" ||
            globalTheme ===
              "dark" ||
            globalTheme ===
              "system"
              ? globalTheme
              : parsed.theme ||
                "light",
        };
      } catch {
        return DEFAULT_SETTINGS;
      }
    });
  const [
    profile,
    setProfile,
  ] =
    useState<UserProfile | null>(
      null
    );
  const [
    toast,
    setToast,
  ] =
    useState("");
  const [
    isLoading,
    setIsLoading,
  ] =
    useState(false);
  const [
    showProfileModal,
    setShowProfileModal,
  ] =
    useState(false);
  const [
    showPasswordModal,
    setShowPasswordModal,
  ] =
    useState(false);
  const [
    show2FAModal,
    setShow2FAModal,
  ] =
    useState(false);
  const [
    developerMode,
    setDeveloperMode,
  ] =
    useState(false);
  const [
    showApiModal,
    setShowApiModal,
  ] =
    useState(false);
  const [
    apiConfig,
    setApiConfig,
  ] =
    useState<ApiConfig>({
      baseUrl:
        process.env
          .REACT_APP_API_URL ||
        "http://127.0.0.1:8000",
      apiKey: "",
      customEndpoint: "",
      timeout: 30000,
    });
  const [
    showDeleteConfirm,
    setShowDeleteConfirm,
  ] =
    useState(false);
  const [
    showResetConfirm,
    setShowResetConfirm,
  ] =
    useState(false);
  const [
    activities,
    setActivities,
  ] =
    useState<AccountActivity[]>(
      []
    );
  const [
    activityLoading,
    setActivityLoading,
  ] =
    useState(false);
  const [
    activityError,
    setActivityError,
  ] =
    useState("");

  /* =========================================================
  TOAST
  ========================================================= */
  const showToast =
    useCallback(
      (message: string) => {
        setToast(message);
        window.setTimeout(
          () => {
            setToast("");
          },
          2200
        );
      },
      []
    );

  const addNotification =
    useCallback(
      (
        type:
          | "success"
          | "error"
          | "info",
        message: string
      ) => {
        const id =
          Math.random()
            .toString(36)
            .substring(
              2,
              9
            );
        setNotifications(
          (previous) => [
            ...previous,
            {
              id,
              type,
              message,
            },
          ]
        );
        window.setTimeout(
          () => {
            setNotifications(
              (previous) =>
                previous.filter(
                  (item) =>
                    item.id !== id
                )
            );
          },
          5000
        );
      },
      []
    );

  const removeNotification =
    useCallback(
      (id: string) => {
        setNotifications(
          (previous) =>
            previous.filter(
              (item) =>
                item.id !== id
            )
        );
      },
      []
    );

  /* =========================================================
  LOCAL STORAGE
  ========================================================= */
  const persistSettings =
    useCallback(
      (
        nextSettings: SettingsState
      ) => {
        try {
          const key =
            getSettingsStorageKey();
          localStorage.setItem(
            key,
            JSON.stringify(
              nextSettings
            )
          );
          localStorage.setItem(
            "quill_settings",
            JSON.stringify(
              nextSettings
            )
          );
        } catch (error) {
          console.error(
            "Failed to persist settings:",
            error
          );
        }
      },
      []
    );

  useEffect(() => {
    persistSettings(settings);
  }, [
    settings,
    persistSettings,
  ]);

  /* =========================================================
  FONT / COMPACT / ANIMATION
  ========================================================= */
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-font-size",
      settings.fontSize
    );
    document.documentElement.classList.toggle(
      "compact-mode",
      settings.compactMode
    );
    document.documentElement.classList.toggle(
      "no-animations",
      !settings.showAnimations
    );
  }, [
    settings.fontSize,
    settings.compactMode,
    settings.showAnimations,
  ]);

  /* =========================================================
  THEME SYNC
  ========================================================= */
  useEffect(() => {
    const handleThemeUpdate = (
      event: Event
    ) => {
      const customEvent =
        event as CustomEvent;
      const nextTheme =
        customEvent.detail
          ?.theme as
          | ThemeMode
          | undefined;
      if (
        nextTheme ===
          "light" ||
        nextTheme ===
          "dark" ||
        nextTheme ===
          "system"
      ) {
        setSettings(
          (previous) => ({
            ...previous,
            theme: nextTheme,
          })
        );
      }
    };

    window.addEventListener(
      "theme-updated",
      handleThemeUpdate
    );
    return () =>
      window.removeEventListener(
        "theme-updated",
        handleThemeUpdate
      );
  }, []);

  /*
  IMPORTANT:
  Settings page does not apply a theme on mount.
  Theme is applied only when Appearance -> Theme Mode
  is actually changed.
  */

  /* =========================================================
  LOAD PROFILE
  ========================================================= */
  const loadProfile =
    useCallback(async () => {
      const token =
        getToken();
      if (!token) {
        return;
      }

      setIsLoading(true);

      try {
        let response =
          await fetch(
            `${API_BASE}/api/auth/me/`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        if (
          response.status === 401
        ) {
          const refreshed =
            await refreshAuthToken();
          if (refreshed) {
            response =
              await fetch(
                `${API_BASE}/api/auth/me/`,
                {
                  headers: {
                    Authorization:
                      `Bearer ${getToken()}`,
                  },
                }
              );
          }
        }

        if (!response.ok) {
          return;
        }

        const data =
          await response.json();
        if (
          data?.success &&
          data?.data
        ) {
          const userData =
            data.data;
          setProfile(
            userData
          );
          setSettings(
            (previous) => ({
              ...previous,
              autoSave:
                userData.auto_save ??
                previous.autoSave,
              fontSize:
                userData.font_size ||
                previous.fontSize,
              compactMode:
                userData.compact_mode ??
                previous.compactMode,
              showAnimations:
                userData.show_animations ??
                previous.showAnimations,
              emailNotifications:
                userData.email_notifications ??
                previous.emailNotifications,
              pushNotifications:
                userData.push_notifications ??
                previous.pushNotifications,
              translationComplete:
                userData.translation_complete ??
                previous.translationComplete,
              weeklyReport:
                userData.weekly_report ??
                previous.weeklyReport,
              shareUsageData:
                userData.share_usage_data ??
                previous.shareUsageData,
              allowAnalytics:
                userData.allow_analytics ??
                previous.allowAnalytics,
              twoFactorAuth:
                userData.two_factor_auth ??
                previous.twoFactorAuth,
              developerMode:
                userData.developer_mode ??
                previous.developerMode,
            })
          );
        }
      } catch (error) {
        console.error(
          "Failed to load profile:",
          error
        );
      } finally {
        setIsLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  /* =========================================================
  LOAD DEV MODE / API CONFIG
  ========================================================= */
  useEffect(() => {
    const savedDeveloperMode =
      localStorage.getItem(
        "quill_developer_mode"
      );
    setDeveloperMode(
      savedDeveloperMode ===
        "true"
    );

    const savedApiConfig =
      localStorage.getItem(
        "quill_api_config"
      );
    if (savedApiConfig) {
      try {
        setApiConfig(
          JSON.parse(
            savedApiConfig
          )
        );
      } catch {
        // Ignore invalid local config.
      }
    }
  }, []);

  useEffect(() => {
    setSettings(
      (previous) => ({
        ...previous,
        developerMode,
      })
    );
    localStorage.setItem(
      "quill_developer_mode",
      String(developerMode)
    );

    if (developerMode) {
      console.log(
        "Developer Mode Enabled"
      );
    }
  }, [developerMode]);

  /* =========================================================
  REAL-TIME ACCOUNT ACTIVITY
  ========================================================= */
  const fetchAccountActivities =
    useCallback(
      async (
        showLoader = false
      ) => {
        const token =
          getToken();
        if (!token) {
          setActivities([]);
          setActivityError(
            "Please login to view account activity."
          );
          return;
        }

        if (showLoader) {
          setActivityLoading(
            true
          );
        }

        setActivityError("");

        try {
          let response =
            await fetch(
              `${API_BASE}/api/auth/account/activity/`,
              {
                method: "GET",
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                  "Content-Type":
                    "application/json",
                },
              }
            );

          if (
            response.status === 401
          ) {
            const refreshed =
              await refreshAuthToken();
            if (refreshed) {
              response =
                await fetch(
                  `${API_BASE}/api/auth/account/activity/`,
                  {
                    method:
                      "GET",
                    headers: {
                      Authorization:
                        `Bearer ${getToken()}`,
                      "Content-Type":
                        "application/json",
                    },
                  }
                );
            }
          }

          if (
            response.status === 401
          ) {
            setActivities([]);
            setActivityError(
              "Your session has expired. Please login again."
            );
            return;
          }

          if (!response.ok) {
            throw new Error(
              `Activity API failed with status ${response.status}`
            );
          }

          const data =
            await response.json();
          if (
            data?.success &&
            Array.isArray(
              data?.data
            )
          ) {
            setActivities(
              data.data
            );
          } else {
            setActivities([]);
            setActivityError(
              data?.message ||
                "Unable to load account activity."
            );
          }
        } catch (error) {
          console.error(
            "Failed to fetch account activities:",
            error
          );
          setActivityError(
            "Unable to load account activity."
          );
        } finally {
          if (showLoader) {
            setActivityLoading(
              false
            );
          }
        }
      },
      []
    );

  useEffect(() => {
    if (
      activeSection !==
      "account"
    ) {
      return;
    }

    let mounted = true;

    const loadInitial =
      async () => {
        if (!mounted) {
          return;
        }
        await fetchAccountActivities(
          true
        );
      };

    void loadInitial();

    /*
    Poll every 3 seconds while
    Account page is open.
    */
    const interval =
      window.setInterval(
        () => {
          if (!mounted) {
            return;
          }
          void fetchAccountActivities(
            false
          );
        },
        3000
      );

    return () => {
      mounted = false;
      window.clearInterval(
        interval
      );
    };
  }, [
    activeSection,
    fetchAccountActivities,
  ]);

  /*
  Any component in the application can trigger this event
  after a successful account/security action.
  */
  useEffect(() => {
    const handleActivityRefresh =
      () => {
        if (
          activeSection ===
          "account"
        ) {
          void fetchAccountActivities(
            false
          );
        }
      };

    window.addEventListener(
      "account-activity-updated",
      handleActivityRefresh
    );
    return () =>
      window.removeEventListener(
        "account-activity-updated",
        handleActivityRefresh
      );
  }, [
    activeSection,
    fetchAccountActivities,
  ]);

  /* =========================================================
  SAVE API CONFIG
  ========================================================= */
  const handleSaveApiConfig =
    () => {
      localStorage.setItem(
        "quill_api_config",
        JSON.stringify(
          apiConfig
        )
      );

      const axiosInstance =
        (
          window as any
        ).axios;
      if (axiosInstance) {
        axiosInstance.defaults.baseURL =
          apiConfig.baseUrl;
        axiosInstance.defaults.timeout =
          apiConfig.timeout;
        if (apiConfig.apiKey) {
          axiosInstance.defaults.headers.common[
            "Authorization"
          ] =
            `Bearer ${apiConfig.apiKey}`;
        }
      }

      setShowApiModal(
        false
      );
      showToast(
        "API configuration saved successfully!"
      );
      window.dispatchEvent(
        new CustomEvent(
          "account-activity-updated"
        )
      );
    };

  /* =========================================================
  BACKEND FIELD MAPPING
  ========================================================= */
  const backendKeyMap: Record<
    string,
    string
  > = {
    fontSize:
      "font_size",
    compactMode:
      "compact_mode",
    showAnimations:
      "show_animations",
    emailNotifications:
      "email_notifications",
    pushNotifications:
      "push_notifications",
    translationComplete:
      "translation_complete",
    weeklyReport:
      "weekly_report",
    shareUsageData:
      "share_usage_data",
    allowAnalytics:
      "allow_analytics",
    theme: "theme",
    autoSave:
      "auto_save",
  };

  /* =========================================================
  UPDATE SETTING
  ========================================================= */
  const updateSetting =
    useCallback(
      async <
        K extends keyof SettingsState
      >(
        key: K,
        value: SettingsState[K]
      ) => {
        setSettings(
          (previous) => {
            const next = {
              ...previous,
              [key]: value,
            };
            persistSettings(
              next
            );
            return next;
          }
        );

        /*
        THEME IS APPLIED ONLY HERE.
        */
        if (key === "theme") {
          const nextTheme =
            value as ThemeMode;
          const mediaQuery =
            window.matchMedia(
              "(prefers-color-scheme: dark)"
            );
          const shouldUseDark =
            nextTheme ===
              "dark" ||
            (nextTheme ===
              "system" &&
              mediaQuery.matches);
          const root =
            document.documentElement;
          root.classList.toggle(
            "dark",
            shouldUseDark
          );
          root.setAttribute(
            "data-theme",
            shouldUseDark
              ? "dark"
              : "light"
          );
          root.style.colorScheme =
            shouldUseDark
              ? "dark"
              : "light";
          localStorage.setItem(
            "quill_theme",
            nextTheme
          );
          window.dispatchEvent(
            new CustomEvent(
              "theme-updated",
              {
                detail: {
                  theme:
                    nextTheme,
                },
              }
            )
          );
        }

        window.dispatchEvent(
          new Event(
            "settings-updated"
          )
        );

        const backendKey =
          backendKeyMap[
            key as string
          ];
        const token =
          getToken();
        if (
          backendKey &&
          token
        ) {
          try {
            const response =
              await fetch(
                `${API_BASE}/api/auth/settings/`,
                {
                  method:
                    "PATCH",
                  headers: {
                    "Content-Type":
                      "application/json",
                    Authorization:
                      `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    [backendKey]:
                      value,
                  }),
                }
              );

            if (!response.ok) {
              console.error(
                "Failed to save setting to backend"
              );
            }
          } catch (error) {
            console.error(
              "Error saving setting to backend:",
              error
            );
          }
        }

        showToast(
          "Setting saved"
        );
      },
      [
        persistSettings,
        showToast,
      ]
    );

  /* =========================================================
  2FA TOGGLE
  ========================================================= */
  const handleTwoFactorToggle =
    async (
      value: boolean
    ) => {
      if (value) {
        setShow2FAModal(
          true
        );
        return;
      }

      try {
        const token =
          getToken();
        const response =
          await fetch(
            `${API_BASE}/api/auth/otp/toggle/`,
            {
              method:
                "POST",
              headers: {
                "Content-Type":
                  "application/json",
                Authorization:
                  `Bearer ${token}`,
              },
              body: JSON.stringify(
                {
                  action:
                    "disable",
                }
              ),
            }
          );

        const data =
          await response.json();
        if (data?.success) {
          setSettings(
            (previous) => ({
              ...previous,
              twoFactorAuth:
                false,
            })
          );
          showToast(
            "Two-Factor Authentication disabled successfully."
          );
          window.dispatchEvent(
            new CustomEvent(
              "account-activity-updated"
            )
          );
        } else {
          throw new Error(
            data?.message
          );
        }
      } catch (error) {
        console.error(
          "2FA disable error:",
          error
        );
        showToast(
          "Failed to disable 2FA."
        );
      }
    };

  /* =========================================================
  ACTIVITY FORMAT
  ========================================================= */
  const formatActivityDate =
    (
      dateString: string
    ) => {
      const date =
        new Date(
          dateString
        );
      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return "Unknown time";
      }

      const diff = Math.max(
        0,
        Date.now() -
          date.getTime()
      );
      const seconds =
        Math.floor(
          diff / 1000
        );

      if (seconds < 10) {
        return "Just now";
      }

      if (seconds < 60) {
        return `${seconds}s ago`;
      }

      const minutes =
        Math.floor(
          seconds / 60
        );
      if (minutes < 60) {
        return `${minutes}m ago`;
      }

      const hours =
        Math.floor(
          minutes / 60
        );
      if (hours < 24) {
        return `${hours}h ago`;
      }

      const days =
        Math.floor(
          hours / 24
        );
      if (days < 7) {
        return `${days}d ago`;
      }

      return date.toLocaleDateString(
        "en-IN",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      );
    };

  const getActivityIcon =
    (action: string) => {
      const text =
        action.toLowerCase();
      if (
        text.includes(
          "password"
        )
      ) {
        return Lock;
      }
      if (
        text.includes(
          "2fa"
        ) ||
        text.includes(
          "two-factor"
        )
      ) {
        return Shield;
      }
      if (
        text.includes(
          "login"
        ) ||
        text.includes(
          "logged"
        )
      ) {
        return CheckCircle2;
      }
      if (
        text.includes(
          "profile"
        ) ||
        text.includes(
          "email"
        )
      ) {
        return User;
      }
      if (
        text.includes(
          "settings"
        )
      ) {
        return Settings;
      }
      if (
        text.includes(
          "push"
        )
      ) {
        return Bell;
      }
      return History;
    };

  /* =========================================================
  DELETE ACCOUNT
  ========================================================= */
  const handleDeleteAccount =
    async () => {
      try {
        const token =
          getToken();
        const response =
          await fetch(
            `${API_BASE}/api/auth/account/delete/`,
            {
              method:
                "DELETE",
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        if (!response.ok) {
          console.error(
            "Delete account request failed."
          );
        }

        localStorage.clear();
        showToast(
          "Account deleted successfully."
        );
        window.setTimeout(
          () => {
            window.location.href =
              "/login";
          },
          1000
        );
      } catch (error) {
        console.error(
          "Delete account error:",
          error
        );
        localStorage.clear();
        window.location.href =
          "/login";
      }
    };

  /* =========================================================
  RESET ACCOUNT SETTINGS
  ========================================================= */
  const handleResetSettings =
    async () => {
      const token =
        getToken();

      /*
      Preserve theme.
      Reset settings.
      Keep user logged in.
      */
      const currentTheme =
        settings.theme;
      const nextSettings = {
        ...DEFAULT_SETTINGS,
        theme:
          currentTheme,
      };

      setSettings(
        nextSettings
      );
      persistSettings(
        nextSettings
      );

      try {
        if (token) {
          const response =
            await fetch(
              `${API_BASE}/api/auth/account/reset-settings/`,
              {
                method:
                  "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );

          if (!response.ok) {
            console.error(
              "Backend reset settings failed."
            );
          }
        }
      } catch (error) {
        console.error(
          "Backend reset settings error:",
          error
        );
      }

      showToast(
        "Settings reset successfully."
      );
      window.dispatchEvent(
        new CustomEvent(
          "account-activity-updated"
        )
      );
    };

  /* =========================================================
  CLEAR LOCAL APP DATA
  ========================================================= */
  const clearAppData =
    useCallback(() => {
      const confirmed =
        window.confirm(
          "Clear all local quill data?\n\nThis will remove:\n- Translation history\n- Cached data\n- Local preferences\n\nYour account and server-side data will remain intact."
        );

      if (!confirmed) {
        return;
      }

      try {
        const currentAccess =
          localStorage.getItem(
            "access_token"
          );
        const currentRefresh =
          localStorage.getItem(
            "refresh_token"
          );
        const currentUser =
          localStorage.getItem(
            "currentUser"
          );
        const currentTheme =
          settings.theme;

        localStorage.clear();

        if (currentAccess) {
          localStorage.setItem(
            "access_token",
            currentAccess
          );
        }

        if (currentRefresh) {
          localStorage.setItem(
            "refresh_token",
            currentRefresh
          );
        }

        if (currentUser) {
          localStorage.setItem(
            "currentUser",
            currentUser
          );
        }

        localStorage.setItem(
          "quill_theme",
          currentTheme
        );

        if (window.indexedDB) {
          const request =
            indexedDB.deleteDatabase(
              "quillDB"
            );
          request.onsuccess =
            () =>
              console.log(
                "IndexedDB cleared"
              );
          request.onerror =
            () =>
              console.error(
                "Failed to clear IndexedDB"
              );
        }

        sessionStorage.clear();

        const nextSettings = {
          ...DEFAULT_SETTINGS,
          theme:
            currentTheme,
        };
        setSettings(
          nextSettings
        );
        persistSettings(
          nextSettings
        );

        window.dispatchEvent(
          new CustomEvent(
            "quill-history-cleared"
          )
        );
        window.dispatchEvent(
          new CustomEvent(
            "quill-cache-cleared"
          )
        );

        showToast(
          "All local data cleared successfully."
        );
      } catch (error) {
        console.error(
          "Clear app data error:",
          error
        );
        showToast(
          "Could not clear app data."
        );
      }
    }, [
      persistSettings,
      settings.theme,
      showToast,
    ]);

  /* =========================================================
  PROFILE UPDATE
  ========================================================= */
  const updateProfile =
    useCallback(
      async (
        data: Partial<UserProfile> & {
          new_password?: string;
        }
      ) => {
        const token =
          getToken();
        if (!token) {
          const error =
            new Error(
              "Authentication required. Please login."
            );
          addNotification(
            "error",
            error.message
          );
          throw error;
        }

        try {
          const requestBody =
            {
              ...data,
            };

          /*
          Backend profile endpoint does not need
          `new_password` as a User field.
          Password is handled separately.
          */
          delete (
            requestBody as Record<
              string,
              unknown
            >
          ).new_password;

          const response =
            await fetch(
              `${API_BASE}/api/auth/profile/`,
              {
                method:
                  "PATCH",
                headers: {
                  "Content-Type":
                    "application/json",
                  Authorization:
                    `Bearer ${token}`,
                },
                body: JSON.stringify(
                  requestBody
                ),
              }
            );

          const contentType =
            response.headers.get(
              "content-type"
            );
          if (
            !contentType ||
            !contentType.includes(
              "application/json"
            )
          ) {
            throw new Error(
              `Server error (Status ${response.status}).`
            );
          }

          const result =
            await response.json();
          if (
            response.ok &&
            result?.success
          ) {
            setProfile(
              result.data
            );

            const currentUser =
              JSON.parse(
                localStorage.getItem(
                  "currentUser"
                ) || "null"
              );
            if (currentUser) {
              currentUser.email =
                result.data.email ||
                currentUser.email;
              currentUser.first_name =
                result.data.first_name ||
                currentUser.first_name;
              currentUser.last_name =
                result.data.last_name ||
                currentUser.last_name;
              currentUser.name =
                result.data.name ||
                currentUser.name;
              localStorage.setItem(
                "currentUser",
                JSON.stringify(
                  currentUser
                )
              );
            }

            addNotification(
              "success",
              "Profile updated successfully!"
            );
            window.dispatchEvent(
              new CustomEvent(
                "profile-updated",
                {
                  detail:
                    result.data,
                }
              )
            );
            window.dispatchEvent(
              new CustomEvent(
                "account-activity-updated"
              )
            );
            return;
          }

          throw new Error(
            result?.message ||
              "Failed to update profile."
          );
        } catch (error: any) {
          console.error(
            "Profile update failed:",
            error
          );
          addNotification(
            "error",
            error?.message ||
              "Failed to update profile."
          );
          throw error;
        }
      },
      [addNotification]
    );

  /* =========================================================
  CHANGE PASSWORD
  ========================================================= */
  const changePassword =
    useCallback(
      async (
        oldPass: string,
        newPass: string
      ) => {
        const token =
          getToken();
        if (!token) {
          throw new Error(
            "Authentication required."
          );
        }

        try {
          const response =
            await fetch(
              `${API_BASE}/api/auth/password/change/`,
              {
                method:
                  "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                  Authorization:
                    `Bearer ${token}`,
                },
                body: JSON.stringify({
                  old_password:
                    oldPass,
                  new_password:
                    newPass,
                  confirm_password:
                    newPass,
                }),
              }
            );

          const data =
            await response.json();
          if (
            response.ok &&
            data?.success
          ) {
            addNotification(
              "success",
              "Password changed successfully!"
            );
            window.dispatchEvent(
              new CustomEvent(
                "account-activity-updated"
              )
            );
            return;
          }

          let detailedError =
            data?.message ||
            "Failed to change password.";
          if (data?.errors) {
            if (
              data.errors
                .old_password
            ) {
              detailedError =
                "Current password is incorrect.";
            } else if (
              data.errors
                .new_password
            ) {
              detailedError =
                `New password: ${
                  Array.isArray(
                    data.errors
                      .new_password
                  )
                    ? data.errors
                        .new_password[0]
                    : data.errors
                        .new_password
                }`;
            } else if (
              data.errors
                .confirm_password
            ) {
              detailedError =
                "Passwords do not match.";
            }
          }

          throw new Error(
            detailedError
          );
        } catch (error: any) {
          console.error(
            "Password change failed:",
            error
          );
          addNotification(
            "error",
            error?.message ||
              "Failed to change password."
          );
          throw error;
        }
      },
      [addNotification]
    );

  /* =========================================================
  GENERAL
  ========================================================= */
  const renderGeneral =
    () => (
      <div className="space-y-4">
        <SettingsRow
          icon={Globe}
          iconBg="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
          title="Default Source Language"
          description="Select the language you usually translate from"
        >
          <Select
            value={
              settings.sourceLanguage
            }
            onChange={(value) =>
              void updateSetting(
                "sourceLanguage",
                value
              )
            }
            options={LANGUAGES}
          />
        </SettingsRow>

        <SettingsRow
          icon={Languages}
          iconBg="bg-purple-100 text-purple-600 dark:bg-purple-600/20 dark:text-purple-400"
          title="Default Target Language"
          description="Select the language you usually translate to"
        >
          <Select
            value={
              settings.targetLanguage
            }
            onChange={(value) =>
              void updateSetting(
                "targetLanguage",
                value
              )
            }
            options={LANGUAGES.filter(
              (language) =>
                language.code !==
                "auto"
            )}
          />
        </SettingsRow>

        <SettingsRow
          icon={ArrowRightLeft}
          iconBg="bg-blue-100 text-blue-600 dark:bg-blue-600/20 dark:text-blue-400"
          title="Auto Swap Languages"
          description="Automatically swap source and target languages"
        >
          <Toggle
            enabled={
              settings.autoSwap
            }
            onChange={(value) =>
              void updateSetting(
                "autoSwap",
                value
              )
            }
          />
        </SettingsRow>

        <SettingsRow
          icon={Zap}
          iconBg="bg-green-100 text-green-600 dark:bg-green-600/20 dark:text-green-400"
          title="Auto Translate"
          description="Automatically translate text when typing"
        >
          <Toggle
            enabled={
              settings.autoTranslate
            }
            onChange={(value) =>
              void updateSetting(
                "autoTranslate",
                value
              )
            }
          />
        </SettingsRow>

        <SettingsRow
          icon={FileText}
          iconBg="bg-amber-100 text-amber-600 dark:bg-amber-600/20 dark:text-amber-400"
          title="Preserve Formatting"
          description="Keep original formatting in translated text"
        >
          <Toggle
            enabled={
              settings.preserveFormatting
            }
            onChange={(value) =>
              void updateSetting(
                "preserveFormatting",
                value
              )
            }
          />
        </SettingsRow>

        <SettingsRow
          icon={History}
          iconBg="bg-red-100 text-red-600 dark:bg-red-600/20 dark:text-red-400"
          title="Save Translation History"
          description="Store translation history locally"
        >
          <Toggle
            enabled={
              settings.saveHistory
            }
            onChange={(value) =>
              void updateSetting(
                "saveHistory",
                value
              )
            }
          />
        </SettingsRow>

        <div className="rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Quick Preferences
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Frequently used settings
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const confirmed =
                  window.confirm(
                    "Reset all quill settings to default?"
                  );
                if (!confirmed) {
                  return;
                }
                const currentTheme =
                  settings.theme;
                const nextSettings = {
                  ...DEFAULT_SETTINGS,
                  theme:
                    currentTheme,
                };
                setSettings(
                  nextSettings
                );
                persistSettings(
                  nextSettings
                );
                showToast(
                  "Settings reset to default"
                );
              }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <RotateCcw className="h-3 w-3" />
              Reset to Default
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Translation Style
              </label>
              <Select
                value={
                  settings.translationStyle
                }
                onChange={(value) =>
                  void updateSetting(
                    "translationStyle",
                    value
                  )
                }
                options={[
                  {
                    code: "balanced",
                    name: "Balanced",
                  },
                  {
                    code: "formal",
                    name: "Formal",
                  },
                  {
                    code: "casual",
                    name: "Casual",
                  },
                  {
                    code: "creative",
                    name: "Creative",
                  },
                ]}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Formality Level
              </label>
              <Select
                value={
                  settings.formalityLevel
                }
                onChange={(value) =>
                  void updateSetting(
                    "formalityLevel",
                    value
                  )
                }
                options={[
                  {
                    code: "neutral",
                    name: "Neutral",
                  },
                  {
                    code: "formal",
                    name: "Formal",
                  },
                  {
                    code: "informal",
                    name: "Informal",
                  },
                ]}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Translation Speed
              </label>
              <Select
                value={
                  settings.translationSpeed
                }
                onChange={(value) =>
                  void updateSetting(
                    "translationSpeed",
                    value
                  )
                }
                options={[
                  {
                    code: "standard",
                    name: "Standard",
                  },
                  {
                    code: "fast",
                    name: "Fast",
                  },
                  {
                    code: "quality",
                    name: "High Quality",
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    );

  /* =========================================================
  APPEARANCE
  ========================================================= */
  const renderAppearance =
    () => (
      <div className="space-y-4">
        <SettingsRow
          icon={
            settings.theme ===
            "dark"
              ? Moon
              : Sun
          }
          iconBg="bg-indigo-100 text-indigo-600 dark:bg-indigo-600/20 dark:text-indigo-400"
          title="Theme Mode"
          description="Choose your preferred theme"
        >
          <div className="flex gap-2">
            {(
              [
                "light",
                "dark",
                "system",
              ] as ThemeMode[]
            ).map(
              (mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() =>
                    void updateSetting(
                      "theme",
                      mode
                    )
                  }
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium capitalize transition-colors ${
                    settings.theme ===
                    mode
                      ? "bg-blue-600 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {mode ===
                  "light" && (
                    <Sun className="h-3.5 w-3.5" />
                  )}
                  {mode ===
                  "dark" && (
                    <Moon className="h-3.5 w-3.5" />
                  )}
                  {mode ===
                  "system" && (
                    <Monitor className="h-3.5 w-3.5" />
                  )}
                  {mode}
                </button>
              )
            )}
          </div>
        </SettingsRow>

        <SettingsRow
          icon={FileText}
          iconBg="bg-cyan-100 text-cyan-600 dark:bg-cyan-600/20 dark:text-cyan-400"
          title="Font Size"
          description="Adjust the text size across the app"
        >
          <Select
            value={
              settings.fontSize
            }
            onChange={(value) =>
              void updateSetting(
                "fontSize",
                value
              )
            }
            options={[
              {
                code: "small",
                name: "Small",
              },
              {
                code: "medium",
                name: "Medium",
              },
              {
                code: "large",
                name: "Large",
              },
            ]}
          />
        </SettingsRow>

        <SettingsRow
          icon={Sparkles}
          iconBg="bg-pink-100 text-pink-600 dark:bg-pink-600/20 dark:text-pink-400"
          title="Compact Mode"
          description="Reduce spacing for a denser layout"
        >
          <Toggle
            enabled={
              settings.compactMode
            }
            onChange={(value) =>
              void updateSetting(
                "compactMode",
                value
              )
            }
          />
        </SettingsRow>

        <SettingsRow
          icon={Sparkles}
          iconBg="bg-violet-100 text-violet-600 dark:bg-violet-600/20 dark:text-violet-400"
          title="Show Animations"
          description="Enable smooth transitions and animations"
        >
          <Toggle
            enabled={
              settings.showAnimations
            }
            onChange={(value) =>
              void updateSetting(
                "showAnimations",
                value
              )
            }
          />
        </SettingsRow>
      </div>
    );

  /* =========================================================
  TRANSLATION
  ========================================================= */
  const renderTranslation =
    () => (
      <div className="space-y-4">
        <SettingsRow
          icon={Globe}
          iconBg="bg-blue-100 text-blue-600 dark:bg-blue-600/20 dark:text-blue-400"
          title="Default Translation Engine"
          description="Choose the translation provider"
        >
          <Select
            value={
              settings.defaultEngine
            }
            onChange={(value) =>
              void updateSetting(
                "defaultEngine",
                value
              )
            }
            options={
              TRANSLATION_ENGINES
            }
          />
        </SettingsRow>

        <SettingsRow
          icon={Volume2}
          iconBg="bg-purple-100 text-purple-600 dark:bg-purple-600/20 dark:text-purple-400"
          title="Text-to-Speech Voice"
          description="Select voice for text-to-speech"
        >
          <Select
            value={
              settings.ttsVoice
            }
            onChange={(value) =>
              void updateSetting(
                "ttsVoice",
                value
              )
            }
            options={
              VOICE_OPTIONS
            }
          />
        </SettingsRow>

        <SettingsRow
          icon={Sparkles}
          iconBg="bg-green-100 text-green-600 dark:bg-green-600/20 dark:text-green-400"
          title="Auto Detect Language"
          description="Automatically detect source language"
        >
          <Toggle
            enabled={
              settings.autoDetectLanguage
            }
            onChange={(value) =>
              void updateSetting(
                "autoDetectLanguage",
                value
              )
            }
          />
        </SettingsRow>

        <SettingsRow
          icon={FileText}
          iconBg="bg-amber-100 text-amber-600 dark:bg-amber-600/20 dark:text-amber-400"
          title="Show Original Text"
          description="Display original text alongside translation"
        >
          <Toggle
            enabled={
              settings.showOriginalText
            }
            onChange={(value) =>
              void updateSetting(
                "showOriginalText",
                value
              )
            }
          />
        </SettingsRow>
      </div>
    );

  /* =========================================================
  NOTIFICATIONS
  ========================================================= */
  const renderNotifications =
    () => (
      <div className="space-y-4">
        <SettingsRow
          icon={Mail}
          iconBg="bg-blue-100 text-blue-600 dark:bg-blue-600/20 dark:text-blue-400"
          title="Email Notifications"
          description="Receive updates via email"
        >
          <Toggle
            enabled={
              settings.emailNotifications
            }
            onChange={(value) =>
              void updateSetting(
                "emailNotifications",
                value
              )
            }
          />
        </SettingsRow>

        <SettingsRow
          icon={Bell}
          iconBg="bg-amber-100 text-amber-600 dark:bg-amber-600/20 dark:text-amber-400"
          title="Push Notifications"
          description="Get browser push notifications"
        >
          <Toggle
            enabled={
              settings.pushNotifications
            }
            onChange={async (
              value
            ) => {
              if (
                value &&
                "Notification" in
                  window &&
                Notification.permission ===
                  "default"
              ) {
                try {
                  const permission =
                    await Notification.requestPermission();
                  const enabled =
                    permission ===
                    "granted";
                  await updateSetting(
                    "pushNotifications",
                    enabled
                  );
                  showToast(
                    enabled
                      ? "Push notifications enabled."
                      : "Browser permission was not granted."
                  );
                } catch {
                  await updateSetting(
                    "pushNotifications",
                    false
                  );
                }
                return;
              }

              if (
                value &&
                "Notification" in
                  window &&
                Notification.permission ===
                  "denied"
              ) {
                showToast(
                  "Enable notifications from your browser settings."
                );
                return;
              }

              await updateSetting(
                "pushNotifications",
                value
              );
            }}
          />
        </SettingsRow>

        <SettingsRow
          icon={CheckCircle2}
          iconBg="bg-green-100 text-green-600 dark:bg-green-600/20 dark:text-green-400"
          title="Translation Complete"
          description="Notify when translation finishes"
        >
          <Toggle
            enabled={
              settings.translationComplete
            }
            onChange={(value) =>
              void updateSetting(
                "translationComplete",
                value
              )
            }
          />
        </SettingsRow>

        <SettingsRow
          icon={History}
          iconBg="bg-purple-100 text-purple-600 dark:bg-purple-600/20 dark:text-purple-400"
          title="Weekly Report"
          description="Get a weekly summary of your activity"
        >
          <Toggle
            enabled={
              settings.weeklyReport
            }
            onChange={(value) =>
              void updateSetting(
                "weeklyReport",
                value
              )
            }
          />
        </SettingsRow>
      </div>
    );

  /* =========================================================
  PRIVACY
  ========================================================= */
  const renderPrivacy =
    () => (
      <div className="space-y-4">
        <SettingsRow
          icon={Lock}
          iconBg="bg-red-100 text-red-600 dark:bg-red-600/20 dark:text-red-400"
          title="Share Usage Data"
          description="Help us improve by sharing anonymous usage data"
        >
          <Toggle
            enabled={
              settings.shareUsageData
            }
            onChange={(value) =>
              void updateSetting(
                "shareUsageData",
                value
              )
            }
          />
        </SettingsRow>

        <SettingsRow
          icon={Database}
          iconBg="bg-cyan-100 text-cyan-600 dark:bg-cyan-600/20 dark:text-cyan-400"
          title="Allow Analytics"
          description="Enable analytics to improve the platform"
        >
          <Toggle
            enabled={
              settings.allowAnalytics
            }
            onChange={(value) =>
              void updateSetting(
                "allowAnalytics",
                value
              )
            }
          />
        </SettingsRow>

        <SettingsRow
          icon={Shield}
          iconBg="bg-green-100 text-green-600 dark:bg-green-600/20 dark:text-green-400"
          title="Two-Factor Authentication"
          description="Add an extra layer of security to your account"
        >
          <Toggle
            enabled={
              settings.twoFactorAuth
            }
            onChange={
              handleTwoFactorToggle
            }
          />
        </SettingsRow>
      </div>
    );

  /* =========================================================
  DATA
  ========================================================= */
  const renderData =
    () => (
      <div className="space-y-4">
        <SettingsRow
          icon={HardDrive}
          iconBg="bg-blue-100 text-blue-600 dark:bg-blue-600/20 dark:text-blue-400"
          title="Auto Save"
          description="Automatically save your work"
        >
          <Toggle
            enabled={
              settings.autoSave
            }
            onChange={(value) =>
              void updateSetting(
                "autoSave",
                value
              )
            }
          />
        </SettingsRow>

        <SettingsRow
          icon={Database}
          iconBg="bg-purple-100 text-purple-600 dark:bg-purple-600/20 dark:text-purple-400"
          title="Cache Size"
          description="Control how much data is cached locally"
        >
          <Select
            value={
              settings.cacheSize
            }
            onChange={(value) =>
              void updateSetting(
                "cacheSize",
                value
              )
            }
            options={[
              {
                code: "small",
                name: "Small (50MB)",
              },
              {
                code: "medium",
                name: "Medium (200MB)",
              },
              {
                code: "large",
                name: "Large (500MB)",
              },
            ]}
          />
        </SettingsRow>

        <SettingsRow
          icon={FileText}
          iconBg="bg-green-100 text-green-600 dark:bg-green-600/20 dark:text-green-400"
          title="Export Format"
          description="Default format for exported files"
        >
          <Select
            value={
              settings.exportFormat
            }
            onChange={(value) =>
              void updateSetting(
                "exportFormat",
                value
              )
            }
            options={[
              {
                code: "pdf",
                name: "PDF",
              },
              {
                code: "docx",
                name: "Word (DOCX)",
              },
              {
                code: "txt",
                name: "Plain Text",
              },
              {
                code: "html",
                name: "HTML",
              },
            ]}
          />
        </SettingsRow>

        <SettingsRow
          icon={Trash2}
          iconBg="bg-red-100 text-red-600 dark:bg-red-600/20 dark:text-red-400"
          title="Clear App Data"
          description="Remove local cached data and history"
        >
          <button
            type="button"
            onClick={
              clearAppData
            }
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Clear Data
          </button>
        </SettingsRow>
      </div>
    );

  /* =========================================================
  ACCOUNT
  ========================================================= */
  const renderAccount =
    () => (
      <div className="space-y-6">
        {/* PROFILE / SECURITY */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-100">
            Profile & Security
          </h3>

          <SettingsRow
            icon={User}
            iconBg="bg-blue-100 text-blue-600 dark:bg-blue-600/20 dark:text-blue-400"
            title="Profile Information"
            description={
              profile
                ? `${profile.first_name || ""} ${
                    profile.last_name ||
                    ""
                  }`.trim() ||
                  profile.email
                : "Manage your personal details"
            }
          >
            <button
              type="button"
              onClick={() =>
                setShowProfileModal(
                  true
                )
              }
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Edit Profile
            </button>
          </SettingsRow>

          <SettingsRow
            icon={Lock}
            iconBg="bg-purple-100 text-purple-600 dark:bg-purple-600/20 dark:text-purple-400"
            title="Change Password"
            description="Update your account password"
          >
            <button
              type="button"
              onClick={() =>
                setShowPasswordModal(
                  true
                )
              }
              className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700"
            >
              Change
            </button>
          </SettingsRow>

          <SettingsRow
            icon={CreditCard}
            iconBg="bg-green-100 text-green-600 dark:bg-green-600/20 dark:text-green-400"
            title="Subscription Plan"
            description="Manage your plan and billing"
          >
            <button
              type="button"
              onClick={() =>
                showToast(
                  "Billing features are coming soon. Stay tuned!"
                )
              }
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
            >
              Upgrade Plan
            </button>
          </SettingsRow>
        </div>

        {/* ACCOUNT ACTIVITY */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Account Activity
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Recent login and security activity
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                Live
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/50">
            {activityLoading ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Loading activity...
                </p>
              </div>
            ) : activityError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/10">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                      Unable to load activity
                    </p>
                    <p className="mt-1 text-xs text-red-600/80 dark:text-red-400/80">
                      {activityError}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        void fetchAccountActivities(
                          true
                        )
                      }
                      className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            ) : activities.length ===
              0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                  <History className="h-5 w-5 text-slate-400" />
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  No recent activity
                </p>
                <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Login, change your password,
                  update your profile, or modify
                  security settings to see activity here.
                </p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute bottom-3 left-[18px] top-3 w-px bg-slate-200 dark:bg-slate-800" />
                {/* ✅ SCROLLBAR: Jab 5 ya usse zyada activities hon */}
                <div className={`space-y-1 ${
                  activities.length >= 5 
                    ? "max-h-[400px] overflow-y-auto pr-2" 
                    : ""
                }`}>
                  {activities.map(
                    (
                      activity,
                      index
                    ) => {
                      const ActivityIcon =
                        getActivityIcon(
                          activity.action
                        );
                      return (
                        <div
                          key={
                            activity.id ||
                            `${activity.created_at}-${index}`
                          }
                          className="group relative flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                            <ActivityIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                {activity.action}
                              </p>
                              <span className="shrink-0 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                                {formatActivityDate(
                                  activity.created_at
                                )}
                              </span>
                            </div>
                            {activity.ip_address && (
                              <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                                IP:{" "}
                                {
                                  activity.ip_address
                                }
                              </p>
                            )}
                            {activity.user_agent && (
                              <p className="mt-1 truncate text-[9px] text-slate-400 dark:text-slate-600">
                                {
                                  activity.user_agent
                                }
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* DANGER ZONE */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
            Danger Zone
          </h3>

          <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900/50 dark:bg-red-900/10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Reset Account Settings
                </h4>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Reset all your account preferences to default.
                  Your login session will remain active.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setShowResetConfirm(
                    true
                  )
                }
                className="shrink-0 rounded-lg border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                Reset Settings
              </button>
            </div>

            <div className="my-4 border-t border-red-200 dark:border-red-900/50" />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Delete Account
                </h4>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Permanently delete your account and all
                  associated data. This action cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setShowDeleteConfirm(
                    true
                  )
                }
                className="shrink-0 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    );

  /* =========================================================
  ADVANCED
  ========================================================= */
  const renderAdvanced =
    () => (
      <div className="space-y-4">
        <SettingsRow
          icon={Code2}
          iconBg="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
          title="Developer Mode"
          description="Enable advanced debugging features"
        >
          <Toggle
            enabled={developerMode}
            onChange={(value) =>
              setDeveloperMode(
                value
              )
            }
          />
        </SettingsRow>

        <SettingsRow
          icon={Database}
          iconBg="bg-amber-100 text-amber-600 dark:bg-amber-600/20 dark:text-amber-400"
          title="API Configuration"
          description="Manage API keys and endpoints"
        >
          <button
            type="button"
            onClick={() =>
              setShowApiModal(true)
            }
            className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
          >
            Configure
          </button>
        </SettingsRow>

        {developerMode && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/10">
            <div className="flex items-start gap-3">
              <Code2 className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Developer Mode Enabled
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-700/80 dark:text-amber-400/80">
                  • Console logging enabled
                  <br />
                  • API requests will be logged
                  <br />
                  • Debug information available
                  <br />
                  • React DevTools integration active
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );

  /* =========================================================
  CONTENT
  ========================================================= */
  const renderContent =
    () => {
      switch (
        activeSection
      ) {
        case "general":
          return renderGeneral();
        case "appearance":
          return renderAppearance();
        case "translation":
          return renderTranslation();
        case "notifications":
          return renderNotifications();
        case "privacy":
          return renderPrivacy();
        case "data":
          return renderData();
        case "account":
          return renderAccount();
        case "advanced":
          return renderAdvanced();
        default:
          return renderGeneral();
      }
    };

  /* =========================================================
  TITLES
  ========================================================= */
  const sectionTitles: Record<
    ActiveSection,
    string
  > = {
    general: "General",
    appearance:
      "Appearance",
    translation:
      "Translation",
    notifications:
      "Notifications",
    privacy:
      "Privacy & Security",
    data: "Data & Storage",
    account: "Account",
    advanced:
      "Advanced",
  };

  const sectionDescriptions: Record<
    ActiveSection,
    string
  > = {
    general:
      "Manage preferences and application behavior",
    appearance:
      "Customize the look and feel",
    translation:
      "Configure translation defaults",
    notifications:
      "Manage alerts and emails",
    privacy:
      "Your data and security settings",
    data:
      "Cache, history, and exports",
    account:
      "Profile, plan, billing & activity",
    advanced:
      "Developer and advanced settings",
  };

  /* =========================================================
  RENDER
  ========================================================= */
  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
      {/* =====================================================
      LIVE NOTIFICATIONS
      ===================================================== */}
      <div className="pointer-events-none fixed left-0 right-0 top-4 z-[300] flex flex-col items-center gap-2 px-4">
        {notifications.map(
          (notification) => (
            <div
              key={
                notification.id
              }
              className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${
                notification.type ===
                "success"
                  ? "border-green-200 bg-green-50/90 text-green-800 dark:border-green-800 dark:bg-green-900/90 dark:text-green-100"
                  : notification.type ===
                    "error"
                  ? "border-red-200 bg-red-50/90 text-red-800 dark:border-red-800 dark:bg-red-900/90 dark:text-red-100"
                  : "border-blue-200 bg-blue-50/90 text-blue-800 dark:border-blue-800 dark:bg-blue-900/90 dark:text-blue-100"
              }`}
            >
              {notification.type ===
              "success" && (
                <CheckCircle2 className="h-5 w-5 shrink-0" />
              )}
              {notification.type ===
              "error" && (
                <AlertCircle className="h-5 w-5 shrink-0" />
              )}
              {notification.type ===
              "info" && (
                <Info className="h-5 w-5 shrink-0" />
              )}
              <p className="flex-1 text-sm font-medium">
                {
                  notification.message
                }
              </p>
              <button
                type="button"
                onClick={() =>
                  removeNotification(
                    notification.id
                  )
                }
                className="shrink-0 rounded-lg p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        )}
      </div>

      {/* =====================================================
      TOAST
      ===================================================== */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-xl">
          <CheckCircle2 className="h-4 w-4" />
          {toast}
        </div>
      )}

      {/* =====================================================
      PROFILE LOADING
      ===================================================== */}
      {isLoading && (
        <div className="fixed left-1/2 top-3 z-[250] -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-lg backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-600" />
            Loading profile...
          </div>
        </div>
      )}

      {/* =====================================================
      MODALS
      ===================================================== */}
      <ProfileEditModal
        isOpen={
          showProfileModal
        }
        onClose={() =>
          setShowProfileModal(
            false
          )
        }
        profile={profile}
        onSave={
          updateProfile
        }
      />

      <PasswordChangeModal
        isOpen={
          showPasswordModal
        }
        onClose={() =>
          setShowPasswordModal(
            false
          )
        }
        onChangePassword={
          changePassword
        }
      />

      <TwoFactorSetupModal
        isOpen={
          show2FAModal
        }
        onClose={() =>
          setShow2FAModal(
            false
          )
        }
        onEnabled={() => {
          setSettings(
            (previous) => ({
              ...previous,
              twoFactorAuth:
                true,
            })
          );
          showToast(
            "Two-Factor Authentication enabled successfully!"
          );
          window.dispatchEvent(
            new CustomEvent(
              "account-activity-updated"
            )
          );
          if (
            activeSection ===
            "account"
          ) {
            void fetchAccountActivities(
              false
            );
          }
        }}
      />

      <ApiConfigModal
        isOpen={
          showApiModal
        }
        onClose={() =>
          setShowApiModal(
            false
          )
        }
        config={
          apiConfig
        }
        setConfig={
          setApiConfig
        }
        onSave={
          handleSaveApiConfig
        }
      />

      {/* =====================================================
      CONFIRMATION MODALS
      ===================================================== */}
      <ConfirmationModal
        isOpen={
          showDeleteConfirm
        }
        onClose={() =>
          setShowDeleteConfirm(
            false
          )
        }
        onConfirm={
          handleDeleteAccount
        }
        title="Delete Account?"
        message="Are you absolutely sure? This will permanently delete your account and all associated data. This action cannot be undone."
        confirmText="Yes, Delete"
        cancelText="No, Cancel"
        isDanger={true}
      />

      <ConfirmationModal
        isOpen={
          showResetConfirm
        }
        onClose={() =>
          setShowResetConfirm(
            false
          )
        }
        onConfirm={
          handleResetSettings
        }
        title="Reset Settings?"
        message="This will reset your account preferences to their default values while keeping your current theme and login session."
        confirmText="Yes, Reset"
        cancelText="No, Cancel"
        isDanger={true}
      />

      {/* =====================================================
      MAIN PAGE
      ===================================================== */}
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* SIDEBAR */}
          <aside className="w-full shrink-0 lg:w-72">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/50">
              <nav className="space-y-1">
                {sidebarItems.map(
                  (item) => {
                    const Icon =
                      item.icon;
                    const isActive =
                      activeSection ===
                      item.id;

                    return (
                      <button
                        key={
                          item.id
                        }
                        type="button"
                        onClick={() =>
                          setActiveSection(
                            item.id
                          )
                        }
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all ${
                          isActive
                            ? "border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-600/30 dark:bg-blue-600/10 dark:text-blue-400"
                            : "border-transparent text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                        }`}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold">
                            {
                              item.label
                            }
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">
                            {
                              item.description
                            }
                          </div>
                        </div>
                      </button>
                    );
                  }
                )}
              </nav>
            </div>
          </aside>

          {/* MAIN */}
          <main className="min-w-0 flex-1">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {
                  sectionTitles[
                    activeSection
                  ]
                }
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {
                  sectionDescriptions[
                    activeSection
                  ]
                }
              </p>
            </div>

            <div className="space-y-4">
              {renderContent()}
            </div>
          </main>
        </div>
      </div>

      {/* =====================================================
      STYLES
      ===================================================== */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        html[data-font-size="small"] {
          font-size: 14px !important;
        }

        html[data-font-size="medium"] {
          font-size: 16px !important;
        }

        html[data-font-size="large"] {
          font-size: 18px !important;
        }

        html.compact-mode .rounded-3xl {
          border-radius: 0.75rem !important;
        }

        html.compact-mode .rounded-2xl {
          border-radius: 0.5rem !important;
        }

        html.compact-mode .rounded-xl {
          border-radius: 0.375rem !important;
        }

        html.compact-mode .rounded-lg {
          border-radius: 0.25rem !important;
        }

        html.compact-mode .p-8 {
          padding: 1.5rem !important;
        }

        html.compact-mode .p-6 {
          padding: 1rem !important;
        }

        html.compact-mode .p-5 {
          padding: 0.875rem !important;
        }

        html.compact-mode .p-4 {
          padding: 0.75rem !important;
        }

        html.compact-mode .p-3 {
          padding: 0.5rem !important;
        }

        html.compact-mode .gap-6 {
          gap: 1rem !important;
        }

        html.compact-mode .gap-4 {
          gap: 0.75rem !important;
        }

        html.compact-mode .gap-3 {
          gap: 0.5rem !important;
        }

        html.no-animations *,
        html.no-animations *::before,
        html.no-animations *::after {
          animation-duration: 0.01ms !important;
          animation-delay: 0.01ms !important;
          transition-duration: 0.01ms !important;
          transition-delay: 0.01ms !important;
          scroll-behavior: auto !important;
        }

        /* Custom scrollbar for activity list */
        .overflow-y-auto::-webkit-scrollbar {
          width: 6px;
        }

        .overflow-y-auto::-webkit-scrollbar-track {
          background: rgba(226, 232, 240, 0.5);
          border-radius: 3px;
        }

        .overflow-y-auto::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.5);
          border-radius: 3px;
        }

        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.8);
        }

        .dark .overflow-y-auto::-webkit-scrollbar-track {
          background: rgba(30, 41, 59, 0.5);
        }

        .dark .overflow-y-auto::-webkit-scrollbar-thumb {
          background: rgba(71, 85, 105, 0.5);
        }

        .dark .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: rgba(71, 85, 105, 0.8);
        }
      `}</style>
    </div>
  );
}