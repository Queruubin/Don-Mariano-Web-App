import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playNewOrderSound, resetSound, SOUND_PREFERENCE_KEY, unlockSound } from '../../alerts/sound';
import { SoundPrompt } from './SoundPrompt';

/** Minimal Web Audio stand-in: starts suspended, like a browser before any tap. */
class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: AudioContextState = 'suspended';
  currentTime = 0;
  destination = {};
  onstatechange: (() => void) | null = null;
  oscillators = 0;

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  resume = vi.fn(async () => {
    this.state = 'running';
    this.onstatechange?.();
  });

  close = vi.fn(async () => undefined);

  createOscillator() {
    this.oscillators += 1;
    return { type: 'sine', frequency: { value: 0 }, connect: (node: unknown) => node, start: vi.fn(), stop: vi.fn() };
  }

  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: (node: unknown) => node,
    };
  }
}

beforeEach(() => {
  FakeAudioContext.instances = [];
  vi.stubGlobal('AudioContext', FakeAudioContext);
  resetSound();
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetSound();
});

describe('SoundPrompt', () => {
  it('asks once to turn the sound on, rings to confirm and remembers it', async () => {
    const user = userEvent.setup();
    render(<SoundPrompt />);

    await user.click(screen.getByRole('button', { name: 'Activar sonido de nuevos domicilios' }));

    await waitFor(() => expect(screen.queryByRole('button')).not.toBeInTheDocument());
    expect(localStorage.getItem(SOUND_PREFERENCE_KEY)).toBe('on');
    expect(FakeAudioContext.instances[0].oscillators).toBeGreaterThan(0);
  });

  it('on a later visit offers a small button to unlock the sound', async () => {
    localStorage.setItem(SOUND_PREFERENCE_KEY, 'on');
    resetSound();
    const user = userEvent.setup();
    render(<SoundPrompt />);

    expect(screen.queryByText(/Activar sonido de nuevos domicilios/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Toque para activar sonido' }));

    await waitFor(() => expect(screen.queryByRole('button')).not.toBeInTheDocument());
  });

  it('shows nothing when the browser has no Web Audio', () => {
    vi.stubGlobal('AudioContext', undefined);
    resetSound();
    const { container } = render(<SoundPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('keeps working when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(await unlockSound()).toBe(true);
    expect(playNewOrderSound()).toBe(true);
    vi.restoreAllMocks();
  });
});

describe('playNewOrderSound', () => {
  it('stays silent until the sound is enabled and unlocked', async () => {
    expect(playNewOrderSound()).toBe(false);
    await unlockSound();
    expect(playNewOrderSound()).toBe(true);
  });
});
