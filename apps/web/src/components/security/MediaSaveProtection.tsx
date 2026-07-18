'use client';

import { useEffect } from 'react';

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

function isProtectedMedia(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      'img, picture, video, canvas, svg, [data-brand-media], [data-no-save], .no-save-media'
    )
  );
}

/**
 * Reduces casual save/share of on-screen media (long-press / context menu /
 * drag). Does not and cannot block OS-level screenshots in a browser or PWA.
 */
export function MediaSaveProtection() {
  useEffect(() => {
    document.body.classList.add('media-protected');

    const onContextMenu = (event: MouseEvent) => {
      if (isEditableElement(event.target)) {
        return;
      }
      if (isProtectedMedia(event.target) || document.body.classList.contains('auth-splash-active')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const onDragStart = (event: DragEvent) => {
      if (isEditableElement(event.target)) {
        return;
      }
      if (isProtectedMedia(event.target) || document.body.classList.contains('auth-splash-active')) {
        event.preventDefault();
      }
    };

    document.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('dragstart', onDragStart, true);

    return () => {
      document.body.classList.remove('media-protected');
      document.removeEventListener('contextmenu', onContextMenu, true);
      document.removeEventListener('dragstart', onDragStart, true);
    };
  }, []);

  return null;
}
