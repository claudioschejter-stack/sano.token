'use client';

import { useEffect, useState } from 'react';

function isClientHardeningEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (process.env.NEXT_PUBLIC_CLIENT_HARDENING === 'false') {
    return false;
  }

  if (process.env.NEXT_PUBLIC_CLIENT_HARDENING === 'true') {
    return true;
  }

  return process.env.NODE_ENV === 'production';
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }

  return target.isContentEditable || Boolean(target.closest('.allow-select, .allow-context-menu'));
}

function shouldBlockShortcut(event: KeyboardEvent): boolean {
  if (isEditableElement(event.target)) {
    return false;
  }

  const key = event.key;
  const ctrlOrMeta = event.ctrlKey || event.metaKey;
  const shift = event.shiftKey;

  if (key === 'F12') {
    return true;
  }

  if (ctrlOrMeta && shift && (key === 'I' || key === 'J' || key === 'C' || key === 'K')) {
    return true;
  }

  if (ctrlOrMeta && (key === 'u' || key === 'U')) {
    return true;
  }

  if (ctrlOrMeta && (key === 'p' || key === 'P')) {
    return true;
  }

  if (ctrlOrMeta && shift && (key === 'S' || key === 's')) {
    return true;
  }

  if (ctrlOrMeta && shift && (key === 'E' || key === 'e')) {
    return true;
  }

  if (ctrlOrMeta && shift && (key === 'P' || key === 'p')) {
    return true;
  }

  if (event.altKey && ctrlOrMeta && (key === 'i' || key === 'I')) {
    return true;
  }

  return false;
}

/**
 * Client-side hardening: discourages casual DevTools / view-source / context-menu abuse.
 * Cannot prevent a determined attacker — all mutations are local to their browser;
 * APIs must enforce authorization server-side.
 */
export function ClientPageHardening() {
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);

  useEffect(() => {
    if (!isClientHardeningEnabled()) {
      return;
    }

    document.body.classList.add('client-hardened');

    const onContextMenu = (event: MouseEvent) => {
      if (!isEditableElement(event.target)) {
        event.preventDefault();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (shouldBlockShortcut(event)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const onDragStart = (event: DragEvent) => {
      if (!isEditableElement(event.target)) {
        event.preventDefault();
      }
    };

    const onCopyCut = (event: ClipboardEvent) => {
      if (!isEditableElement(event.target)) {
        event.preventDefault();
      }
    };

    const detectDevtools = () => {
      const widthGap = window.outerWidth - window.innerWidth;
      const heightGap = window.outerHeight - window.innerHeight;
      const likelyOpen = widthGap > 160 || heightGap > 160;
      setDevtoolsOpen(likelyOpen);
    };

    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('dragstart', onDragStart);
    document.addEventListener('copy', onCopyCut);
    document.addEventListener('cut', onCopyCut);
    window.addEventListener('resize', detectDevtools);
    detectDevtools();
    const interval = window.setInterval(detectDevtools, 1500);

    return () => {
      document.body.classList.remove('client-hardened');
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('dragstart', onDragStart);
      document.removeEventListener('copy', onCopyCut);
      document.removeEventListener('cut', onCopyCut);
      window.removeEventListener('resize', detectDevtools);
      window.clearInterval(interval);
    };
  }, []);

  if (!isClientHardeningEnabled() || !devtoolsOpen) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[99999] bg-amber-600/95 px-4 py-2 text-center text-xs font-semibold text-white shadow-md"
      role="status"
    >
      Herramientas de desarrollador detectadas. El contenido y las operaciones están protegidos en el servidor.
    </div>
  );
}
