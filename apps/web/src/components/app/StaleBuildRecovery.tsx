'use client';

import { useEffect } from 'react';

/**
 * Recover a tab left behind by a deployment.
 *
 * A page loaded before a deploy asks for chunks the new build replaced, and they
 * are gone. Next.js falls back to a full navigation for route changes, but a
 * script that fails to load mid-interaction leaves the screen as it is: a button
 * that does nothing, with the reason only visible in the console. During a
 * checkout that is the worst possible moment to go quiet.
 *
 * Reloading picks up the current build. It happens at most once per tab, because
 * a reload loop would be worse than the stale chunk — if the failure is not the
 * build, the second attempt must surface instead of hiding in a refresh cycle.
 */
const ONCE_KEY = 'sanova-stale-build-reloaded';

function isStaleChunkError(message: string): boolean {
  return (
    /ChunkLoadError/i.test(message) ||
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message)
  );
}

function alreadyReloaded(): boolean {
  try {
    return window.sessionStorage.getItem(ONCE_KEY) === '1';
  } catch {
    // Private modes can refuse storage; without it there is no way to bound the
    // retries, so do nothing rather than risk a loop.
    return true;
  }
}

export function StaleBuildRecovery() {
  useEffect(() => {
    const recover = () => {
      if (alreadyReloaded()) return;
      try {
        window.sessionStorage.setItem(ONCE_KEY, '1');
      } catch {
        return;
      }
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      if (isStaleChunkError(event.message ?? '')) {
        recover();
      }
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason ?? '');
      if (isStaleChunkError(message)) {
        recover();
      }
    };

    /**
     * A failed `<script>` does not raise a window error event, it fires one on
     * the element itself — which only reaches here in the capture phase.
     */
    const onResourceError = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const src =
        target instanceof HTMLScriptElement
          ? target.src
          : target instanceof HTMLLinkElement
            ? target.href
            : '';
      if (src.includes('/_next/static/')) {
        recover();
      }
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('error', onResourceError, true);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('error', onResourceError, true);
    };
  }, []);

  return null;
}
