'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentProps, MouseEvent, ReactNode } from 'react';
import { useState } from 'react';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';
import { useIsPwa } from '../../hooks/useIsPwa';
import { MobileAppDownloadModal } from './MobileAppDownloadModal';

type MobileAuthEntryLinkProps = Omit<ComponentProps<typeof Link>, 'children'> & {
  children: ReactNode;
  /** When true, mobile browsers see the app-download prompt before navigating. */
  promptOnMobile?: boolean;
};

function resolveHrefString(href: ComponentProps<typeof Link>['href']): string {
  if (typeof href === 'string') {
    return href;
  }

  if (href && typeof href === 'object') {
    const pathname = 'pathname' in href && href.pathname ? href.pathname : '/acceso';
    const search = 'search' in href && href.search ? href.search : '';
    return `${pathname}${search}`;
  }

  return '/acceso';
}

function isAuthEntryHref(href: string): boolean {
  const path = href.split('?')[0]?.replace(/\/$/, '') ?? '';
  return path === '/acceso' || path === '/acceso/registro';
}

export function MobileAuthEntryLink({
  href,
  children,
  promptOnMobile = true,
  onClick,
  ...rest
}: MobileAuthEntryLinkProps) {
  const router = useRouter();
  const { isMobile } = useDeviceDetection();
  const isPwa = useIsPwa();
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string>('');

  const hrefString = resolveHrefString(href);

  function navigate(target: string) {
    router.push(target);
  }

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) {
      return;
    }

    if (!promptOnMobile || !isMobile || isPwa || !isAuthEntryHref(hrefString)) {
      return;
    }

    event.preventDefault();
    setPendingHref(hrefString);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setPendingHref('');
  }

  function continueOnWeb() {
    const target = pendingHref || hrefString;
    closeModal();
    navigate(target);
  }

  function afterInstallChoice() {
    const target = pendingHref || hrefString;
    closeModal();
    navigate(target);
  }

  return (
    <>
      <Link href={href} onClick={handleClick} {...rest}>
        {children}
      </Link>
      <MobileAppDownloadModal
        open={modalOpen}
        onClose={closeModal}
        onContinueWeb={continueOnWeb}
        onInstallAccepted={afterInstallChoice}
      />
    </>
  );
}
