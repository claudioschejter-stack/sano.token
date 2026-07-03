'use client';

import { useEffect } from 'react';

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

  // Off by default: the old outer/inner size heuristic caused false positives on mobile
  // browsers (address bars, PWAs, safe areas) and blocked legitimate onboarding flows.
  return false;
}

function isMobileLike(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return (
    window.matchMedia('(max-width: 767px)').matches ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent)
  );
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
 * Optional desktop-only hardening: blocks common DevTools / view-source shortcuts.
 * Does not detect DevTools via viewport heuristics (too many false positives on mobile).
 * All authorization remains enforced server-side.
 */
export function ClientPageHardening() {
  useEffect(() => {
    if (!isClientHardeningEnabled() || isMobileLike()) {
      return;
    }

    document.body.classList.add('client-hardened');

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

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('dragstart', onDragStart);

    return () => {
      document.body.classList.remove('client-hardened');
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('dragstart', onDragStart);
    };
  }, []);

  return null;
}
