'use client';

import { useCallback, useEffect, useState } from 'react';

export type PortalNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

const POLL_INTERVAL_MS = 60_000;

/** Fetches notifications + unread count on mount and polls lightly while mounted. */
export function useNotifications() {
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    return fetch('/api/notifications')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { notifications?: PortalNotification[]; unreadCount?: number } | null) => {
        if (!data) return;
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      })
      .catch(() => {
        // Best-effort — keep previous state on transient errors.
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch('/api/notifications/read-all', { method: 'POST' }).catch(() => {});
  }, []);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' }).catch(() => {});
  }, []);

  return { notifications, unreadCount, loading, refresh, markAllRead, markRead };
}
