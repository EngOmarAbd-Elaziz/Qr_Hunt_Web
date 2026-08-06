// src/lib/colors.ts

export const WORD_COLORS = [
  'var(--primary-color)', // Indigo
  'var(--accent-color)',  // Rose
  'var(--success-color)', // Emerald
  '#0ea5e9', // Sky
  '#a855f7', // Purple
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#8b5cf6', // Violet
  '#f97316', // Orange
];

/**
 * Returns a deterministic color string based on a UUID.
 * Useful for grouping fragments visually.
 */
export function getColorForWord(wordId: string): string {
  if (!wordId) return 'rgba(255,255,255,0.2)'; // fallback
  
  // Simple hash function for string
  let hash = 0;
  for (let i = 0; i < wordId.length; i++) {
    hash = wordId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % WORD_COLORS.length;
  return WORD_COLORS[index];
}
