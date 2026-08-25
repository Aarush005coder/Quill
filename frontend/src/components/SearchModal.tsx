import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../App';

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: 'page' | 'tool' | 'action';
  path?: string;
  keywords: string[];
  action?: () => void;
}

/* =========================================================
   INLINE ICONS
   ========================================================= */

const Icon = ({
  name,
  size = 18,
}: {
  name: string;
  size?: number;
}) => {
  const s = {
    width: size,
    height: size,
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    viewBox: '0 0 24 24',
  };

  switch (name) {
    case 'search':
      return (
        <svg {...s}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
      );

    case 'translate':
      return (
        <svg {...s}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14 14 0 0 1 0 18" />
          <path d="M12 3a14 14 0 0 0 0 18" />
        </svg>
      );

    case 'file':
      return (
        <svg {...s}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8" />
          <path d="M8 17h5" />
        </svg>
      );

    case 'tools':
      return (
        <svg {...s}>
          <path d="M14.7 6.3a4 4 0 0 0-5.6 5.6l-6.4 6.4a2 2 0 1 0 2.8 2.8l6.4-6.4a4 4 0 0 0 5.6-5.6l-2.2 2.2-2.8-.6-.6-2.8z" />
        </svg>
      );

    case 'history':
      return (
        <svg {...s}>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
          <path d="M12 7v5l3 2" />
        </svg>
      );

    case 'chart':
      return (
        <svg {...s}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="m7 15 3-4 3 2 5-7" />
        </svg>
      );

    case 'settings':
      return (
        <svg {...s}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19 13a1.7 1.7 0 0 0 1-1 1.7 1.7 0 0 0-1-1" />
          <path d="M5 11a1.7 1.7 0 0 0-1 1 1.7 1.7 0 0 0 1 1" />
          <path d="M12 5a1.7 1.7 0 0 0-1-1 1.7 1.7 0 0 0-1 1" />
          <path d="M12 19a1.7 1.7 0 0 0 1 1 1.7 1.7 0 0 0 1-1" />
        </svg>
      );

    case 'sun':
      return (
        <svg {...s}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="M4.9 4.9l1.4 1.4" />
          <path d="m17.7 17.7 1.4 1.4" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m4.9 19.1 1.4-1.4" />
          <path d="m17.7 6.3 1.4-1.4" />
        </svg>
      );

    case 'moon':
      return (
        <svg {...s}>
          <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5z" />
        </svg>
      );

    default:
      return null;
  }
};

/* =========================================================
   SEARCH MODAL
   ========================================================= */

const SearchModal: React.FC = () => {
  const navigate = useNavigate();
  const { isDark, setTheme } = useTheme();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('recent_searches') || '[]');
    } catch {
      return [];
    }
  });

  const inputRef = useRef<HTMLInputElement>(null);

  const pages: SearchResult[] = useMemo(
    () => [
      {
        id: 'translate',
        title: 'Translate',
        subtitle: 'Translate text and languages',
        type: 'page',
        path: '/translate',
        keywords: ['translate', 'language', 'translation'],
      },
      {
        id: 'tools',
        title: 'Tools',
        subtitle: 'Converters and utilities',
        type: 'page',
        path: '/tools',
        keywords: ['tools', 'converter', 'calculator'],
      },
      {
        id: 'documents',
        title: 'Documents',
        subtitle: 'Upload and translate files',
        type: 'page',
        path: '/documents',
        keywords: ['documents', 'pdf', 'file', 'upload'],
      },
      {
        id: 'history',
        title: 'History',
        subtitle: 'View your activity',
        type: 'page',
        path: '/history',
        keywords: ['history', 'activity', 'recent'],
      },
      {
        id: 'about',
        title: 'About',
        subtitle: 'Usage and translation insights',
        type: 'page',
        path: '/about',
        keywords: ['about', 'stats', 'usage'],
      },
      {
        id: 'settings',
        title: 'Settings',
        subtitle: 'Account and preferences',
        type: 'page',
        path: '/settings',
        keywords: ['settings', 'account', 'profile'],
      },
    ],
    []
  );

  const tools: SearchResult[] = useMemo(
    () => [
      {
        id: 'currency',
        title: 'Currency Converter',
        subtitle: 'Convert currencies',
        type: 'tool',
        path: '/tools?tab=currency',
        keywords: ['currency', 'money', 'usd', 'inr', 'eur'],
      },
      {
        id: 'bmi',
        title: 'BMI Calculator',
        subtitle: 'Calculate body mass index',
        type: 'tool',
        path: '/tools?tab=health',
        keywords: ['bmi', 'health', 'body', 'calculator'],
      },
      {
        id: 'percentage',
        title: 'Percentage Calculator',
        subtitle: 'Quick percentage calculations',
        type: 'tool',
        path: '/tools?tab=specific',
        keywords: ['percentage', 'percent', 'math'],
      },
    ],
    []
  );

  const results = useMemo(() => {
    const actions: SearchResult[] = [
      {
        id: 'theme',
        title: isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode',
        subtitle: 'Change your workspace appearance',
        type: 'action',
        keywords: ['theme', 'dark', 'light', 'appearance'],
        action: () => setTheme(isDark ? 'light' : 'dark'),
      },
    ];

    const all = [...pages, ...tools, ...actions];

    if (!query.trim()) return [];

    const normalized = query.toLowerCase().trim();

    return all.filter((item) => {
      return (
        item.title.toLowerCase().includes(normalized) ||
        item.subtitle?.toLowerCase().includes(normalized) ||
        item.keywords.some((keyword) =>
          keyword.toLowerCase().includes(normalized)
        )
      );
    });
  }, [query, pages, tools, isDark, setTheme]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        setIsOpen((previous) => !previous);
      }

      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);

      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const executeResult = useCallback(
    (item: SearchResult) => {
      if (query.trim()) {
        setRecentSearches((previous) => {
          const next = [
            query.trim(),
            ...previous.filter((item) => item !== query.trim()),
          ].slice(0, 5);

          localStorage.setItem('recent_searches', JSON.stringify(next));

          return next;
        });
      }

      if (item.action) {
        item.action();
      }

      if (item.path) {
        navigate(item.path);
      }

      setIsOpen(false);
    },
    [navigate, query]
  );

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (!results.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((previous) => (previous + 1) % results.length);
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex(
        (previous) => (previous - 1 + results.length) % results.length
      );
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const selected = results[selectedIndex];
      if (selected) {
        executeResult(selected);
      }
    }
  };

  const clearRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem('recent_searches');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/30 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setIsOpen(false)}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.2)] dark:border-white/10 dark:bg-[#15171c]"
      >
        {/* Search */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/5">
          <span className="text-slate-400">
            <Icon name="search" size={20} />
          </span>

          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search anything..."
            className="flex-1 bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
          />

          <kbd className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-400 dark:border-white/10 dark:bg-white/5">
            ESC
          </kbd>
        </div>

        {/* Content */}
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {/* Empty search */}
          {!query.trim() && (
            <>
              {recentSearches.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Recent
                    </p>

                    <button
                      onClick={clearRecent}
                      className="text-[10px] font-semibold text-slate-400 hover:text-red-500"
                    >
                      Clear
                    </button>
                  </div>

                  {recentSearches.map((item) => (
                    <button
                      key={item}
                      onClick={() => setQuery(item)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-600 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
                    >
                      <span className="text-slate-400">
                        <Icon name="history" size={16} />
                      </span>
                      {item}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-white/5">
                    <Icon name="search" size={21} />
                  </div>

                  <p className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Search quill
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Find pages, tools and actions quickly.
                  </p>

                  <div className="mt-5 flex justify-center gap-3 text-[10px] text-slate-400">
                    <span>
                      <kbd className="rounded border bg-slate-50 px-1.5 py-0.5 dark:bg-white/5">
                        ↑↓
                      </kbd>{' '}
                      Navigate
                    </span>

                    <span>
                      <kbd className="rounded border bg-slate-50 px-1.5 py-0.5 dark:bg-white/5">
                        Enter
                      </kbd>{' '}
                      Select
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Results */}
          {query.trim() && results.length > 0 && (
            <div>
              <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Results
              </p>

              {results.map((item, index) => {
                const selected = index === selectedIndex;

                const icon =
                  item.type === 'page'
                    ? item.id === 'translate'
                      ? 'translate'
                      : item.id === 'documents'
                      ? 'file'
                      : item.id === 'analytics'
                      ? 'chart'
                      : item.id === 'settings'
                      ? 'settings'
                      : 'tools'
                    : item.type === 'tool'
                    ? 'tools'
                    : isDark
                    ? 'sun'
                    : 'moon';

                return (
                  <button
                    key={item.id}
                    onClick={() => executeResult(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                      selected
                        ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5'
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        selected
                          ? 'bg-white/10 dark:bg-slate-950/10'
                          : 'bg-slate-100 dark:bg-white/5'
                      }`}
                    >
                      <Icon name={icon} size={17} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {item.title}
                      </p>

                      <p
                        className={`truncate text-[11px] ${
                          selected
                            ? 'text-white/60 dark:text-slate-500'
                            : 'text-slate-400'
                        }`}
                      >
                        {item.subtitle}
                      </p>
                    </div>

                    <span
                      className={`rounded-md border px-2 py-1 text-[9px] font-semibold ${
                        selected
                          ? 'border-white/20 text-white/60 dark:text-slate-500'
                          : 'border-slate-200 text-slate-400 dark:border-white/10'
                      }`}
                    >
                      {item.type}
                    </span>

                    {selected && (
                      <span className="text-xs opacity-50">↵</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* No results */}
          {query.trim() && results.length === 0 && (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/5">
                <Icon name="search" size={20} />
              </div>

              <p className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
                No results found
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Try searching for a page, tool or action.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-5 py-3 dark:border-white/5 dark:bg-white/[0.02]">
          <p className="text-[10px] text-slate-400">quill Command</p>

          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <span>
              <kbd className="rounded border bg-white px-1.5 py-0.5 dark:bg-white/5">
                Ctrl
              </kbd>{' '}
              +{' '}
              <kbd className="rounded border bg-white px-1.5 py-0.5 dark:bg-white/5">
                K
              </kbd>
            </span>

            <span>Open search</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchModal;