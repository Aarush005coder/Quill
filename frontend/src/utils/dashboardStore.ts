export interface DashboardStats {
  translations: number;
  documents: number;
  tools: number;
  combine: number;
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  type: 'translation' | 'document' | 'tool' | 'combine';
  time: string;
}

const STATS_KEY = 'quill_dashboard_stats';
const ACTIVITY_KEY = 'quill_dashboard_activity';

const defaultStats: DashboardStats = {
  translations: 0,
  documents: 0,
  tools: 0,
  combine: 0,
};

export const getDashboardStats = (): DashboardStats => {
  try {
    const saved = localStorage.getItem(STATS_KEY);

    if (!saved) {
      localStorage.setItem(STATS_KEY, JSON.stringify(defaultStats));
      return defaultStats;
    }

    return {
      ...defaultStats,
      ...JSON.parse(saved),
    };
  } catch {
    return defaultStats;
  }
};

export const saveDashboardStats = (stats: DashboardStats) => {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));

  window.dispatchEvent(
    new CustomEvent('dashboard-stats-updated', {
      detail: stats,
    })
  );
};

export const incrementDashboardStat = (
  type: keyof DashboardStats,
  amount = 1
) => {
  const stats = getDashboardStats();

  stats[type] += amount;

  saveDashboardStats(stats);

  return stats;
};

export const getActivities = (): Activity[] => {
  try {
    return JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]');
  } catch {
    return [];
  }
};

export const addActivity = (
  title: string,
  description: string,
  type: Activity['type']
) => {
  const activity: Activity = {
    id: `${Date.now()}-${Math.random()}`,
    title,
    description,
    type,
    time: new Date().toISOString(),
  };

  const activities = [activity, ...getActivities()].slice(0, 10);

  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activities));

  window.dispatchEvent(
    new CustomEvent('dashboard-activity-updated')
  );
};

export const clearDashboardData = () => {
  localStorage.removeItem(STATS_KEY);
  localStorage.removeItem(ACTIVITY_KEY);

  window.dispatchEvent(
    new CustomEvent('dashboard-stats-updated')
  );

  window.dispatchEvent(
    new CustomEvent('dashboard-activity-updated')
  );
};