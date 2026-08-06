import { useEffect } from 'react';

/**
 * Locks/unlocks document.body scroll.
 * Automatically restores scroll on unmount.
 * @param locked - true to lock scroll, false to unlock
 */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none'; // Prevents iOS momentum scrolling

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [locked]);
}
