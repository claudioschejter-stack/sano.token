'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from '../i18n/LocaleProvider';
import { getWhatsAppPhone, getWhatsAppUrl } from '../config/site';
import { isPortalRoute, shouldHideWhatsAppFab } from '../lib/mobile/deviceConfig';
import { useMobilePortal } from '../hooks/useMobilePortal';

const LANDING_BLINK_DELAY_MS = 5000;

export function WhatsAppIcon() {
  return (
    <span className="grid h-full w-full place-items-center">
      <svg viewBox="0 0 24 24" aria-hidden className="h-7 w-7 translate-x-px fill-current">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    </span>
  );
}

export function WhatsAppFloat() {
  const t = useTranslation();
  const pathname = usePathname();
  const isMobilePortal = useMobilePortal();
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
  const portalOffset = isPortalRoute(pathname);

  // The PwaShell mobile header already renders its own WhatsApp button, so the
  // floating button only makes sense outside of that shell (desktop, or mobile
  // outside the portal, e.g. the public landing pages).
  if (!href || shouldHideWhatsAppFab(pathname) || (isMobilePortal && portalOffset)) return null;

  // fix: 9 accessibility — aria-label, title, rel, target all present
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      title="Contactar por WhatsApp"
      onPointerDown={() => {
        userInteractedRef.current = true;
        setBlink(false);
      }}
      className={`fixed right-4 z-30 grid h-14 w-14 min-h-12 min-w-12 place-items-center overflow-hidden rounded-full bg-[#25D366] text-white shadow-lg shadow-emerald-900/30 transition hover:scale-105 hover:bg-[#20bd5a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 sm:right-6 ${
        blink ? 'whatsapp-fab-blink' : ''
      } ${
        portalOffset
          ? 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-6'
          : 'bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]'
      }`}
    >
      <WhatsAppIcon />
    </a>
  );
}
