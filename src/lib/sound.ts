// src/lib/sound.ts
// Centralized Sound Manager — all game sounds in one place.
// Uses the Web Audio API to generate sounds programmatically (no audio files needed).

let audioCtx: AudioContext | null = null;
let enabled = true;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

export function setSoundEnabled(value: boolean) {
  enabled = value;
}

export function isSoundEnabled(): boolean {
  return enabled;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  gainValue = 0.3,
  fadeOut = true
) {
  if (!enabled) return;
  try {
    const ctx = getCtx();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    gainNode.gain.setValueAtTime(gainValue, ctx.currentTime);
    if (fadeOut) {
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    }

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch {
    // Silently fail if AudioContext is blocked
  }
}

/** Soft success chime — played on successful QR Scan */
export function playScanSuccess() {
  playTone(880, 0.1, 'sine', 0.25);
  setTimeout(() => playTone(1100, 0.15, 'sine', 0.2), 80);
}

/** Victory fanfare — played on successful Word Submission */
export function playVictory() {
  playTone(523, 0.12, 'sine', 0.3); // C5
  setTimeout(() => playTone(659, 0.12, 'sine', 0.3), 100); // E5
  setTimeout(() => playTone(784, 0.12, 'sine', 0.3), 200); // G5
  setTimeout(() => playTone(1047, 0.3, 'sine', 0.35), 300); // C6
}

/** Short error buzz — played on invalid word submission */
export function playError() {
  playTone(220, 0.15, 'sawtooth', 0.15);
  setTimeout(() => playTone(180, 0.15, 'sawtooth', 0.12), 120);
}

/** Soft whoosh — played when discarding a fragment */
export function playDiscard() {
  if (!enabled) return;
  try {
    const ctx = getCtx();
    const bufferSize = ctx.sampleRate * 0.2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(800, ctx.currentTime);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start();
  } catch {
    // Silently fail
  }
}
