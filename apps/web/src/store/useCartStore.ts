'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CartItem = {
  projectId: string;
  title: string;
  location: string;
  imageUrl: string;
  pricePerTokenUsd: number;
  tokenCount: number;
  availableTokens: number;
  tokenSymbol?: string | null;
};

/**
 * The batch the cart was handed over to, remembered until it is known settled.
 *
 * Clearing used to happen only in the callback of the tab that paid. Reload it,
 * switch tabs, or finish through a path that resolves server-side, and the paid
 * item stayed in the cart looking unpaid — which invites buying it twice. This
 * is what lets the next load ask the server how that batch ended.
 */
export type CommittedCartBatch = {
  batchId: string;
  projectIds: string[];
};

type CartState = {
  items: CartItem[];
  committedBatch: CommittedCartBatch | null;
  addItem: (item: Omit<CartItem, 'tokenCount'> & { tokenCount?: number }) => void;
  removeItem: (projectId: string) => void;
  setTokenCount: (projectId: string, tokenCount: number) => void;
  clearCart: () => void;
  commitBatch: (batchId: string, projectIds: string[]) => void;
  /** Drop what that batch paid for, keeping anything added afterwards. */
  settleCommittedBatch: (batchId: string) => void;
  reconcileInventory: (
    rows: Array<{ projectId: string; availableTokens: number; pricePerTokenUsd: number }>
  ) => void;
  totalUsd: () => number;
  itemCount: () => number;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      committedBatch: null,
      addItem: (item) => {
        const tokenCount = Math.max(1, Math.min(item.tokenCount ?? 1, item.availableTokens));
        set((state) => {
          const existing = state.items.find((row) => row.projectId === item.projectId);
          if (existing) {
            const nextCount = Math.min(existing.tokenCount + tokenCount, item.availableTokens);
            return {
              items: state.items.map((row) =>
                row.projectId === item.projectId ? { ...row, ...item, tokenCount: nextCount } : row
              )
            };
          }
          return {
            items: [...state.items, { ...item, tokenCount }]
          };
        });
      },
      removeItem: (projectId) => {
        set((state) => ({ items: state.items.filter((row) => row.projectId !== projectId) }));
      },
      setTokenCount: (projectId, tokenCount) => {
        set((state) => ({
          items: state.items.map((row) => {
            if (row.projectId !== projectId) {
              return row;
            }
            const next = Math.max(1, Math.min(tokenCount, row.availableTokens));
            return { ...row, tokenCount: next };
          })
        }));
      },
      clearCart: () => set({ items: [], committedBatch: null }),
      commitBatch: (batchId, projectIds) => set({ committedBatch: { batchId, projectIds } }),
      settleCommittedBatch: (batchId) => {
        set((state) => {
          if (state.committedBatch?.batchId !== batchId) {
            return state;
          }
          /**
           * Only what that batch paid for. Buying one more of something you
           * already own is a normal thing to do, so an item added after the
           * handover has to survive.
           */
          const paid = new Set(state.committedBatch.projectIds);
          return {
            items: state.items.filter((row) => !paid.has(row.projectId)),
            committedBatch: null
          };
        });
      },
      reconcileInventory: (rows) => {
        const byProject = new Map(rows.map((row) => [row.projectId, row]));
        set((state) => {
          const nextItems = state.items
            .map((item) => {
              const fresh = byProject.get(item.projectId);
              if (!fresh) {
                return item;
              }
              const availableTokens = Math.max(0, fresh.availableTokens);
              const tokenCount = Math.min(item.tokenCount, Math.max(1, availableTokens));
              return {
                ...item,
                availableTokens,
                pricePerTokenUsd: fresh.pricePerTokenUsd,
                tokenCount: availableTokens > 0 ? tokenCount : 0
              };
            })
            .filter((item) => item.availableTokens > 0 && item.tokenCount > 0);

          return { items: nextItems };
        });
      },
      totalUsd: () =>
        get().items.reduce((sum, row) => sum + row.pricePerTokenUsd * row.tokenCount, 0),
      itemCount: () => get().items.reduce((sum, row) => sum + row.tokenCount, 0)
    }),
    { name: 'sanova-marketplace-cart' }
  )
);
