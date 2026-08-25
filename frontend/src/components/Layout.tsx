import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useTheme } from '../App';
import toast from 'react-hot-toast';
import SearchModal from './SearchModal';
import NotificationDropdown from './NotificationDropdown';
import { Info } from "lucide-react";

/* =========================================================
   HELPERS
   ========================================================= */

// Convert VAPID public key from base64 to Uint8Array
const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

/* =========================================================
   ICONS
   ========================================================= */

const Icons = {
  overview: (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect width="7" height="9" x="3" y="3" rx="2" />
      <rect width="7" height="5" x="14" y="3" rx="2" />
      <rect width="7" height="9" x="14" y="12" rx="2" />
      <rect width="7" height="5" x="3" y="16" rx="2" />
    </svg>
  ),
  translate: (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 8 6 6" />
      <path d="m4 14 6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="m22 22-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  ),
  tools: (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  documents: (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  ),
  combine: (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h4a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-5a2 2 0 0 0-2-2Z" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  ),
  about: (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4a8.6 8.6 0 1 0 11.5 11.5Z" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="M14 8l4 4-4 4M18 12H9" />
    </svg>
  ),
  menu: (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
  chevronLeft: (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  ),
  chevronRight: (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  ),
};

const navItems = [
  { path: '/dashboard', label: 'Overview', icon: Icons.overview },
  { path: '/translate', label: 'Translate', icon: Icons.translate },
  { path: '/tools', label: 'Tools', icon: Icons.tools },
  { path: '/documents', label: 'Documents', icon: Icons.documents },
  { path: '/combine', label: 'Combine', icon: Icons.combine },
  { path: '/history', label: 'History', icon: Icons.history },
  { path: "/about", label: "About", icon: <Info className="w-5 h-5" /> },
  { path: '/settings', label: 'Settings', icon: Icons.settings },
];

/* =========================================================
   LAYOUT COMPONENT
   ========================================================= */

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDark, setTheme } = useTheme();

  // ✅ NEW: Apply settings globally to the <html> tag
  useEffect(() => {
    const applyGlobalSettings = () => {
      try {
        const token = localStorage.getItem('access_token');
        let settingsKey = 'quill_settings';
        if (token) {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            settingsKey = `quill_settings_${payload.user_id || payload.userId || payload.sub || 'guest'}`;
          }
        }
        
        const saved = localStorage.getItem(settingsKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          const fontSize = parsed.fontSize || 'medium';
          const compactMode = parsed.compactMode || false;
          const showAnimations = parsed.showAnimations !== undefined ? parsed.showAnimations : true;

          // 1. Apply Font Size to <html> tag (affects all 'rem' units globally)
          document.documentElement.setAttribute('data-font-size', fontSize);
          
          // 2. Apply Compact Mode
          if (compactMode) {
            document.documentElement.classList.add('compact-mode');
          } else {
            document.documentElement.classList.remove('compact-mode');
          }

          // 3. Apply Animations Toggle
          if (!showAnimations) {
            document.documentElement.classList.add('no-animations');
          } else {
            document.documentElement.classList.remove('no-animations');
          }
        }
      } catch (error) {
        console.error('Failed to apply global settings:', error);
      }
    };

    // Apply on mount
    applyGlobalSettings();

    // Listen for changes from SettingsPage (custom event)
    const handleSettingsUpdate = () => applyGlobalSettings();
    window.addEventListener('settings-updated', handleSettingsUpdate);
    
    // Listen for changes from other tabs (storage event)
    window.addEventListener('storage', handleSettingsUpdate);

    return () => {
      window.removeEventListener('settings-updated', handleSettingsUpdate);
      window.removeEventListener('storage', handleSettingsUpdate);
    };
  }, []);

  // ✅ NEW: Push Notifications Registration
  useEffect(() => {
    // ⚠️ REPLACE THIS with the VAPID Public Key you generated in backend
    const VAPID_PUBLIC_KEY = "BPsI3OrUDMTAjiHPWOsvg3l2xbJmNPq9I6uvp_nutgc51fND-CfAfkxDOR2EGr3M9XuZ91EdhkoHqoE5AliT88Q"; 
    
    if (!user || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }

    const registerPush = async () => {
      try {
        // Register the service worker
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        
        // Request permission
        const permission = await Notification.requestPermission();
        
        if (permission === "granted") {
          // Check if already subscribed
          const existingSubscription = await registration.pushManager.getSubscription();
          if (existingSubscription) {
            return; // Already subscribed, no need to do it again
          }

          // Subscribe to push notifications
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });

          // Send subscription to backend
          const token = localStorage.getItem("access_token");
          if (token) {
            await fetch("http://127.0.0.1:8000/api/users/push-subscription/", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
              },
              body: JSON.stringify(subscription),
            });
          }
        }
      } catch (error) {
        console.error("Push registration failed:", error);
      }
    };

    registerPush();
  }, [user]);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    return location.pathname === path;
  };

  const currentPage = navItems.find((item) => isActive(item.path))?.label || 'Overview';

  const handleNavClick = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const getUserInitial = () => {
    return (
      user?.first_name?.[0]?.toUpperCase() || 
      user?.email?.[0]?.toUpperCase() || 
      'U'
    );
  };

  return (
    // Removed local classes, now handled globally via <html> tag
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0b0d10] dark:text-slate-100 transition-colors duration-300">
      <SearchModal />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen
          ${sidebarCollapsed ? 'w-[82px]' : 'w-[250px]'}
          bg-white dark:bg-[#0d0f12]
          border-r border-slate-200 dark:border-[#20242a]
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className={`h-[72px] flex items-center border-b border-slate-200 dark:border-[#20242a] ${sidebarCollapsed ? 'justify-center px-3' : 'px-5'}`}>
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center shrink-0 overflow-hidden">
              <img src="/quill_logo.png" alt="quill" className="w-7 h-7 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            </div>
            {!sidebarCollapsed && (
              <div className="text-left">
                <h1 className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">Quill</h1>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">Translate, create, and manage with ease</p>
              </div>
            )}
          </button>
        </div>

        <button
          onClick={() => setSidebarCollapsed((prev) => !prev)}
          className="hidden lg:flex absolute -right-3 top-[82px] w-6 h-6 items-center justify-center rounded-full bg-white dark:bg-[#181b20] border border-slate-200 dark:border-[#2a2f36] text-slate-500 dark:text-slate-400 shadow-sm hover:text-blue-600 dark:hover:text-blue-400 transition-colors z-10"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? Icons.chevronRight : Icons.chevronLeft}
        </button>

        <div className={`mx-3 mt-4 rounded-xl border border-slate-200 dark:border-[#24282e] bg-slate-50 dark:bg-[#12151a] ${sidebarCollapsed ? 'p-2' : 'p-3'}`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm font-semibold shrink-0">
              {getUserInitial()}
            </div>
            {!sidebarCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {user?.first_name || user?.email?.split('@')[0] || 'User'}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                    {user?.email || 'user@example.com'}
                  </p>
                </div>
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-[#252a31] text-slate-500 dark:text-slate-400">
                  {user?.plan === 'pro' ? 'PRO' : 'FREE'}
                </span>
              </>
            )}
          </div>
        </div>

        <nav className={`mt-5 px-3 space-y-1 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
          {!sidebarCollapsed && (
            <p className="px-3 mb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-600">Workspace</p>
          )}
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNavClick(item.path)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`group relative w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${active ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#171a1f] hover:text-slate-900 dark:hover:text-slate-200'}`}
              >
                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-blue-600 dark:bg-blue-500" />}
                <span className="shrink-0 transition-transform duration-200 group-hover:scale-105">{item.icon}</span>
                {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 dark:border-[#20242a] p-3">
          <div className={`rounded-xl bg-slate-50 dark:bg-[#12151a] border border-slate-200 dark:border-[#24282e] mb-2 ${sidebarCollapsed ? 'p-2' : 'p-3'}`}>
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
              {!sidebarCollapsed && (
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#1a1d22] border border-slate-200 dark:border-[#2a2f36] flex items-center justify-center text-slate-500 dark:text-slate-400">
                    {isDark ? Icons.moon : Icons.sun}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Appearance</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{isDark ? 'Dark mode' : 'Light mode'}</p>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle appearance"
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className={`relative shrink-0 w-[44px] h-[24px] rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isDark ? 'bg-blue-600' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${isDark ? 'translate-x-[20px]' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            title={sidebarCollapsed ? 'Sign out' : undefined}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors`}
          >
            {Icons.logout}
            {!sidebarCollapsed && <span className="font-medium">Sign out</span>}
          </button>
        </div>
      </aside>

      <div className={`min-h-screen transition-[margin] duration-300 ${sidebarCollapsed ? 'lg:ml-[82px]' : 'lg:ml-[250px]'}`}>
        <header className="sticky top-0 z-30 h-[72px] bg-white/90 dark:bg-[#0b0d10]/90 backdrop-blur-xl border-b border-slate-200 dark:border-[#20242a]">
          <div className="h-full px-4 md:px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setSidebarOpen(true)} className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#171a1f]">
                {Icons.menu}
              </button>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">{currentPage}</h2>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <button
                type="button"
                onClick={() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })); }}
                className="hidden sm:flex items-center gap-3 w-[220px] md:w-[260px] h-10 px-3 rounded-xl border border-slate-200 dark:border-[#292e35] bg-slate-50 dark:bg-[#12151a] text-slate-400 hover:border-slate-300 dark:hover:border-[#353b43] transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="m16 16 4 4" strokeLinecap="round" />
                </svg>
                <span className="flex-1 text-left text-xs">Search...</span>
                <kbd className="px-1.5 py-0.5 rounded-md text-[9px] border border-slate-200 dark:border-[#2a2f36] bg-white dark:bg-[#1a1d22] text-slate-400">Ctrl K</kbd>
              </button>
              <NotificationDropdown />
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-semibold hover:ring-2 hover:ring-blue-500/20 transition-all"
                title="Account settings"
              >
                {getUserInitial()}
              </button>
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-72px)] p-4 md:p-6 lg:p-8 bg-slate-50 dark:bg-[#0b0d10] transition-colors duration-300">
          <Outlet />
        </main>
      </div>

      {/* ✅ GLOBAL CSS TARGETING <html> TAG FOR 100% RELIABILITY */}
      <style>{`
        /* 1. FONT SIZE (Changes base 'rem' size globally) */
        html[data-font-size="small"] { font-size: 14px; }
        html[data-font-size="medium"] { font-size: 16px; }
        html[data-font-size="large"] { font-size: 18px; }

        /* 2. COMPACT MODE (Higher specificity to override Tailwind) */
        html.compact-mode .rounded-3xl { border-radius: 0.75rem !important; }
        html.compact-mode .rounded-2xl { border-radius: 0.5rem !important; }
        html.compact-mode .rounded-xl { border-radius: 0.375rem !important; }
        html.compact-mode .rounded-lg { border-radius: 0.25rem !important; }
        
        html.compact-mode .p-8 { padding: 1.5rem !important; }
        html.compact-mode .p-6 { padding: 1rem !important; }
        html.compact-mode .p-5 { padding: 0.875rem !important; }
        html.compact-mode .p-4 { padding: 0.75rem !important; }
        html.compact-mode .p-3 { padding: 0.5rem !important; }
        
        html.compact-mode .gap-6 { gap: 1rem !important; }
        html.compact-mode .gap-4 { gap: 0.75rem !important; }
        html.compact-mode .gap-3 { gap: 0.5rem !important; }
        
        html.compact-mode .space-y-6 > * + * { margin-top: 1rem !important; }
        html.compact-mode .space-y-4 > * + * { margin-top: 0.75rem !important; }

        /* 3. DISABLE ANIMATIONS */
        html.no-animations *, 
        html.no-animations *::before, 
        html.no-animations *::after { 
            animation-duration: 0.01ms !important; 
            animation-delay: 0.01ms !important; 
            transition-duration: 0.01ms !important; 
            transition-delay: 0.01ms !important; 
            scroll-behavior: auto !important; 
        }
      `}</style>
    </div>
  );
};

export default Layout;