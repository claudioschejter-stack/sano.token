import type { BestBorrowRateResponse } from '../../types/marketplace';
import { fetchLiveBorrowRates } from './fetchLiveBorrowRates';

export async function fetchBestBorrowRate(): Promise<BestBorrowRateResponse | null> {
  try {
    return await fetchLiveBorrowRates();
  } catch (error) {
    console.error('[lending] fetchBestBorrowRate failed', error);
    return null;
  }
}
