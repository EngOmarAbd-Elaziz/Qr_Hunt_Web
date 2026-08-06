// src/lib/colors.ts

// 20 perceptually-distinct colors — hues are spread ~18° apart across the full wheel,
// with alternating brightness/saturation levels to maximize contrast between neighbours.
export const WORD_COLORS = [
  '#e63946', // 0.  GAME   – Vivid Red
  '#f4a261', // 1.  CODE   – Warm Orange
  '#f9c74f', // 2.  FIRE   – Bright Yellow
  '#90be6d', // 3.  STAR   – Lime Green
  '#43aa8b', // 4.  MOON   – Jade Teal
  '#4cc9f0', // 5.  WAVE   – Bright Cyan
  '#4361ee', // 6.  HOPE   – Royal Blue
  '#7b2d8b', // 7.  DOOR   – Deep Purple
  '#f72585', // 8.  DREAM  – Hot Magenta
  '#fb8500', // 9.  LIGHT  – Deep Amber
  '#06d6a0', // 10. SPACE  – Mint Green
  '#3a86ff', // 11. MAGIC  – Cobalt Blue
  '#ff6b6b', // 12. QUEST  – Coral
  '#c77dff', // 13. HEART  – Lavender
  '#ffbe0b', // 14. WORLD  – Golden Yellow
  '#8338ec', // 15. FLAME  – Electric Violet
  '#ff4d6d', // 16. PUZZLE – Deep Pink
  '#2ec4b6', // 17. SECRET – Turquoise
  '#80b918', // 18. FUTURE – Olive Green
  '#e040fb', // 19. HIDDEN – Neon Purple
];

// Map of known word UUIDs to guarantee 100% distinct colors for the 20 initial words
const KNOWN_WORDS: Record<string, number> = {
  'a95c64c0-8891-4d68-8f6c-81518d500d4a': 0,  // GAME
  '8ac80ead-6218-487d-bae4-169fa75a0ac3': 1,  // CODE
  'f1a9de98-9a41-495b-b301-728cf18baf01': 2,  // FIRE
  '4c08ea41-3023-4631-92cf-520e83cc7220': 3,  // STAR
  '2662774c-79ac-430d-948f-8e16649e2fa4': 4,  // MOON
  'be2f7c24-a12d-448c-b998-c63925b56dc9': 5,  // WAVE
  '3d64498c-7e74-40ea-8390-89a2096a5d9b': 6,  // HOPE
  'a710f1a8-954f-4e4b-80c6-f0376f236995': 7,  // DOOR
  '8df8114e-463c-4767-9e65-7a64da17fd8d': 8,  // DREAM
  '080e5049-c490-45a7-ba69-7c2c7ecb9470': 9,  // LIGHT
  '9e80141a-e9db-4095-913c-ff4f78ad2bf1': 10, // SPACE
  'fafcbf99-b827-44fd-afab-f73e0ac94071': 11, // MAGIC
  'e12ec223-59e4-443c-83e1-39e8c5fe9a4a': 12, // QUEST
  '22a0f069-1d6e-42a9-82af-8eb5317229bb': 13, // HEART
  '3fc8ff2b-4ca7-4025-a085-4cc409710f21': 14, // WORLD
  'cc814c03-7dd9-4dbf-95b4-35b700bda6d2': 15, // FLAME
  '349228fc-1012-4def-8885-68a7951582c1': 16, // PUZZLE
  'bca40eb7-73e8-4688-8508-2da9d8ea7440': 17, // SECRET
  '3ff30e9b-ffb5-4948-944d-6fc5e5f6008d': 18, // FUTURE
  'a07e8c7d-aee9-43f5-8539-90d4d51409e4': 19, // HIDDEN
};

/**
 * Returns a deterministic color string based on a UUID.
 * Useful for grouping fragments visually.
 */
export function getColorForWord(wordId: string): string {
  if (!wordId) return 'rgba(255,255,255,0.2)'; // fallback
  
  // Guarantee distinct colors for the default 20 words
  if (wordId in KNOWN_WORDS) {
    return WORD_COLORS[KNOWN_WORDS[wordId]];
  }
  
  // Simple hash function fallback for dynamically added words
  let hash = 0;
  for (let i = 0; i < wordId.length; i++) {
    hash = wordId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % WORD_COLORS.length;
  return WORD_COLORS[index];
}
