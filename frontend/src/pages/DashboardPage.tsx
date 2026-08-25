import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useTheme } from '../App';
import {
  addActivity,
  getActivities,
  getDashboardStats,
  incrementDashboardStat,
  type Activity,
  type DashboardStats,
} from '../utils/dashboardStore';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [stats, setStats] = useState<DashboardStats>(
    getDashboardStats()
  );

  const [activities, setActivities] = useState<Activity[]>(
    getActivities()
  );

  // ✅ NEW: Toast state for "Coming Soon" message
  const [showToast, setShowToast] = useState(false);

  const firstName =
    user?.first_name ||
    user?.email?.split('@')[0] ||
    'there';

  const plan =
    user?.plan
      ? user.plan.charAt(0).toUpperCase() + user.plan.slice(1)
      : 'Free';

  /* --------------------------------
     Sync local dashboard data
  -------------------------------- */

  useEffect(() => {
    const updateStats = () => {
      setStats(getDashboardStats());
    };

    const updateActivity = () => {
      setActivities(getActivities());
    };

    window.addEventListener(
      'dashboard-stats-updated',
      updateStats
    );

    window.addEventListener(
      'dashboard-activity-updated',
      updateActivity
    );

    return () => {
      window.removeEventListener(
        'dashboard-stats-updated',
        updateStats
      );

      window.removeEventListener(
        'dashboard-activity-updated',
        updateActivity
      );
    };
  }, []);

  /* --------------------------------
     Actions
  -------------------------------- */

  const startTranslation = () => {
    incrementDashboardStat('translations');

    addActivity(
      'Translation started',
      'Opened the translation workspace',
      'translation'
    );

    navigate('/translate');
  };

  const handleDocumentUpload = () => {
    navigate('/documents');
  };

  const openTools = () => {
    incrementDashboardStat('tools');

    addActivity(
      'Tools opened',
      'Explored converters and utilities',
      'tool'
    );

    navigate('/tools');
  };

  const openHistory = () => {
    navigate('/history');
  };

  // ✅ NEW: Show toast notification
  const handleComingSoon = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  /* --------------------------------
     Helpers
  -------------------------------- */

  const formatTime = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const activityIcon = (type: Activity['type']) => {
    if (type === 'translation') {
      return (
        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M5 5h10M10 3v2m1 8.5A18 18 0 0 1 6 9m8 9h6M12 21l5-10 5 10M14 18h6" />
          </svg>
        </div>
      );
    }

    if (type === 'document') {
      return (
        <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6M8 13h8M8 17h6" />
          </svg>
        </div>
      );
    }

    if (type === 'tool') {
      return (
        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.1 2.1-2.8-.6-.6-2.8z" />
          </svg>
        </div>
      );
    }

    return (
      <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M7 7h10v10H7z" />
          <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M7 12H4m16 0h-3M12 7V4m0 16v-3" />
        </svg>
      </div>
    );
  };

  return (
    <div className="w-full space-y-7">

      {/* ============================================
          CUSTOM GREEN TOAST NOTIFICATION
      ============================================ */}

      {showToast && (
        <div
          className="
            fixed bottom-6 right-6 z-[9999]
            flex items-center gap-3
            px-5 py-3.5
            rounded-xl
            bg-emerald-500 dark:bg-emerald-600
            text-white
            shadow-2xl shadow-emerald-500/30
            animate-[slideIn_0.3s_ease-out]
          "
        >
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-semibold">
            Quill Pro Coming Soon! Stay Tuned.
          </p>
        </div>
      )}

      {/* ============================================
          HERO
      ============================================ */}

      <section className="relative overflow-hidden rounded-[28px] border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-[0_10px_40px_rgba(15,23,42,0.06)] dark:shadow-none">
        <div className="absolute -right-20 -top-24 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute right-60 bottom-0 w-56 h-56 rounded-full bg-violet-500/5 blur-3xl pointer-events-none" />

        <div className="relative grid grid-cols-1 xl:grid-cols-[1fr_390px]">

          <div className="p-7 md:p-10 xl:p-12">

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                Quill workspace
              </span>
            </div>

            <h1 className="mt-6 text-4xl md:text-5xl font-bold tracking-[-0.04em] leading-[1.05] text-slate-950 dark:text-white max-w-3xl">
              Good to see you,
              <br />
              <span className="text-blue-600 dark:text-blue-400">
                {firstName}
              </span>
              .
            </h1>

            <p className="mt-5 max-w-2xl text-base md:text-lg leading-7 text-slate-500 dark:text-slate-400">
              Translate, transform and manage your content
              from one simple workspace.
              <br className="hidden md:block" />
              Everything you need is right here.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">

              <button
                onClick={startTranslation}
                className="group inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-slate-950 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-slate-950/10 dark:shadow-blue-600/20 transition-all duration-200 hover:-translate-y-0.5"
              >
                Start translating
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </button>

              <button
                onClick={handleDocumentUpload}
                className="inline-flex items-center gap-3 px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4 4 4M5 20h14" />
                </svg>
                Upload document
              </button>
            </div>
          </div>

          <div className="p-6 md:p-8 flex items-center">
            <div className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/70 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Translation</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Ready
                </span>
              </div>

              <div className="flex gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <div className="w-9 h-9 shrink-0 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">🌐</div>
                <div>
                  <p className="text-xs text-slate-400">English</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">Hello, world!</p>
                </div>
              </div>

              <div className="h-px bg-slate-200 dark:bg-slate-700 my-3" />

              <div className="flex gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <div className="w-9 h-9 shrink-0 rounded-lg bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">文</div>
                <div>
                  <p className="text-xs text-slate-400">Spanish</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">¡Hola, mundo!</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                <span className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center"></span>
                <span>
                  Powered by{' '}
                  <strong className="text-slate-600 dark:text-slate-300">AI translation</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          STATS
      ============================================ */}

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

        <StatCard
          title="Translations"
          value={stats.translations}
          description={
            stats.translations === 0
              ? 'Start your first translation'
              : `${stats.translations} translation${stats.translations === 1 ? '' : 's'} completed`
          }
          icon="translate"
        />

        <StatCard
          title="Documents"
          value={stats.documents}
          description={
            stats.documents === 0
              ? 'No documents processed yet'
              : `${stats.documents} document${stats.documents === 1 ? '' : 's'} processed`
          }
          icon="document"
        />

        <StatCard
          title="Tools used"
          value={stats.tools}
          description={
            stats.tools === 0
              ? 'Explore useful utilities'
              : `${stats.tools} tool session${stats.tools === 1 ? '' : 's'}`
          }
          icon="chart"
        />

        {/* Plan */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-400">Current plan</p>
              <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{plan}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-500 flex items-center justify-center">✦</div>
          </div>

          {/* ✅ UPDATED: Shows green toast instead of navigating */}
          <button
            onClick={handleComingSoon}
            className="mt-5 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700"
          >
            Manage plan →
          </button>
        </div>
      </section>

      {/* ============================================
          QUICK ACTIONS
      ============================================ */}

      <section>
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate-400">Get started</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">Quick actions</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickAction
            title="Translate text"
            description="Translate text instantly"
            icon="translate"
            onClick={startTranslation}
          />
          <QuickAction
            title="Translate document"
            description="Upload PDF or document"
            icon="document"
            onClick={handleDocumentUpload}
          />
          <QuickAction
            title="Explore tools"
            description="Converters & utilities"
            icon="tools"
            onClick={openTools}
          />
        </div>
      </section>

      {/* ============================================
          ACTIVITY + START CARD
      ============================================ */}

      <section className="grid grid-cols-1 xl:grid-cols-[1fr_350px] gap-4">

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Recent activity</h3>
              <p className="text-xs text-slate-400 mt-0.5">Your latest workspace activity</p>
            </div>
            <button
              onClick={openHistory}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700"
            >
              View history →
            </button>
          </div>

          {activities.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-xl">✦</div>
              <p className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">No activity yet</p>
              <p className="mt-1 text-xs text-slate-400">Start translating to see your activity here.</p>
              <button
                onClick={startTranslation}
                className="mt-5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition"
              >
                Start translating →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {activities.slice(0, 5).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                >
                  {activityIcon(activity.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{activity.title}</p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{activity.description}</p>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">{formatTime(activity.time)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">✦</div>
          <h3 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">Make your first translation</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Paste some text, select your languages and let quill handle the rest.
          </p>
          <button
            onClick={startTranslation}
            className="mt-6 w-full px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
          >
            Start translating →
          </button>
          <div className="mt-6 flex items-center gap-2 text-xs text-slate-400">
            <span>🌎</span>
            Fast, simple and multilingual
          </div>
        </div>
      </section>

      {/* ============================================
          UPGRADE
      ============================================ */}

      {plan.toLowerCase() === 'free' && (
        <section className="relative overflow-hidden rounded-2xl border border-blue-100 dark:border-blue-500/20 bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-500/5 dark:to-violet-500/5 p-6">
          <div className="absolute right-0 top-0 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">quill Pro</p>
              <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">Unlock more from your workspace</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Get higher limits and more powerful translation features.
              </p>
            </div>

            {/* ✅ UPDATED: Shows green toast instead of navigating */}
            <button
              onClick={handleComingSoon}
              className="shrink-0 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
            >
              Explore Pro →
            </button>
          </div>
        </section>
      )}

    </div>
  );
};

/* ============================================
   STAT CARD
============================================ */

interface StatCardProps {
  title: string;
  value: number;
  description: string;
  icon: 'translate' | 'document' | 'chart';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, description, icon }) => {
  const icons = {
    translate: <span className="text-blue-600 dark:text-blue-400">文</span>,
    document: <span className="text-violet-600 dark:text-violet-400"></span>,
    chart: <span className="text-emerald-600 dark:text-emerald-400">↗</span>,
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{value}</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-lg">
          {icons[icon]}
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-400">{description}</p>
    </div>
  );
};

/* ============================================
   QUICK ACTION
============================================ */

interface QuickActionProps {
  title: string;
  description: string;
  icon: 'translate' | 'document' | 'tools';
  onClick: () => void;
}

const QuickAction: React.FC<QuickActionProps> = ({ title, description, icon, onClick }) => {
  const styles = {
    translate: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    document: 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400',
    tools: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  };

  const iconContent = {
    translate: '文',
    document: '▤',
    tools: '✣',
  };

  return (
    <button
      onClick={onClick}
      className="group text-left flex items-center gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:border-slate-300 dark:hover:border-slate-700 hover:-translate-y-0.5 shadow-sm hover:shadow-md transition-all duration-200"
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0 ${styles[icon]}`}>
        {iconContent[icon]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
      <svg className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );
};

export default DashboardPage;