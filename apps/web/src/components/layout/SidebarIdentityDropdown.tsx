'use client';

import { ChevronDown, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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

export function SidebarIdentityDropdown() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const t = useTranslation();
  const { profile, loading } = useAccountStatus();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (loading) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-1 rounded-full border border-terminal-border bg-terminal-bg px-2.5 py-0.5 text-xs font-semibold text-terminal-text transition-colors hover:border-terminal-primary/40"
      >
        <UserRound size={12} />
        {t.userRoleHeader.identityButton}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)]">
          <KycIdentityDetails
            identity={profile?.identity ?? EMPTY_IDENTITY}
            labels={t.identityProfile}
            className="border-terminal-border bg-terminal-card text-terminal-text shadow-lg"
          />
        </div>
      ) : null}
    </div>
  );
}
