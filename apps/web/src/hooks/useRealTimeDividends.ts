'use client';

import { useEffect, useRef } from 'react';
import { useDividendStore, type LiveDistributionEvent } from '../store/useDividendStore';

const FINANCE_STREAM_PATH = '/api/v1/finance/stream';
const MAX_RECONNECT_DELAY_MS = 30_000;
const POLL_INTERVAL_MS = 30_000;
const SSE_FAILURES_BEFORE_POLL = 2;

type FinanceStreamMessage = Readonly<{
  type: 'DIVIDEND_PROCESSED';
  payload: LiveDistributionEvent;
}>;

function parseStreamPayload(raw: string): LiveDistributionEvent | null {
  try {
    const parsed = JSON.parse(raw) as FinanceStreamMessage | LiveDistributionEvent;

    if ('type' in parsed && parsed.type === 'DIVIDEND_PROCESSED' && parsed.payload) {
      return parsed.payload;
    }

    if ('txHash' in parsed && 'amount' in parsed) {
      return parsed as LiveDistributionEvent;
    }

    return null;
  } catch {
    return null;
  }
}

export function useRealTimeDividends(): void {
  const addLiveDistribution = useDividendStore((state) => state.addLiveDistribution);
  const fetchDividends = useDividendStore((state) => state.fetchDividends);
  const reconnectAttemptRef = useRef(0);
  const disposedRef = useRef(false);

  useEffect(() => {
    disposedRef.current = false;
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const startPolling = () => {
      if (pollTimer || disposedRef.current) {
        return;
      }

      pollTimer = setInterval(() => {
        void fetchDividends();
      }, POLL_INTERVAL_MS);
    };

    const connect = () => {
      if (disposedRef.current) return;

      eventSource?.close();
      eventSource = new EventSource(FINANCE_STREAM_PATH);

      eventSource.onopen = () => {
        reconnectAttemptRef.current = 0;
        stopPolling();
      };

      eventSource.onmessage = (messageEvent) => {
        const payload = parseStreamPayload(messageEvent.data);
        if (payload) {
          addLiveDistribution(payload);
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;

        if (disposedRef.current) return;

        const attempt = reconnectAttemptRef.current + 1;
        reconnectAttemptRef.current = attempt;

        if (attempt >= SSE_FAILURES_BEFORE_POLL) {
          startPolling();
        }

        const delay = Math.min(MAX_RECONNECT_DELAY_MS, 1_000 * 2 ** Math.min(attempt, 5));
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposedRef.current = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      stopPolling();
      eventSource?.close();
    };
  }, [addLiveDistribution, fetchDividends]);
}
