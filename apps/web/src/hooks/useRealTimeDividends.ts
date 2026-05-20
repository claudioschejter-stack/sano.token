'use client';

import { useEffect } from 'react';
import { useDividendStore, type LiveDistributionEvent } from '../store/useDividendStore';

const FINANCE_STREAM_PATH = '/api/v1/finance/stream';

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

  useEffect(() => {
    const eventSource = new EventSource(FINANCE_STREAM_PATH);

    eventSource.onmessage = (messageEvent) => {
      const payload = parseStreamPayload(messageEvent.data);
      if (payload) {
        addLiveDistribution(payload);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [addLiveDistribution]);
}
