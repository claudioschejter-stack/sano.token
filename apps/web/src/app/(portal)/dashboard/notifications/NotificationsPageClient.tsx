'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bell, CheckCheck } from 'lucide-react';
import { useTranslation, useLocale } from '../../../../i18n/LocaleProvider';
import { createIntlFormatters } from '../../../../i18n/formatters';
import { useNotifications } from '../../../../hooks/useNotifications';
import { MP_ACCENT, MP_ACCENT_SOFT } from '../../../../lib/pwa/mpTheme';

export function NotificationsPageClient() {
  const t = useTranslation();
  const n = t.notifications;
  const router = useRouter();
  const { intlLocale } = useLocale();
  const { formatDateTime } = useMemo(() => createIntlFormatters(intlLocale), [intlLocale]);
  const { notifications, unreadCount, loading, markAllRead, markRead } = useNotifications();

  useEffect(() => {
    if (!loading && unreadCount > 0) {
      void markAllRead();
    }
    // Only run once notifications have finished loading for the first time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  return (
    <div className="-mx-4 -mt-4 min-h-full bg-slate-50 pb-6 font-sans">
      <div className="flex items-center justify-between bg-white px-4 py-4 shadow-sm">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500"
          aria-label={t.pwaHome.backToPanel}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-bold text-slate-900">{n.title}</h1>
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="flex items-center gap-1 text-xs font-medium"
            style={{ color: MP_ACCENT }}
          >
            <CheckCheck size={14} />
            {n.markAllRead}
          </button>
        ) : (
          <span className="w-9" />
        )}
      </div>

      <div className="mt-4 space-y-3 px-4">
        {notifications.length === 0 && !loading ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: MP_ACCENT_SOFT, color: MP_ACCENT }}
            >
              <Bell size={22} />
            </div>
            <p className="mt-3 text-sm text-slate-500">{n.empty}</p>
          </div>
        ) : (
          notifications.map((item) => (
            <Link
              key={item.id}
              href={item.link ?? '/dashboard'}
              onClick={() => void markRead(item.id)}
              className="flex gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition active:bg-slate-50"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: MP_ACCENT_SOFT, color: MP_ACCENT }}
              >
                <Bell size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{item.title}</p>
                <p className="mt-0.5 text-sm text-slate-500">{item.body}</p>
                <p className="mt-1 text-xs text-slate-400">{formatDateTime(item.createdAt)}</p>
              </div>
              {!item.read ? (
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
              ) : null}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
