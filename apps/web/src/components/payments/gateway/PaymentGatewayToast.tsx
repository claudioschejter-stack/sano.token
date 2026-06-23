'use client';

import { useEffect } from 'react';

type PaymentGatewayToastProps = {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
};

export function PaymentGatewayToast({
  message,
  onDismiss,
  durationMs = 4500
}: PaymentGatewayToastProps) {
  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, message, onDismiss]);

  if (!message) {
    return null;
  }

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl border border-amber-300/40 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-lg"
    >
      {message}
    </div>
  );
}
