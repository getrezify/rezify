"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<void>; children: ReactNode }) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const THRESHOLD = 70;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      if (el!.scrollTop === 0) startY.current = e.touches[0].clientY;
      else startY.current = 0;
    }

    function onTouchMove(e: TouchEvent) {
      if (!startY.current) return;
      const dist = e.touches[0].clientY - startY.current;
      if (dist > 0 && el!.scrollTop === 0) {
        setPulling(true);
        setPullDistance(Math.min(dist * 0.5, THRESHOLD + 20));
      }
    }

    async function onTouchEnd() {
      if (pullDistance >= THRESHOLD) {
        setRefreshing(true);
        setPullDistance(0);
        setPulling(false);
        if ("vibrate" in navigator) navigator.vibrate(15);
        await onRefresh();
        setRefreshing(false);
      } else {
        setPulling(false);
        setPullDistance(0);
      }
      startY.current = 0;
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullDistance, onRefresh]);

  return (
    <div ref={containerRef} className="h-full overflow-y-auto">
      {(pulling || refreshing) && (
        <div className="flex justify-center pt-2 pb-0 transition-all" style={{ height: pulling ? pullDistance : refreshing ? 48 : 0 }}>
          <div className={`flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface ${refreshing ? "animate-spin" : ""}`}
            style={{ transform: pulling ? `rotate(${(pullDistance / THRESHOLD) * 180}deg)` : undefined }}>
            <svg className="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0 1 15-4.5M20 15a9 9 0 0 1-15 4.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
