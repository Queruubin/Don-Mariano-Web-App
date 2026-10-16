import { create } from 'zustand';

/**
 * New-order chime (FR-30). Browsers keep audio locked until the user taps the
 * page, so the sound is "enabled" once (a remembered preference) and then
 * "unlocked" on every page load by a tap.
 */
export type AudioState = 'unsupported' | 'locked' | 'ready';

interface SoundState {
  /** The user asked for the sound (remembered in this browser). */
  enabled: boolean;
  audio: AudioState;
}

export const SOUND_PREFERENCE_KEY = 'don-mariano-new-order-sound';

type AudioContextClass = typeof AudioContext;

function audioContextClass(): AudioContextClass | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextClass }).webkitAudioContext;
}

function readPreference(): boolean {
  try {
    return localStorage.getItem(SOUND_PREFERENCE_KEY) === 'on';
  } catch {
    return false;
  }
}

function writePreference(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_PREFERENCE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Private mode or storage blocked: the preference lasts for this page only.
  }
}

let context: AudioContext | null = null;

function initialState(): SoundState {
  return { enabled: readPreference(), audio: audioContextClass() ? 'locked' : 'unsupported' };
}

export const useSoundStore = create<SoundState>(initialState);

/** Start over from the stored preference with a locked context (tests, new page load). */
export function resetSound(): void {
  void context?.close().catch(() => undefined);
  context = null;
  useSoundStore.setState(initialState());
}

function syncAudioState(): void {
  if (!context) return;
  useSoundStore.setState({ audio: context.state === 'running' ? 'ready' : 'locked' });
}

/**
 * Unlock audio. Call it from a tap or key press: browsers only allow audio after one.
 * `remember` also turns the preference on for the next visits.
 */
export async function unlockSound({ remember = true }: { remember?: boolean } = {}): Promise<boolean> {
  const AudioContextCtor = audioContextClass();
  if (!AudioContextCtor) return false;
  if (remember) {
    writePreference(true);
    useSoundStore.setState({ enabled: true });
  }
  try {
    if (!context) {
      context = new AudioContextCtor();
      context.onstatechange = syncAudioState;
    }
    if (context.state !== 'running') await context.resume();
  } catch {
    return false;
  } finally {
    syncAudioState();
  }
  return context?.state === 'running';
}

/** A short, soft two-note chime, synthesized (no audio file). */
function playChime(audio: AudioContext): void {
  const start = audio.currentTime;
  const notes: [frequency: number, offset: number][] = [
    [880, 0], // A5
    [1318.5, 0.18], // E6
  ];
  for (const [frequency, offset] of notes) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    const at = start + offset;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.35, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.7);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.75);
  }
}

/** Ring if the user enabled the sound and audio is unlocked. Returns whether it rang. */
export function playNewOrderSound(): boolean {
  if (!useSoundStore.getState().enabled || !context || context.state !== 'running') return false;
  try {
    playChime(context);
    return true;
  } catch {
    return false;
  }
}
