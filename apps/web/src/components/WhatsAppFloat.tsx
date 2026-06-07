'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from '../i18n/LocaleProvider';
import { getWhatsAppPhone, getWhatsAppUrl } from '../config/site';
import { isPortalRoute, shouldHideWhatsAppFab } from '../lib/mobile/deviceConfig';

const LANDING_BLINK_DELAY_MS = 5000;

function WhatsAppIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      className="block h-8 w-8 shrink-0 fill-current"
    >
      <path d="M16 3C9.373 3 4 8.373 4 15c0 2.385.658 4.683 1.903 6.693L4 29l7.527-1.977A11.94 11.94 0 0016 27c6.627 0 12-5.373 12-12S22.627 3 16 3zm0 21.8a9.72 9.72 0 01-4.95-1.357l-.355-.21-4.7 1.234 1.256-4.585-.236-.375A9.72 9.72 0 016.2 15C6.2 9.588 10.588 5.2 16 5.2S25.8 9.588 25.8 15 21.412 24.8 16 24.8zm5.486-7.32c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.08-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.08-.15-.67-1.61-.92-2.21-.25-.58-.5-.5-.67-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.08-.12-.27-.2-.57-.35z" />
    </svg>
  );
}

export function WhatsAppFloat() {
  const t = useTranslation();
  const pathname = usePathname();
  const [phone, setPhone] = useState(() => getWhatsAppPhone());
  const [blink, setBlink] = useState(false);
  const userInteractedRef = useRef(false);

  const isLanding = pathname === '/';

  useEffect(() => {
    void fetch('/api/site-config')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { whatsappPhone?: string } | null) => {
        if (data?.whatsappPhone) {
          setPhone(data.whatsappPhone.replace(/\D/g, ''));
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    userInteractedRef.current = false;
    setBlink(false);

    if (!isLanding) return;

    const interactionEvents = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

    const stopBlink = () => {
      userInteractedRef.current = true;
      setBlink(false);
    };

    for (const eventName of interactionEvents) {
      window.addEventListener(eventName, stopBlink, { capture: true, passive: true });
    }

    const timer = window.setTimeout(() => {
      if (!userInteractedRef.current) {
        setBlink(true);
      }
    }, LANDING_BLINK_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      for (const eventName of interactionEvents) {
        window.removeEventListener(eventName, stopBlink, { capture: true });
      }
    };
  }, [isLanding, pathname]);

  const href = getWhatsAppUrl(t.common.whatsappMessage, phone);

  if (!href || shouldHideWhatsAppFab(pathname)) return null;

  const portalOffset = isPortalRoute(pathname);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t.common.whatsappLabel}
      onPointerDown={() => {
        userInteractedRef.current = true;
        setBlink(false);
      }}
      className={`fixed right-4 z-30 flex h-14 w-14 min-h-12 min-w-12 items-center justify-center rounded-full bg-[#25D366] p-0 text-white shadow-lg shadow-emerald-900/30 transition hover:scale-105 hover:bg-[#20bd5a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 sm:right-6 ${
        blink ? 'whatsapp-fab-blink' : ''
      } ${
        portalOffset
          ? 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-6'
          : 'bottom-4 safe-bottom sm:bottom-6'
      }`}
    >
      <WhatsAppIcon />
    </a>
  );
}
