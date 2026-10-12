import { useEffect } from "react";

/**
 * Handles mouse wheel events on horizontal tab bars or horizontal scroll containers.
 * Converts vertical wheel movement (deltaY) into horizontal scroll (scrollLeft).
 * Prevents default event bubbling so background containers and page do NOT scroll.
 */
export function handleHorizontalWheel(e) {
  if (!e) return;
  const container = e.currentTarget || e.target?.closest?.(".tabs-horizontal-scroll, [data-horizontal-tabs]");
  if (!container) return;
  
  const deltaX = typeof e.deltaX === "number" ? e.deltaX : 0;
  const deltaY = typeof e.deltaY === "number" ? e.deltaY : 0;

  // If user is scrolling with mouse wheel or trackpad
  if (Math.abs(deltaY) > 0 || Math.abs(deltaX) > 0) {
    const scrollAmount = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
    
    // Always stop default browser action and bubbling so the background container NEVER scrolls
    if (typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    if (typeof e.stopPropagation === "function") {
      e.stopPropagation();
    }
    
    const maxScroll = container.scrollWidth - container.clientWidth;
    if (maxScroll > 0) {
      container.scrollLeft = Math.max(0, Math.min(maxScroll, container.scrollLeft + scrollAmount));
    }
  }
}

/**
 * Isolates scroll events so they do not propagate to parent/background scroll containers.
 */
export function isolateScroll(e) {
  if (!e) return;
  if (typeof e.stopPropagation === "function") {
    e.stopPropagation();
  }
  
  const container = e.currentTarget || e.target?.closest?.(".tabs-scroll-isolated, .scroll-isolated");
  if (!container) return;

  // If wheel event at container boundary, prevent default so parent view does not scroll
  if (typeof e.deltaY === "number") {
    const isAtTop = container.scrollTop <= 0;
    const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1;
    
    if ((e.deltaY < 0 && isAtTop) || (e.deltaY > 0 && isAtBottom)) {
      if (typeof e.preventDefault === "function") {
        e.preventDefault();
      }
    }
  }
}

/**
 * Hook to lock body and background scroll when a modal, overlay, or drawer is active.
 * Restores original scroll behavior upon unmount or closing.
 */
export function useLockBodyScroll(isLocked) {
  useEffect(() => {
    if (!isLocked) return;
    
    const originalOverflow = document.body.style.overflow;
    const originalOverscroll = document.body.style.overscrollBehavior;
    
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "contain";
    
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscroll;
    };
  }, [isLocked]);
}

/**
 * Global window-level listener in capture phase with { passive: false } to guarantee
 * that any wheel or touch gesture over .tabs-horizontal-scroll or .tabs-scroll-isolated
 * will NEVER trigger background scroll chaining in any modern browser.
 */
export function initGlobalScrollIsolation() {
  if (typeof window === "undefined" || window._dermaScrollIsolationInitialized) return;
  window._dermaScrollIsolationInitialized = true;

  window.addEventListener(
    "wheel",
    (e) => {
      // 1. Check for horizontal tabs container
      const tabsHorizontal = e.target?.closest?.(".tabs-horizontal-scroll, [data-horizontal-tabs]");
      if (tabsHorizontal) {
        const deltaX = typeof e.deltaX === "number" ? e.deltaX : 0;
        const deltaY = typeof e.deltaY === "number" ? e.deltaY : 0;
        
        if (Math.abs(deltaY) > 0 || Math.abs(deltaX) > 0) {
          const scrollAmount = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
          
          // Completely cancel page/background scroll
          e.preventDefault();
          e.stopPropagation();
          
          const maxScroll = tabsHorizontal.scrollWidth - tabsHorizontal.clientWidth;
          if (maxScroll > 0) {
            tabsHorizontal.scrollLeft = Math.max(0, Math.min(maxScroll, tabsHorizontal.scrollLeft + scrollAmount));
          }
        }
        return;
      }

      // 2. Check for isolated scroll containers (e.g. sidebars or modals)
      const tabsIsolated = e.target?.closest?.(".tabs-scroll-isolated, .scroll-isolated");
      if (tabsIsolated) {
        const isAtTop = tabsIsolated.scrollTop <= 0;
        const isAtBottom = tabsIsolated.scrollTop + tabsIsolated.clientHeight >= tabsIsolated.scrollHeight - 1;
        
        if ((e.deltaY < 0 && isAtTop) || (e.deltaY > 0 && isAtBottom)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    },
    { passive: false, capture: true }
  );
}

// Auto-initialize when loaded
initGlobalScrollIsolation();
