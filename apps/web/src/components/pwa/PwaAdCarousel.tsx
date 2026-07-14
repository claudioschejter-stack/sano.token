'use client';

import { useEffect, useRef, useState } from 'react';
import type { MarketplaceListing } from '../../types/marketplace';
import { PwaPropertyCard } from './PwaPropertyCard';
import { MP_ACCENT } from '../../lib/pwa/mpTheme';

type Props = {
  listings: MarketplaceListing[];
  onSelect?: (listing: MarketplaceListing) => void;
  disabled?: boolean;
  soldBadgeLabel?: string;
  autoAdvanceMs?: number;
};

/**
 * Full-bleed, auto-advancing "ad style" carousel (à la Mercado Pago promos):
 * one large card visible at a time with a peek of the next slide, snap
 * scrolling, pagination dots, and a timer that keeps rotating unless the
 * user is actively touching/dragging the track.
 */
export function PwaAdCarousel({
  listings,
  onSelect,
  disabled = false,
  soldBadgeLabel,
  autoAdvanceMs = 4500
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(0);
  const isInteractingRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    activeIndexRef.current = 0;
    setActiveIndex(0);
    const track = trackRef.current;
    if (track) {
      track.scrollTo({ left: 0 });
    }
  }, [listings]);

  useEffect(() => {
    if (listings.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      const track = trackRef.current;
      if (!track || isInteractingRef.current) {
        return;
      }

      const nextIndex = (activeIndexRef.current + 1) % listings.length;
      const slide = track.children[nextIndex] as HTMLElement | undefined;
      if (slide) {
        track.scrollTo({
          left: slide.offsetLeft - track.offsetLeft,
          behavior: 'smooth'
        });
      }
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
    }, autoAdvanceMs);

    return () => clearInterval(interval);
  }, [listings.length, autoAdvanceMs]);

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    let closestIndex = 0;
    let closestDistance = Infinity;
    Array.from(track.children).forEach((child, index) => {
      const el = child as HTMLElement;
      const distance = Math.abs(el.offsetLeft - track.offsetLeft - track.scrollLeft);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    activeIndexRef.current = closestIndex;
    setActiveIndex(closestIndex);
  };

  const markInteracting = (value: boolean) => () => {
    isInteractingRef.current = value;
  };

  if (listings.length === 0) {
    return null;
  }

  return (
    <div>
      <div
        ref={trackRef}
        onScroll={handleScroll}
        onPointerDown={markInteracting(true)}
        onPointerUp={markInteracting(false)}
        onPointerCancel={markInteracting(false)}
        onPointerLeave={markInteracting(false)}
        className="hide-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1"
      >
        {listings.map((listing) => (
          <div key={listing.id} className="w-[86%] shrink-0 snap-center">
            {disabled ? (
              <div className="relative pointer-events-none opacity-75">
                <PwaPropertyCard listing={listing} variant="feed" />
                {soldBadgeLabel ? (
                  <span className="absolute right-3 top-3 rounded-full bg-slate-900/85 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                    {soldBadgeLabel}
                  </span>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                className="block w-full text-left"
                onClick={() => onSelect?.(listing)}
              >
                <PwaPropertyCard listing={listing} variant="feed" />
              </button>
            )}
          </div>
        ))}
      </div>

      {listings.length > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {listings.map((listing, index) => (
            <span
              key={listing.id}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: index === activeIndex ? 18 : 6,
                backgroundColor: index === activeIndex ? MP_ACCENT : '#CBD5E1'
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
