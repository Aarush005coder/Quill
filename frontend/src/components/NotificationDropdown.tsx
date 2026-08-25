import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'translation' | 'document';
  read: boolean;
  created_at: string;
  link?: string;
}

const STORAGE_KEY = 'quill_notifications';

const defaultNotifications: Notification[] = [
  {
    id: 1,
    title: 'Welcome to quill',
    message: 'Your workspace is ready. Start your first translation.',
    type: 'success',
    read: false,
    created_at: new Date().toISOString(),
    link: '/translate',
  },
];

const NotificationDropdown: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  /* Load from localStorage */
  const loadLocalNotifications = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setNotifications(parsed);
          return;
        }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultNotifications));
      setNotifications(defaultNotifications);
    } catch {
      setNotifications(defaultNotifications);
    }
  };

  const saveLocalNotifications = (items: Notification[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  };

  /* Fetch from backend */
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/notifications/');
      const data = response.data?.data;
      if (Array.isArray(data)) {
        setNotifications(data);
        saveLocalNotifications(data);
      } else {
        loadLocalNotifications();
      }
    } catch {
      loadLocalNotifications();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocalNotifications();
  }, []);

  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen]);

  /* Close on outside click */
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  /* Mark as read */
  const markAsRead = async (id: number) => {
    const updated = notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    setNotifications(updated);
    saveLocalNotifications(updated);
    try {
      await axios.patch(`/notifications/${id}/read/`);
    } catch {
      // local already updated
    }
  };

  /* Mark all as read */
  const markAllAsRead = async () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    saveLocalNotifications(updated);
    try {
      await axios.patch('/notifications/read-all/');
    } catch {
      // local already updated
    }
  };

  /* Delete notification */
  const deleteNotification = async (
    id: number,
    event: React.MouseEvent
  ) => {
    event.stopPropagation();
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
    saveLocalNotifications(updated);
    try {
      await axios.delete(`/notifications/${id}/`);
    } catch {
      // local already updated
    }
  };

  /* Navigate on click */
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) await markAsRead(notification.id);
    setIsOpen(false);
    if (notification.link) navigate(notification.link);
  };

  /* Time formatter */
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };

  /* Notification Icon */
  const NotificationIcon = ({ type }: { type: Notification['type'] }) => {
    const common = 'w-[18px] h-[18px]';
    if (type === 'translation') {
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M4 5h10M9 3v2m2 8a16 16 0 01-5.5-5.5M7 13l4-4m4-6h5m-2 0a15 15 0 01-5 9.5M15 17l2 4 2-4m-4 0h6" />
        </svg>
      );
    }
    if (type === 'document') {
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M14 2v6h6M8 13h8M8 17h5" />
        </svg>
      );
    }
    if (type === 'success') {
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4" />
          <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
        </svg>
      );
    }
    if (type === 'warning') {
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v4M12 17h.01" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M10.3 4.5L2.8 18a2 2 0 001.7 3h15a2 2 0 001.7-3L13.7 4.5a2 2 0 00-3.4 0z" />
        </svg>
      );
    }
    return (
      <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
        <path strokeLinecap="round" strokeWidth={1.8} d="M12 11v5M12 8h.01" />
      </svg>
    );
  };

  /* Icon colors */
  const getIconStyle = (type: Notification['type']) => {
    switch (type) {
      case 'translation':
        return 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400';
      case 'document':
        return 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400';
      case 'success':
        return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400';
      case 'warning':
        return 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400';
      default:
        return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Notifications"
        aria-expanded={isOpen}
        className={`
          relative flex items-center justify-center w-10 h-10 rounded-xl border transition-all duration-200
          ${
            isOpen
              ? 'bg-slate-100 border-slate-200 text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white'
              : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-100 hover:border-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:border-slate-700'
          }
        `}
      >
        <svg className="w-[19px] h-[19px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 21h4" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white dark:border-slate-950">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-3 w-[380px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-[0_20px_60px_rgba(15,23,42,0.14)] dark:bg-[#11151b] dark:border-slate-800 dark:shadow-[0_24px_70px_rgba(0,0,0,0.45)] z-[100]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">
                Notifications
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-500">
                {unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                  : 'You are all caught up'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Content */}
          <div className="max-h-[420px] overflow-y-auto">
            {loading && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400 animate-spin" />
                <p className="mt-3 text-xs text-slate-500">Loading notifications...</p>
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
                      d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                    <path strokeLinecap="round" strokeWidth={1.6} d="M10 21h4" />
                  </svg>
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-200">Nothing new</p>
                <p className="mt-1 max-w-[230px] text-xs leading-5 text-slate-500 dark:text-slate-500">
                  Your latest updates and activity will appear here.
                </p>
              </div>
            )}

            {!loading && notifications.length > 0 && (
              <div>
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`
                      group relative flex gap-3 px-5 py-4 cursor-pointer border-b border-slate-100 dark:border-slate-800 transition-colors
                      ${
                        notification.read
                          ? 'bg-white hover:bg-slate-50 dark:bg-[#11151b] dark:hover:bg-slate-900'
                          : 'bg-blue-50/40 hover:bg-blue-50/70 dark:bg-blue-500/[0.035] dark:hover:bg-blue-500/[0.06]'
                      }
                    `}
                  >
                    {!notification.read && (
                      <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-blue-600 dark:bg-blue-400" />
                    )}

                    <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${getIconStyle(notification.type)}`}>
                      <NotificationIcon type={notification.type} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <p className={`text-[13px] leading-5 truncate ${notification.read ? 'font-medium text-slate-700 dark:text-slate-300' : 'font-semibold text-slate-900 dark:text-white'}`}>
                          {notification.title}
                        </p>
                        <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-600">
                          {formatTime(notification.created_at)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-500 line-clamp-2">
                        {notification.message}
                      </p>
                    </div>

                    <div className="flex flex-col items-center justify-between shrink-0">
                      {!notification.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                      )}
                      <button
                        type="button"
                        onClick={(event) => deleteNotification(notification.id, event)}
                        aria-label="Delete notification"
                        className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-6 h-6 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:text-slate-600 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-t border-slate-100 dark:bg-[#0d1117] dark:border-slate-800">
            <span className="text-[10px] text-slate-400 dark:text-slate-600">quill activity</span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/history');
              }}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              View activity →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;