import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/* ============================================================
   TYPES
============================================================ */

type ToolCategory =
  | "number"
  | "currency"
  | "unit"
  | "data"
  | "electrical"
  | "health"
  | "specific";

interface ToolTab {
  id: ToolCategory;
  label: string;
  icon: React.ReactNode;
}

interface ConversionResult {
  value: string;
  label?: string;
  description?: string;
}


/* ============================================================
   API
============================================================ */

const API_BASE = (
  process.env.REACT_APP_API_URL ||
  "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");

/* ============================================================
   ✅ BACKGROUND HISTORY SAVER (Sirf ek baar hona chahiye)
============================================================ */
const saveToolHistory = async (endpoint: string, payload: any) => {
  try {
    const token = localStorage.getItem("access_token");
    if (!token) return; // Guest users don't save history
    
    fetch(`${API_BASE}/tools/${endpoint}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }).catch(err => console.warn("History save skipped:", err));
  } catch (error) {
    // Silent fail
  }
};

/* ============================================================
   SVG ICON SYSTEM
============================================================ */

const Svg = ({
  children,
  className = "w-5 h-5",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {children}
  </svg>
);

const TOOL_ICON_CONTENT: Record<ToolCategory, React.ReactNode> = {
  number: (
    <>
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </>
  ),
  currency: (
    <>
      <path d="M6 3h12" />
      <path d="M6 8h12" />
      <path d="m6 13 8.5 8" />
      <path d="M6 13h3" />
      <path d="M9 13c6.667 0 6.667-10 0-10" />
    </>
  ),
  unit: (
    <>
      <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" />
      <path d="m14.5 12.5 2-2" />
      <path d="m11.5 9.5 2-2" />
      <path d="m8.5 6.5 2-2" />
      <path d="m17.5 15.5 2-2" />
    </>
  ),
  data: (
    <>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14a9 3 0 0 0 18 0V5" />
      <path d="M3 12a9 3 0 0 0 18 0" />
    </>
  ),
  electrical: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  health: (
    <>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
    </>
  ),
  specific: (
    <>
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <line x1="8" x2="16" y1="6" y2="6" />
      <line x1="16" x2="16" y1="14" y2="18" />
      <path d="M16 10h.01" />
      <path d="M12 10h.01" />
      <path d="M8 10h.01" />
      <path d="M12 14h.01" />
      <path d="M8 14h.01" />
      <path d="M12 18h.01" />
      <path d="M8 18h.01" />
    </>
  ),
};

const ToolIcon = ({ id, className }: { id: ToolCategory; className?: string }) => (
  <Svg className={className}>{TOOL_ICON_CONTENT[id]}</Svg>
);

const Icons = {
  zap: <Svg className="w-4 h-4"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></Svg>,
  refresh: <Svg className="w-4 h-4"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></Svg>,
  check: <Svg className="w-4 h-4"><path d="M5 12l4 4L19 6" /></Svg>,
  checkBig: <Svg className="w-6 h-6"><path d="M5 12l4 4L19 6" /></Svg>,
  arrowRight: <Svg className="w-4 h-4"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></Svg>,
  reset: <Svg className="w-4 h-4"><path d="M3 12a9 9 0 1 0 2.64-6.36" /><path d="M3 3v6h6" /></Svg>,
  copy: <Svg className="w-4 h-4"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Svg>,
  layers: <Svg className="w-5 h-5"><path d="m12 2 8.5 4.5-8.5 4.5L3.5 6.5Z" /><path d="m3.5 12 8.5 4.5 8.5-4.5" /><path d="m3.5 17.5 8.5 4.5 8.5-4.5" /></Svg>,
  sparkle: <Svg className="w-5 h-5"><path d="M12 3l1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3z" /><path d="M19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15z" /></Svg>,
};

/* ============================================================
   TOOL TABS
============================================================ */

const TOOL_TABS: ToolTab[] = [
  { id: "number", label: "Number", icon: <ToolIcon id="number" /> },
  { id: "currency", label: "Currency", icon: <ToolIcon id="currency" /> },
  { id: "unit", label: "Unit", icon: <ToolIcon id="unit" /> },
  { id: "data", label: "Data", icon: <ToolIcon id="data" /> },
  { id: "electrical", label: "Electrical", icon: <ToolIcon id="electrical" /> },
  { id: "health", label: "Health", icon: <ToolIcon id="health" /> },
  { id: "specific", label: "Specific", icon: <ToolIcon id="specific" /> },
];

/* ============================================================
   NUMBER OPTIONS
============================================================ */

const NUMBER_BASES = [
  { value: "decimal", label: "Decimal" },
  { value: "binary", label: "Binary" },
  { value: "octal", label: "Octal" },
  { value: "hexadecimal", label: "Hexadecimal" },
];

/* ============================================================
   CURRENCY OPTIONS
============================================================ */

const CURRENCIES = [
  { value: "INR", label: "INR (India) ₹", rate: 1 },
  { value: "USD", label: "USD (United States) $", rate: 83.5 },
  { value: "EUR", label: "EUR (European Union) €", rate: 90.6 },
  { value: "GBP", label: "GBP (United Kingdom) £", rate: 106.3 },
  { value: "JPY", label: "JPY (Japan) ¥", rate: 0.56 },
  { value: "AED", label: "AED (UAE Dirham)", rate: 22.74 },
  { value: "CAD", label: "CAD (Canada)", rate: 61.2 },
  { value: "AUD", label: "AUD (Australia)", rate: 55.4 },
  { value: "SGD", label: "SGD (Singapore)", rate: 62.3 },
  { value: "CHF", label: "CHF (Switzerland)", rate: 93.8 },
  { value: "CNY", label: "CNY (China)", rate: 11.6 },
  { value: "HKD", label: "HKD (Hong Kong)", rate: 10.72 },
  { value: "NZD", label: "NZD (New Zealand)", rate: 50.1 },
  { value: "KRW", label: "KRW (South Korea)", rate: 0.061 },
  { value: "RUB", label: "RUB (Russia)", rate: 0.95 },
  { value: "SEK", label: "SEK (Sweden)", rate: 7.95 },
  { value: "NOK", label: "NOK (Norway)", rate: 7.85 },
  { value: "DKK", label: "DKK (Denmark)", rate: 12.13 },
  { value: "ZAR", label: "ZAR (South Africa)", rate: 4.62 },
  { value: "BRL", label: "BRL (Brazil)", rate: 15.6 },
  { value: "MXN", label: "MXN (Mexico)", rate: 4.45 },
  { value: "MYR", label: "MYR (Malaysia)", rate: 17.9 },
  { value: "THB", label: "THB (Thailand)", rate: 2.36 },
  { value: "PHP", label: "PHP (Philippines)", rate: 1.46 },
  { value: "IDR", label: "IDR (Indonesia)", rate: 0.0052 },
  { value: "SAR", label: "SAR (Saudi Arabia)", rate: 22.26 },
  { value: "TRY", label: "TRY (Turkey)", rate: 2.56 },
  { value: "PKR", label: "PKR (Pakistan)", rate: 0.3 },
  { value: "BDT", label: "BDT (Bangladesh)", rate: 0.7 },
  { value: "LKR", label: "LKR (Sri Lanka)", rate: 0.28 },
  { value: "NPR", label: "NPR (Nepal)", rate: 0.625 },
];

/* ============================================================
   UNIT OPTIONS
============================================================ */

const UNIT_TYPES = ["Length", "Weight", "Temperature", "Time", "Area", "Volume", "Speed"] as const;

const UNIT_OPTIONS: Record<
  string,
  { value: string; label: string; toBase: (v: number) => number; fromBase: (v: number) => number }[]
> = {
  Length: [
    { value: "meter", label: "Meter (m)", toBase: (v) => v, fromBase: (v) => v },
    { value: "kilometer", label: "Kilometer (km)", toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
    { value: "centimeter", label: "Centimeter (cm)", toBase: (v) => v / 100, fromBase: (v) => v * 100 },
    { value: "millimeter", label: "Millimeter (mm)", toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
    { value: "mile", label: "Mile (mi)", toBase: (v) => v * 1609.344, fromBase: (v) => v / 1609.344 },
    { value: "foot", label: "Foot (ft)", toBase: (v) => v * 0.3048, fromBase: (v) => v / 0.3048 },
    { value: "inch", label: "Inch (in)", toBase: (v) => v * 0.0254, fromBase: (v) => v / 0.0254 },
  ],
  Weight: [
    { value: "kilogram", label: "Kilogram (kg)", toBase: (v) => v, fromBase: (v) => v },
    { value: "gram", label: "Gram (g)", toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
    { value: "milligram", label: "Milligram (mg)", toBase: (v) => v / 1_000_000, fromBase: (v) => v * 1_000_000 },
    { value: "pound", label: "Pound (lb)", toBase: (v) => v * 0.45359237, fromBase: (v) => v / 0.45359237 },
    { value: "ounce", label: "Ounce (oz)", toBase: (v) => v * 0.0283495231, fromBase: (v) => v / 0.0283495231 },
  ],
  Temperature: [
    { value: "celsius", label: "Celsius (°C)", toBase: (v) => v, fromBase: (v) => v },
    { value: "fahrenheit", label: "Fahrenheit (°F)", toBase: (v) => (v - 32) * (5 / 9), fromBase: (v) => v * (9 / 5) + 32 },
    { value: "kelvin", label: "Kelvin (K)", toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
  ],
  Time: [
    { value: "second", label: "Second (s)", toBase: (v) => v, fromBase: (v) => v },
    { value: "minute", label: "Minute (min)", toBase: (v) => v * 60, fromBase: (v) => v / 60 },
    { value: "hour", label: "Hour (h)", toBase: (v) => v * 3600, fromBase: (v) => v / 3600 },
    { value: "day", label: "Day", toBase: (v) => v * 86400, fromBase: (v) => v / 86400 },
  ],
  Area: [
    { value: "square-meter", label: "Square Meter (m²)", toBase: (v) => v, fromBase: (v) => v },
    { value: "square-kilometer", label: "Square Kilometer (km²)", toBase: (v) => v * 1_000_000, fromBase: (v) => v / 1_000_000 },
    { value: "square-foot", label: "Square Foot (ft²)", toBase: (v) => v * 0.092903, fromBase: (v) => v / 0.092903 },
    { value: "acre", label: "Acre", toBase: (v) => v * 4046.8564224, fromBase: (v) => v / 4046.8564224 },
  ],
  Volume: [
    { value: "liter", label: "Liter (L)", toBase: (v) => v, fromBase: (v) => v },
    { value: "milliliter", label: "Milliliter (mL)", toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
    { value: "cubic-meter", label: "Cubic Meter (m³)", toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
    { value: "gallon", label: "Gallon (US)", toBase: (v) => v * 3.785411784, fromBase: (v) => v / 3.785411784 },
  ],
  Speed: [
    { value: "kmh", label: "Kilometer/hour (km/h)", toBase: (v) => v, fromBase: (v) => v },
    { value: "ms", label: "Meter/second (m/s)", toBase: (v) => v * 3.6, fromBase: (v) => v / 3.6 },
    { value: "mph", label: "Miles/hour (mph)", toBase: (v) => v * 1.609344, fromBase: (v) => v / 1.609344 },
    { value: "knot", label: "Knot", toBase: (v) => v * 1.852, fromBase: (v) => v / 1.852 },
  ],
};

/* ============================================================
   DATA / ELECTRICAL / HEALTH / SPECIFIC OPTIONS
============================================================ */

const DATA_UNITS = [
  { value: "bit", label: "Bit", bytes: 0.125 },
  { value: "byte", label: "Byte", bytes: 1 },
  { value: "kb", label: "Kilobyte (KB)", bytes: 1024 },
  { value: "mb", label: "Megabyte (MB)", bytes: 1024 ** 2 },
  { value: "gb", label: "Gigabyte (GB)", bytes: 1024 ** 3 },
  { value: "tb", label: "Terabyte (TB)", bytes: 1024 ** 4 },
];

const ELECTRICAL_TOOLS = [
  { value: "ohms-law", label: "Ohm's Law (V = I × R)" },
  { value: "power", label: "Power (P = V × I)" },
  { value: "energy", label: "Energy (kWh)" },
  { value: "resistance-series", label: "Series Resistance" },
  { value: "resistance-parallel", label: "Parallel Resistance" },
];

const HEALTH_TOOLS = [
  { value: "bmi", label: "BMI (Body Mass Index)" },
  { value: "bmr", label: "BMR (Basal Metabolic Rate)" },
  { value: "calories", label: "Daily Calories" },
  { value: "heart-rate", label: "Heart Rate" },
  { value: "blood-pressure", label: "Blood Pressure" },
  { value: "body-fat", label: "Body Fat" },
];

const SPECIFIC_TOOLS = [
  { value: "percentage", label: "Percentage" },
  { value: "discount", label: "Discount" },
  { value: "average", label: "Average" },
  { value: "age", label: "Age" },
  { value: "date-difference", label: "Date Difference" },
  { value: "tip", label: "Tip Calculator" },
];

/* ============================================================
   HERO DECORATIVE CARDS
============================================================ */

const HERO_CARDS: Record<ToolCategory, string[]> = {
  number: ["10", "1010", "255", "A"],
  currency: ["₹", "$", "€", "¥"],
  unit: ["km", "kg", "°C", "ft"],
  data: ["KB", "MB", "GB", "TB"],
  electrical: ["V", "A", "Ω", "W"],
  health: ["BMI", "BPM", "kcal", "%"],
  specific: ["%", "÷", "±", "#"],
};

/* ============================================================
   HELPERS
============================================================ */

const formatNumber = (value: number, decimals = 8): string => {
  if (!Number.isFinite(value)) return "Invalid";
  return Number(value.toFixed(decimals)).toLocaleString("en-IN", { maximumFractionDigits: decimals });
};

const getNumberBase = (base: string): number => {
  switch (base) {
    case "binary": return 2;
    case "octal": return 8;
    case "hexadecimal": return 16;
    default: return 10;
  }
};

const parseNumberInput = (value: string, base: number): number | null => {
  let clean = value.trim().toLowerCase();
  if (!clean) return null;
  if (base === 16 && clean.startsWith("0x")) clean = clean.slice(2);
  if (base === 2 && clean.startsWith("0b")) clean = clean.slice(2);
  if (base === 8 && clean.startsWith("0o")) clean = clean.slice(2);
  if (!clean) return null;

  const patterns: Record<number, RegExp> = {
    2: /^[01]+$/,
    8: /^[0-7]+$/,
    10: /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/,
    16: /^[0-9a-f]+$/,
  };
  if (!patterns[base].test(clean)) return null;

  if (base === 10) {
    const n = Number(clean);
    return Number.isFinite(n) ? n : null;
  }
  const parsed = parseInt(clean, base);
  return Number.isNaN(parsed) ? null : parsed;
};

const formatBaseValue = (value: number, base: number): string => {
  if (base === 10) return value.toString();
  const sign = value < 0 ? "-" : "";
  return sign + Math.abs(value).toString(base).toUpperCase();
};

/* ============================================================
   COMPONENT
============================================================ */

const ToolsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ToolCategory>("number");

  /* ✅ LIVE CURRENCY RATES */
  const [liveRates, setLiveRates] = useState<Record<string, number> | null>(null);
  const [ratesInfo, setRatesInfo] = useState<{ source: string; updatedAt: string } | null>(null);

  /* NUMBER */
  const [numberFrom, setNumberFrom] = useState("decimal");
  const [numberTo, setNumberTo] = useState("binary");
  const [numberValue, setNumberValue] = useState("");
  const [numberResult, setNumberResult] = useState<ConversionResult | null>(null);

  /* CURRENCY */
  const [currencyFrom, setCurrencyFrom] = useState("INR");
  const [currencyTo, setCurrencyTo] = useState("USD");
  const [currencyValue, setCurrencyValue] = useState("");
  const [currencyResult, setCurrencyResult] = useState<ConversionResult | null>(null);

  /* UNIT */
  const [unitType, setUnitType] = useState("Length");
  const [unitFrom, setUnitFrom] = useState("meter");
  const [unitTo, setUnitTo] = useState("kilometer");
  const [unitValue, setUnitValue] = useState("");
  const [unitResult, setUnitResult] = useState<ConversionResult | null>(null);

  /* DATA */
  const [dataFrom, setDataFrom] = useState("byte");
  const [dataTo, setDataTo] = useState("mb");
  const [dataValue, setDataValue] = useState("");
  const [dataResult, setDataResult] = useState<ConversionResult | null>(null);

  /* ELECTRICAL */
  const [electricalTool, setElectricalTool] = useState("ohms-law");
  const [voltage, setVoltage] = useState("");
  const [current, setCurrent] = useState("");
  const [resistance, setResistance] = useState("");
  const [hours, setHours] = useState("");
  const [r1, setR1] = useState("");
  const [r2, setR2] = useState("");
  const [r3, setR3] = useState("");
  const [electricalResult, setElectricalResult] = useState<ConversionResult | null>(null);

  /* HEALTH */
  const [healthTool, setHealthTool] = useState("bmi");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("male");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [healthResult, setHealthResult] = useState<ConversionResult | null>(null);

  /* SPECIFIC */
  const [specificTool, setSpecificTool] = useState("percentage");
  const [specificA, setSpecificA] = useState("");
  const [specificB, setSpecificB] = useState("");
  const [averageInput, setAverageInput] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [specificResult, setSpecificResult] = useState<ConversionResult | null>(null);

  /* ==========================================================
     ✅ LIVE RATES FETCH
  ========================================================== */

  useEffect(() => {
    let cancelled = false;
    const loadRates = async () => {
      try {
        const res = await fetch(`${API_BASE}/tools/currency-rates/`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.success && data?.rates) {
          setLiveRates(data.rates);
          setRatesInfo({ source: data.source || "live", updatedAt: data.updated_at || "" });
        }
      } catch {
        // backend offline → static rates use honge
      }
    };
    loadRates();
    return () => { cancelled = true; };
  }, []);

  const getCurrencyRate = (code: string): number => {
    const live = liveRates?.[code];
    if (typeof live === "number" && live > 0) return live;
    return CURRENCIES.find((c) => c.value === code)?.rate ?? 1;
  };

  /* ==========================================================
     ACTIVE TAB SLIDER
  ========================================================== */

  const navRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Partial<Record<ToolCategory, HTMLButtonElement | null>>>({});
  const [sliderStyle, setSliderStyle] = useState({ left: 0, width: 0, opacity: 0 });

  const updateSlider = useCallback(() => {
    const container = navRef.current;
    const activeButton = tabRefs.current[activeTab];
    if (!container || !activeButton) return;
    const containerRect = container.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    setSliderStyle({
      left: buttonRect.left - containerRect.left + container.scrollLeft,
      width: buttonRect.width,
      opacity: 1,
    });
  }, [activeTab]);

  useLayoutEffect(() => { updateSlider(); }, [updateSlider]);

  useEffect(() => {
    const handleResize = () => updateSlider();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateSlider]);

  const handleCategoryChange = (category: ToolCategory) => {
    setActiveTab(category);
    requestAnimationFrame(() => {
      tabRefs.current[category]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    });
  };

  /* ==========================================================
     UNIT CHANGE GUARD
  ========================================================== */

  useEffect(() => {
    const options = UNIT_OPTIONS[unitType];
    if (!options?.length) return;
    if (!options.some((i) => i.value === unitFrom)) setUnitFrom(options[0].value);
    if (!options.some((i) => i.value === unitTo)) setUnitTo(options[1]?.value || options[0].value);
    setUnitResult(null);
  }, [unitType, unitFrom, unitTo]);

  /* ==========================================================
     ✅ NUMBER CONVERT (WITH HISTORY)
  ========================================================== */

  const convertNumber = () => {
    const fromBase = getNumberBase(numberFrom);
    const toBase = getNumberBase(numberTo);

    if (!numberValue.trim()) {
      setNumberResult({ value: "Enter a number", description: "Please type a value to convert." });
      return;
    }

    let parsed = parseNumberInput(numberValue, fromBase);
    let interpretedAs = numberFrom;

    if (parsed === null && fromBase !== 10) {
      const asDecimal = parseNumberInput(numberValue, 10);
      if (asDecimal !== null) {
        parsed = asDecimal;
        interpretedAs = "decimal";
      }
    }

    if (parsed === null) {
      setNumberResult({
        value: "Invalid number",
        description: `Please enter a valid ${numberFrom} value.`,
      });
      return;
    }

    const converted = formatBaseValue(parsed, toBase);
    const fromLabel = NUMBER_BASES.find((i) => i.value === interpretedAs)?.label || interpretedAs;
    const toLabel = NUMBER_BASES.find((i) => i.value === numberTo)?.label || numberTo;

    setNumberResult({
      value: converted,
      label: toLabel,
      description: interpretedAs !== numberFrom ? `Value interpreted as ${fromLabel} → ${toLabel}` : `${fromLabel} → ${toLabel}`,
    });

    // ✅ SEND TO BACKEND FOR HISTORY
    saveToolHistory("number", { 
      value: numberValue, 
      from_base: numberFrom, 
      to_base: numberTo 
    });
  };

  /* ==========================================================
     ✅ CURRENCY CONVERT (WITH HISTORY)
  ========================================================== */

  const convertCurrency = () => {
    const amount = Number(currencyValue);
    if (!currencyValue.trim() || !Number.isFinite(amount)) {
      setCurrencyResult({ value: "Invalid amount" });
      return;
    }

    const from = CURRENCIES.find((i) => i.value === currencyFrom);
    const to = CURRENCIES.find((i) => i.value === currencyTo);
    if (!from || !to) return;

    const fromRate = getCurrencyRate(from.value);
    const toRate = getCurrencyRate(to.value);
    const converted = (amount * fromRate) / toRate;

    setCurrencyResult({
      value: `${formatNumber(converted, 4)} ${to.value}`,
      label: to.label,
      description: `1 ${from.value} = ${formatNumber(fromRate / toRate, 4)} ${to.value}${liveRates ? " · live rate" : ""}`,
    });

    // ✅ SEND TO BACKEND FOR HISTORY
    saveToolHistory("currency", { 
      amount: currencyValue, 
      from_currency: currencyFrom, 
      to_currency: currencyTo 
    });
  };

  /* ==========================================================
     ✅ UNIT CONVERT (WITH HISTORY)
  ========================================================== */

  const convertUnit = () => {
    const value = Number(unitValue);
    if (!unitValue.trim() || !Number.isFinite(value)) { setUnitResult({ value: "Invalid value" }); return; }
    const options = UNIT_OPTIONS[unitType];
    const from = options.find((i) => i.value === unitFrom);
    const to = options.find((i) => i.value === unitTo);
    if (!from || !to) return;
    const converted = to.fromBase(from.toBase(value));
    setUnitResult({ value: formatNumber(converted), label: to.label, description: `${formatNumber(value)} ${from.label} → ${formatNumber(converted)} ${to.label}` });

    // ✅ SEND TO BACKEND FOR HISTORY
    saveToolHistory("unit", { 
      category: unitType.toLowerCase(), 
      value: unitValue, 
      from_unit: unitFrom, 
      to_unit: unitTo 
    });
  };

  const convertData = () => {
    const value = Number(dataValue);
    if (!dataValue.trim() || !Number.isFinite(value)) { setDataResult({ value: "Invalid value" }); return; }
    const from = DATA_UNITS.find((i) => i.value === dataFrom);
    const to = DATA_UNITS.find((i) => i.value === dataTo);
    if (!from || !to) return;
    const result = (value * from.bytes) / to.bytes;
    setDataResult({ value: formatNumber(result, 6), label: to.label, description: `${formatNumber(value)} ${from.label} → ${formatNumber(result, 6)} ${to.label}` });

    // ✅ SEND TO BACKEND FOR HISTORY
    saveToolHistory("data", { 
      value: dataValue, 
      from_unit: dataFrom, 
      to_unit: dataTo 
    });
  };

  /* ==========================================================
     ✅ ELECTRICAL (WITH HISTORY)
  ========================================================== */

  const calculateElectrical = () => {
    const V = Number(voltage);
    const I = Number(current);
    const R = Number(resistance);
    const H = hours.trim() ? Number(hours) : 1;

    switch (electricalTool) {
      case "ohms-law": {
        const hasV = voltage.trim() !== "" && Number.isFinite(V);
        const hasI = current.trim() !== "" && Number.isFinite(I);
        const hasR = resistance.trim() !== "" && Number.isFinite(R);
        if (hasV && hasI && I !== 0) { 
          saveToolHistory("electrical", { operation: "ohms_law", voltage, current, resistance });
          setElectricalResult({ value: `${formatNumber(V / I, 4)} Ω`, label: "Resistance", description: "R = V ÷ I" }); return; 
        }
        if (hasV && hasR && R !== 0) { 
          saveToolHistory("electrical", { operation: "ohms_law", voltage, current, resistance });
          setElectricalResult({ value: `${formatNumber(V / R, 4)} A`, label: "Current", description: "I = V ÷ R" }); return; 
        }
        if (hasI && hasR) { 
          saveToolHistory("electrical", { operation: "ohms_law", voltage, current, resistance });
          setElectricalResult({ value: `${formatNumber(I * R, 4)} V`, label: "Voltage", description: "V = I × R" }); return; 
        }
        break;
      }
      case "power": {
        if (voltage.trim() && current.trim() && Number.isFinite(V) && Number.isFinite(I)) { 
          saveToolHistory("electrical", { operation: "power", voltage, current });
          setElectricalResult({ value: `${formatNumber(V * I, 4)} W`, label: "Power", description: "P = V × I" }); return; 
        }
        break;
      }
      case "energy": {
        if (voltage.trim() && current.trim() && Number.isFinite(V) && Number.isFinite(I) && Number.isFinite(H)) {
          const watts = V * I;
          saveToolHistory("electrical", { operation: "power", voltage, current, hours: H });
          setElectricalResult({ value: `${formatNumber((watts * H) / 1000, 4)} kWh`, label: `Energy for ${formatNumber(H, 2)} hour(s)`, description: `Power: ${formatNumber(watts, 2)} W` });
          return;
        }
        break;
      }
      case "resistance-series": {
        const values = [r1, r2, r3].filter((x) => x.trim() !== "").map(Number).filter((x) => Number.isFinite(x));
        if (values.length >= 2) { 
          saveToolHistory("electrical", { operation: "resistance", resistances: [r1, r2, r3].filter(Boolean), connection: "series" });
          setElectricalResult({ value: `${formatNumber(values.reduce((s, x) => s + x, 0), 4)} Ω`, label: "Series resistance", description: "R = R1 + R2 + R3" }); return; 
        }
        break;
      }
      case "resistance-parallel": {
        const values = [r1, r2, r3].filter((x) => x.trim() !== "").map(Number).filter((x) => Number.isFinite(x) && x > 0);
        if (values.length >= 2) { 
          saveToolHistory("electrical", { operation: "resistance", resistances: [r1, r2, r3].filter(Boolean), connection: "parallel" });
          setElectricalResult({ value: `${formatNumber(1 / values.reduce((s, x) => s + 1 / x, 0), 4)} Ω`, label: "Parallel resistance", description: "1/R = 1/R1 + 1/R2 + 1/R3" }); return; 
        }
        break;
      }
    }
    setElectricalResult({ value: "Enter valid values", description: "Fill the required fields for the selected tool." });
  };

  /* ==========================================================
     ✅ HEALTH (WITH HISTORY)
  ========================================================== */

  const calculateHealth = () => {
    const W = Number(weight);
    const Hcm = Number(height);
    const A = Number(age);
    const SYS = Number(systolic);
    const DIA = Number(diastolic);

    if (healthTool === "bmi") {
      if (!weight.trim() || !height.trim() || !W || !Hcm) { setHealthResult({ value: "Enter weight and height" }); return; }
      const H = Hcm / 100;
      const bmi = W / (H * H);
      let statusText = "";
      if (bmi < 18.5) statusText = "Underweight";
      else if (bmi < 25) statusText = "Normal range";
      else if (bmi < 30) statusText = "Overweight";
      else statusText = "Obesity range";
      
      saveToolHistory("health", { calculator: "bmi", weight_kg: weight, height_cm: height });
      setHealthResult({ value: formatNumber(bmi, 2), label: "BMI", description: statusText });
      return;
    }

    if (healthTool === "bmr" || healthTool === "calories" || healthTool === "body-fat") {
      if (!weight.trim() || !height.trim() || !age.trim() || !W || !Hcm || !A) { setHealthResult({ value: "Enter weight, height and age" }); return; }
      if (healthTool === "body-fat") {
        const bmi = W / (Hcm / 100) ** 2;
        const bodyFat = gender === "male" ? 1.2 * bmi + 0.23 * A - 16.2 : 1.2 * bmi + 0.23 * A - 5.4;
        saveToolHistory("health", { calculator: "body_fat", weight_kg: weight, height_cm: height, age, gender });
        setHealthResult({ value: `${formatNumber(bodyFat, 2)}%`, label: "Estimated body fat", description: "This is only a general estimate." });
        return;
      }
      const bmr = gender === "male" ? 10 * W + 6.25 * Hcm - 5 * A + 5 : 10 * W + 6.25 * Hcm - 5 * A - 161;
      if (healthTool === "bmr") { 
        saveToolHistory("health", { calculator: "bmr", weight_kg: weight, height_cm: height, age, gender });
        setHealthResult({ value: `${formatNumber(bmr, 0)} kcal/day`, label: "Estimated BMR" }); return; 
      }
      saveToolHistory("health", { calculator: "calories", weight_kg: weight, height_cm: height, age, gender, bmr, activity_level: "moderate" });
      setHealthResult({ value: `${formatNumber(bmr * 1.55, 0)} kcal/day`, label: "Estimated maintenance", description: "Based on a moderate activity estimate." });
      return;
    }

    if (healthTool === "heart-rate") {
      if (!age.trim() || !A) { setHealthResult({ value: "Enter age" }); return; }
      const max = 220 - A;
      saveToolHistory("health", { calculator: "bmr", weight_kg: "70", height_cm: "170", age, gender });
      setHealthResult({ value: `${max} BPM`, label: "Estimated maximum heart rate", description: `Target zone: ${Math.round(max * 0.5)}–${Math.round(max * 0.85)} BPM` });
      return;
    }

    if (healthTool === "blood-pressure") {
      if (!systolic.trim() || !diastolic.trim() || !Number.isFinite(SYS) || !Number.isFinite(DIA)) { setHealthResult({ value: "Enter systolic and diastolic values" }); return; }
      let category = "";
      if (SYS > 180 || DIA > 120) category = "Hypertensive Crisis — seek medical help";
      else if (SYS >= 140 || DIA >= 90) category = "Stage 2 Hypertension";
      else if (SYS >= 130 || DIA >= 80) category = "Stage 1 Hypertension";
      else if (SYS >= 120 && DIA < 80) category = "Elevated";
      else if (SYS < 90 || DIA < 60) category = "Low (Hypotension)";
      else category = "Normal";
      saveToolHistory("health", { calculator: "bmi", weight_kg: "70", height_cm: "170" });
      setHealthResult({ value: `${SYS} / ${DIA} mmHg`, label: category, description: "General reference — consult a doctor for advice." });
      return;
    }
  };

  /* ==========================================================
     ✅ SPECIFIC (WITH HISTORY)
  ========================================================== */

  const calculateSpecific = () => {
    const A = Number(specificA);
    const B = Number(specificB);

    if (specificTool === "percentage") {
      if (!Number.isFinite(A) || !Number.isFinite(B) || B === 0) { setSpecificResult({ value: "Enter valid values" }); return; }
      saveToolHistory("specific", { calculator: "percentage", operation: "find_percentage", value1: specificA, value2: specificB });
      setSpecificResult({ value: `${formatNumber((A / B) * 100, 2)}%`, label: "Percentage", description: `${formatNumber(A)} is what % of ${formatNumber(B)}` });
      return;
    }
    if (specificTool === "discount") {
      if (!Number.isFinite(A) || !Number.isFinite(B)) { setSpecificResult({ value: "Enter valid price and discount" }); return; }
      const savings = (A * B) / 100;
      saveToolHistory("specific", { calculator: "percentage", operation: "find_value", value1: specificB, value2: specificA });
      setSpecificResult({ value: formatNumber(A - savings, 2), label: "Final price", description: `You save ${formatNumber(savings, 2)}` });
      return;
    }
    if (specificTool === "average") {
      const nums = averageInput.split(/[,\s]+/).filter(Boolean).map(Number).filter(Number.isFinite);
      if (!nums.length) { setSpecificResult({ value: "Enter numbers separated by commas" }); return; }
      const sum = nums.reduce((s, x) => s + x, 0);
      saveToolHistory("specific", { calculator: "percentage", operation: "find_percentage", value1: sum, value2: nums.length });
      setSpecificResult({ value: formatNumber(sum / nums.length, 4), label: "Average", description: `${nums.length} values, sum = ${formatNumber(sum, 4)}` });
      return;
    }
    if (specificTool === "age") {
      if (!dateFrom) { setSpecificResult({ value: "Select date of birth" }); return; }
      const dob = new Date(dateFrom);
      const today = new Date();
      if (Number.isNaN(dob.getTime()) || dob > today) { setSpecificResult({ value: "Invalid date" }); return; }
      let y = today.getFullYear() - dob.getFullYear();
      let m = today.getMonth() - dob.getMonth();
      let d = today.getDate() - dob.getDate();
      if (d < 0) { m -= 1; d += new Date(today.getFullYear(), today.getMonth(), 0).getDate(); }
      if (m < 0) { y -= 1; m += 12; }
      saveToolHistory("specific-calculator", { calculator: "age", birth_date: dateFrom });
      setSpecificResult({ value: `${y} yrs ${m} mo ${d} days`, label: "Age", description: `Born: ${dob.toLocaleDateString("en-IN")}` });
      return;
    }
    if (specificTool === "date-difference") {
      if (!dateFrom || !dateTo) { setSpecificResult({ value: "Select both dates" }); return; }
      const d1 = new Date(dateFrom);
      const d2 = new Date(dateTo);
      if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) { setSpecificResult({ value: "Invalid dates" }); return; }
      const days = Math.round(Math.abs(d2.getTime() - d1.getTime()) / 86400000);
      saveToolHistory("specific-calculator", { calculator: "age", birth_date: dateFrom });
      setSpecificResult({ value: `${days} days`, label: "Difference", description: `≈ ${formatNumber(days / 7, 1)} weeks · ≈ ${formatNumber(days / 365.25, 2)} years` });
      return;
    }
    if (specificTool === "tip") {
      if (!Number.isFinite(A) || !Number.isFinite(B)) { setSpecificResult({ value: "Enter bill and tip percentage" }); return; }
      const tip = (A * B) / 100;
      saveToolHistory("specific-calculator", { calculator: "tip", bill_amount: specificA, tip_percentage: specificB });
      setSpecificResult({ value: formatNumber(A + tip, 2), label: "Total bill", description: `Tip: ${formatNumber(tip, 2)}` });
      return;
    }
    setSpecificResult({ value: "Use the selected tool" });
  };

  /* ==========================================================
     RESET
  ========================================================== */

  const resetAll = () => {
    setNumberValue(""); setNumberResult(null);
    setCurrencyValue(""); setCurrencyResult(null);
    setUnitValue(""); setUnitResult(null);
    setDataValue(""); setDataResult(null);
    setVoltage(""); setCurrent(""); setResistance(""); setHours(""); setR1(""); setR2(""); setR3(""); setElectricalResult(null);
    setWeight(""); setHeight(""); setAge(""); setSystolic(""); setDiastolic(""); setHealthResult(null);
    setSpecificA(""); setSpecificB(""); setAverageInput(""); setDateFrom(""); setDateTo(""); setSpecificResult(null);
  };

  /* ==========================================================
     ACTIVE RESULT + STYLES
  ========================================================== */

  const activeResult = useMemo(() => {
    switch (activeTab) {
      case "number": return numberResult;
      case "currency": return currencyResult;
      case "unit": return unitResult;
      case "data": return dataResult;
      case "electrical": return electricalResult;
      case "health": return healthResult;
      case "specific": return specificResult;
      default: return null;
    }
  }, [activeTab, numberResult, currencyResult, unitResult, dataResult, electricalResult, healthResult, specificResult]);

  const activeTool = TOOL_TABS.find((i) => i.id === activeTab);

  const inputClass = "w-full h-14 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 text-base font-medium text-slate-800 dark:text-slate-100 outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400";
  const selectClass = "w-full h-14 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 text-base font-medium text-slate-800 dark:text-slate-100 outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10";
  const primaryBtn = "inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-8 py-4 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl";
  const secondaryBtn = "inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-7 py-4 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900";
  const labelClass = "mb-2 block text-sm font-semibold text-slate-600 dark:text-slate-300";

  /* ==========================================================
     UI
  ========================================================== */

  return (
    <div className="w-full max-w-[1500px] mx-auto pb-10">
      {/* CATEGORY NAVIGATION */}
      <div ref={navRef} className="relative mx-auto w-fit max-w-full overflow-x-auto rounded-[22px] border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-[0_12px_40px_-25px_rgba(15,23,42,0.35)] p-1.5 scrollbar-hide">
        <div className="absolute top-1.5 bottom-1.5 rounded-[17px] bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_10px_25px_-12px_rgba(37,99,235,0.75)] pointer-events-none transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ left: sliderStyle.left, width: sliderStyle.width, opacity: sliderStyle.opacity }} />
        <div className="relative flex w-max items-center gap-1">
          {TOOL_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} ref={(el) => { tabRefs.current[tab.id] = el; }} type="button" onClick={() => handleCategoryChange(tab.id)}
                className={`relative z-10 flex h-12 items-center justify-center gap-2.5 rounded-[17px] px-5 text-sm md:text-base font-semibold whitespace-nowrap transition-colors duration-300 ${active ? "text-white" : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"}`}>
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* HERO */}
      <section className="relative mt-7 overflow-hidden rounded-[30px] border border-indigo-100/80 dark:border-indigo-900/50 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 dark:from-slate-900 dark:via-indigo-950 dark:to-purple-950 px-8 py-10 md:px-12 md:py-12">
        <div className="absolute inset-0 opacity-50">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_25%,rgba(255,255,255,0.9)_0,transparent_30%),radial-gradient(circle_at_85%_40%,rgba(255,255,255,0.75)_0,transparent_32%)]" />
        </div>

        <div className="absolute right-8 top-8 hidden md:block">
          <div className="relative h-56 w-64 hero-cards-anim" key={activeTab}>
            <div className="absolute left-0 top-16 flex h-28 w-28 rotate-[-4deg] items-center justify-center rounded-3xl bg-blue-600 text-4xl font-bold text-white shadow-xl">{HERO_CARDS[activeTab][0]}</div>
            <div className="absolute right-6 top-0 flex h-24 w-24 items-center justify-center rounded-3xl bg-white/80 text-2xl font-bold text-slate-700 shadow-lg backdrop-blur">{HERO_CARDS[activeTab][1]}</div>
            <div className="absolute right-0 top-24 flex h-24 w-24 items-center justify-center rounded-3xl bg-purple-300/80 text-2xl font-bold text-white shadow-lg">{HERO_CARDS[activeTab][2]}</div>
            <div className="absolute bottom-0 right-20 flex h-20 w-20 items-center justify-center rounded-3xl bg-purple-300/80 text-2xl font-bold text-white shadow-lg">{HERO_CARDS[activeTab][3]}</div>
          </div>
        </div>

        <div className="relative z-10 max-w-3xl">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-xl">
              <ToolIcon id={activeTab} className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">Smart tools</p>
              <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl">
                {activeTool?.label === "Number" ? "Smart calculation tools." : `${activeTool?.label} tools.`}
              </h1>
            </div>
          </div>
          <p className="max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300 md:text-xl">
            Convert, calculate and simplify everyday values with fast, easy-to-use tools built directly into quill.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-full bg-white/80 px-5 py-3 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur">{Icons.zap} Fast & Accurate</div>
            <div className="flex items-center gap-2 rounded-full bg-white/80 px-5 py-3 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur">{Icons.refresh} Multiple Formats</div>
            <div className="flex items-center gap-2 rounded-full bg-white/80 px-5 py-3 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur">{Icons.check} Easy to Use</div>
          </div>
        </div>
      </section>

      {/* MAIN TOOL CARD */}
      <section className="mt-7 rounded-[30px] border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)] md:p-9">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-lg">
            <ToolIcon id={activeTab} className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{activeTool?.label} Converter</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Select conversion type and enter your value</p>
          </div>
        </div>

        {/* NUMBER */}
        {activeTab === "number" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr_1fr]">
            <div><label className={labelClass}>From</label>
              <select value={numberFrom} onChange={(e) => { setNumberFrom(e.target.value); setNumberResult(null); }} className={selectClass}>
                {NUMBER_BASES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
            <div><label className={labelClass}>Value</label>
              <input type="text" value={numberValue} onChange={(e) => setNumberValue(e.target.value)} placeholder="Enter number..." className={inputClass} autoComplete="off" />
            </div>
            <div><label className={labelClass}>To</label>
              <select value={numberTo} onChange={(e) => { setNumberTo(e.target.value); setNumberResult(null); }} className={selectClass}>
                {NUMBER_BASES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
            <div className="flex gap-3 lg:col-span-3">
              <button type="button" onClick={convertNumber} className={primaryBtn}>Convert {Icons.arrowRight}</button>
              <button type="button" onClick={resetAll} className={secondaryBtn}>{Icons.reset} Reset</button>
            </div>
          </div>
        )}

        {/* CURRENCY */}
        {activeTab === "currency" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr_1fr]">
            <div><label className={labelClass}>From</label>
              <select value={currencyFrom} onChange={(e) => { setCurrencyFrom(e.target.value); setCurrencyResult(null); }} className={selectClass}>
                {CURRENCIES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
            <div><label className={labelClass}>Amount</label>
              <input type="text" inputMode="decimal" value={currencyValue} onChange={(e) => setCurrencyValue(e.target.value)} placeholder="Enter amount..." className={inputClass} autoComplete="off" />
            </div>
            <div><label className={labelClass}>To</label>
              <select value={currencyTo} onChange={(e) => { setCurrencyTo(e.target.value); setCurrencyResult(null); }} className={selectClass}>
                {CURRENCIES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 lg:col-span-3">
              {liveRates ? Icons.check : Icons.refresh}
              {liveRates ? `Live rates active · source: ${ratesInfo?.source} · updated: ${ratesInfo?.updatedAt}` : "Using standard rates (live rates unavailable)"}
            </div>
            <div className="flex gap-3 lg:col-span-3">
              <button type="button" onClick={convertCurrency} className={primaryBtn}>Convert {Icons.arrowRight}</button>
              <button type="button" onClick={resetAll} className={secondaryBtn}>{Icons.reset} Reset</button>
            </div>
          </div>
        )}

        {/* UNIT */}
        {activeTab === "unit" && (
          <div className="space-y-5">
            <div className="w-full md:w-[45%]"><label className={labelClass}>Category</label>
              <select value={unitType} onChange={(e) => { setUnitType(e.target.value); setUnitResult(null); }} className={selectClass}>
                {UNIT_TYPES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr_1fr]">
              <select value={unitFrom} onChange={(e) => { setUnitFrom(e.target.value); setUnitResult(null); }} className={selectClass}>
                {UNIT_OPTIONS[unitType]?.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
              <input type="text" inputMode="decimal" value={unitValue} onChange={(e) => setUnitValue(e.target.value)} placeholder="Enter value..." className={inputClass} autoComplete="off" />
              <select value={unitTo} onChange={(e) => { setUnitTo(e.target.value); setUnitResult(null); }} className={selectClass}>
                {UNIT_OPTIONS[unitType]?.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={convertUnit} className={primaryBtn}>Convert {Icons.arrowRight}</button>
              <button type="button" onClick={resetAll} className={secondaryBtn}>{Icons.reset} Reset</button>
            </div>
          </div>
        )}

        {/* DATA */}
        {activeTab === "data" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr_1fr]">
            <select value={dataFrom} onChange={(e) => { setDataFrom(e.target.value); setDataResult(null); }} className={selectClass}>
              {DATA_UNITS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
            </select>
            <input type="text" inputMode="decimal" value={dataValue} onChange={(e) => setDataValue(e.target.value)} placeholder="Enter value..." className={inputClass} autoComplete="off" />
            <select value={dataTo} onChange={(e) => { setDataTo(e.target.value); setDataResult(null); }} className={selectClass}>
              {DATA_UNITS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
            </select>
            <div className="flex gap-3 lg:col-span-3">
              <button type="button" onClick={convertData} className={primaryBtn}>Convert {Icons.arrowRight}</button>
              <button type="button" onClick={resetAll} className={secondaryBtn}>{Icons.reset} Reset</button>
            </div>
          </div>
        )}

        {/* ELECTRICAL */}
        {activeTab === "electrical" && (
          <div className="space-y-5">
            <div className="w-full md:w-[45%]"><label className={labelClass}>Tool</label>
              <select value={electricalTool} onChange={(e) => { setElectricalTool(e.target.value); setElectricalResult(null); }} className={selectClass}>
                {ELECTRICAL_TOOLS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>

            {electricalTool === "ohms-law" && (
              <div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                  <input type="text" inputMode="decimal" value={voltage} onChange={(e) => setVoltage(e.target.value)} placeholder="Voltage (V)" className={inputClass} autoComplete="off" />
                  <input type="text" inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Current (A)" className={inputClass} autoComplete="off" />
                  <input type="text" inputMode="decimal" value={resistance} onChange={(e) => setResistance(e.target.value)} placeholder="Resistance (Ω)" className={inputClass} autoComplete="off" />
                </div>
                <p className="mt-2 text-xs text-slate-400">Enter any two values — the third will be calculated.</p>
              </div>
            )}

            {electricalTool === "power" && (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <input type="text" inputMode="decimal" value={voltage} onChange={(e) => setVoltage(e.target.value)} placeholder="Voltage (V)" className={inputClass} autoComplete="off" />
                <input type="text" inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Current (A)" className={inputClass} autoComplete="off" />
              </div>
            )}

            {electricalTool === "energy" && (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <input type="text" inputMode="decimal" value={voltage} onChange={(e) => setVoltage(e.target.value)} placeholder="Voltage (V)" className={inputClass} autoComplete="off" />
                <input type="text" inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Current (A)" className={inputClass} autoComplete="off" />
                <input type="text" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Hours (default 1)" className={inputClass} autoComplete="off" />
              </div>
            )}

            {(electricalTool === "resistance-series" || electricalTool === "resistance-parallel") && (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <input type="text" inputMode="decimal" value={r1} onChange={(e) => setR1(e.target.value)} placeholder="R1 (Ω)" className={inputClass} autoComplete="off" />
                <input type="text" inputMode="decimal" value={r2} onChange={(e) => setR2(e.target.value)} placeholder="R2 (Ω)" className={inputClass} autoComplete="off" />
                <input type="text" inputMode="decimal" value={r3} onChange={(e) => setR3(e.target.value)} placeholder="R3 (Ω) — optional" className={inputClass} autoComplete="off" />
              </div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={calculateElectrical} className={primaryBtn}>Calculate {Icons.arrowRight}</button>
              <button type="button" onClick={resetAll} className={secondaryBtn}>{Icons.reset} Reset</button>
            </div>
          </div>
        )}

        {/* HEALTH */}
        {activeTab === "health" && (
          <div className="space-y-5">
            <div className="w-full md:w-[45%]"><label className={labelClass}>Tool</label>
              <select value={healthTool} onChange={(e) => { setHealthTool(e.target.value); setHealthResult(null); }} className={selectClass}>
                {HEALTH_TOOLS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>

            {healthTool === "bmi" && (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <input type="text" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Weight (kg)" className={inputClass} autoComplete="off" />
                <input type="text" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="Height (cm)" className={inputClass} autoComplete="off" />
              </div>
            )}

            {(healthTool === "bmr" || healthTool === "calories" || healthTool === "body-fat") && (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <input type="text" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Weight (kg)" className={inputClass} autoComplete="off" />
                <input type="text" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="Height (cm)" className={inputClass} autoComplete="off" />
                <input type="text" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" className={inputClass} autoComplete="off" />
                <select value={gender} onChange={(e) => setGender(e.target.value)} className={selectClass}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            )}

            {healthTool === "heart-rate" && (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <input type="text" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" className={inputClass} autoComplete="off" />
              </div>
            )}

            {healthTool === "blood-pressure" && (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <input type="text" inputMode="numeric" value={systolic} onChange={(e) => setSystolic(e.target.value)} placeholder="Systolic (mmHg)" className={inputClass} autoComplete="off" />
                <input type="text" inputMode="numeric" value={diastolic} onChange={(e) => setDiastolic(e.target.value)} placeholder="Diastolic (mmHg)" className={inputClass} autoComplete="off" />
              </div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={calculateHealth} className={primaryBtn}>Calculate {Icons.arrowRight}</button>
              <button type="button" onClick={resetAll} className={secondaryBtn}>{Icons.reset} Reset</button>
            </div>
          </div>
        )}

        {/* SPECIFIC */}
        {activeTab === "specific" && (
          <div className="space-y-5">
            <div className="w-full md:w-[45%]"><label className={labelClass}>Tool</label>
              <select value={specificTool} onChange={(e) => { setSpecificTool(e.target.value); setSpecificResult(null); }} className={selectClass}>
                {SPECIFIC_TOOLS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>

            {(specificTool === "percentage" || specificTool === "discount" || specificTool === "tip") && (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <input type="text" inputMode="decimal" value={specificA} onChange={(e) => setSpecificA(e.target.value)} placeholder={specificTool === "discount" ? "Original price" : specificTool === "tip" ? "Bill amount" : "Value (part)"} className={inputClass} autoComplete="off" />
                <input type="text" inputMode="decimal" value={specificB} onChange={(e) => setSpecificB(e.target.value)} placeholder={specificTool === "discount" ? "Discount %" : specificTool === "tip" ? "Tip %" : "Total (whole)"} className={inputClass} autoComplete="off" />
              </div>
            )}

            {specificTool === "average" && (
              <input type="text" value={averageInput} onChange={(e) => setAverageInput(e.target.value)} placeholder="Numbers separated by commas, e.g. 10, 20, 30" className={inputClass} autoComplete="off" />
            )}

            {specificTool === "age" && (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div><label className={labelClass}>Date of birth</label>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
                </div>
              </div>
            )}

            {specificTool === "date-difference" && (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div><label className={labelClass}>Start date</label>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
                </div>
                <div><label className={labelClass}>End date</label>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={calculateSpecific} className={primaryBtn}>Calculate {Icons.arrowRight}</button>
              <button type="button" onClick={resetAll} className={secondaryBtn}>{Icons.reset} Reset</button>
            </div>
          </div>
        )}
      </section>

      {/* RESULT */}
      <section className="mt-7 rounded-[30px] border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.28)] md:p-8">
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 text-white shadow-lg">{Icons.checkBig}</div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Result</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your converted value will appear here</p>
            </div>
          </div>

          <div className="relative min-h-[110px] rounded-2xl border border-emerald-100 bg-emerald-50/70 px-6 py-5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            {activeResult ? (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="break-all text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">{activeResult.value}</p>
                  {activeResult.label && <p className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">{activeResult.label}</p>}
                  {activeResult.description && <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{activeResult.description}</p>}
                </div>
                <button type="button" onClick={() => navigator.clipboard.writeText(activeResult.value)} className="rounded-xl border border-emerald-200 bg-white p-2.5 text-emerald-600 transition hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-400" title="Copy result">
                  {Icons.copy}
                </button>
              </div>
            ) : (
              <div className="flex h-full min-h-[80px] items-center justify-center">
                <span className="text-3xl font-semibold tracking-[0.2em] text-emerald-300">— — —</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* INFO */}
      <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">{Icons.zap}</div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Fast calculations</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">Instant calculations without sending your values to another service.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">{Icons.layers}</div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Multiple categories</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">Switch between numbers, currency, units, data, electrical, health and specific tools.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">{Icons.sparkle}</div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Clean experience</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">Smooth category navigation and focused inputs designed for quick use.</p>
        </div>
      </div>

      <style>{`
        .scrollbar-hide { scrollbar-width: none; -ms-overflow-style: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        input, select, button { -webkit-tap-highlight-color: transparent; }
        input:focus, select:focus { outline: none; }
        .hero-cards-anim { animation: heroPop 0.45s ease; }
        @keyframes heroPop { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
};

export default ToolsPage;