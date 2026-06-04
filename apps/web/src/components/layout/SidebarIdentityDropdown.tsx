'use client';

import { ChevronDown, UserRound } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { KycIdentityDetails } from '../identity/KycIdentityDetails';
import type { KycIdentitySnapshot } from '../../lib/onboarding/extractDiditIdentity';

const EMPTY_IDENTITY: KycIdentitySnapshot = {
  fullName: null,
  documentId: null,
  dateOfBirth: null,
  nationality: null,
  documentType: null,
  documentExpiry: null,
  gender: null
};

type DropdownPosition = {
  top: number;
  left: number;
};

export function SidebarIdentityDropdown() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<DropdownPosition>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const t = useTranslation();
  const { profile, loading } = useAccountStatus();

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    const panelWidth = 288;
    const viewportPadding = 16;
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      window.innerWidth - panelWidth - viewportPadding
    );

    setPosition({
      top: rect.bottom + 8,
      left
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    updatePosition();

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    }

    function handleViewportChange() {
      updatePosition();
    }

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open, updatePosition]);

  if (loading) {
    return null;
  }

  const dropdownPanel =
    open && mounted ? (
      <div
        ref={panelRef}
        className="fixed z-[200] w-72 max-w-[calc(100vw-2rem)]"
        style={{ top: position.top, left: position.left }}
      >
        <KycIdentityDetails
          identity={profile?.identity ?? EMPTY_IDENTITY}
          labels={t.identityProfile}
          className="border-terminal-border bg-terminal-card text-terminal-text shadow-2xl ring-1 ring-black/10"
        />
      </div>
    ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => {
            const next = !current;
            if (next) {
              requestAnimationFrame(updatePosition);
            }
            return next;
          });
        }}
        className="inline-flex items-center gap-1 rounded-full border border-terminal-border bg-terminal-bg px-2.5 py-0.5 text-xs font-semibold text-terminal-text transition-colors hover:border-terminal-primary/40"
      >
        <UserRound size={12} />
        {t.userRoleHeader.identityButton}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {mounted && dropdownPanel ? createPortal(dropdownPanel, document.body) : null}
    </>
  );
}
