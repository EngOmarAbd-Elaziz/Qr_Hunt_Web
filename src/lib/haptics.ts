// src/lib/haptics.ts
// Centralized haptic feedback utility.
// Respects reduced-motion preferences and gracefully ignores unsupported browsers.

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function vibrate(pattern: number | number[]) {
  if (prefersReducedMotion()) return;
  if (!('vibrate' in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Silently fail on unsupported browsers
  }
}

/** Short pulse — on successful QR Scan */
export function vibrateSuccess() {
  vibrate(80);
}

/** Victory pulse — on successful Word Submission */
export function vibrateVictory() {
  vibrate([100, 40, 100]);
}

/** Error buzz — on invalid word submission */
export function vibrateError() {
  vibrate(150);
}
