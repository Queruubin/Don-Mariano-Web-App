import { BellRing } from 'lucide-react';
import { playNewOrderSound, unlockSound, useSoundStore } from '../../alerts/sound';

/**
 * Browsers block sound until the user taps the page (FR-30). The first time,
 * a clear banner asks to turn the sound on; on later visits a small button
 * unlocks it (any tap on the page does too).
 */
export function SoundPrompt() {
  const enabled = useSoundStore((s) => s.enabled);
  const audio = useSoundStore((s) => s.audio);

  if (audio === 'unsupported' || (audio === 'ready' && enabled)) return null;

  const activate = async () => {
    // Ring once so the user hears what a new order sounds like.
    if (await unlockSound()) playNewOrderSound();
  };

  if (enabled) {
    return (
      <button type="button" onClick={activate} className="btn btn-secondary mb-4 desk:mb-3 desk:text-sm">
        <BellRing aria-hidden="true" className="size-5 desk:size-4" />
        Toque para activar sonido
      </button>
    );
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-3xl border-2 border-accent bg-accent-soft p-4 desk:mb-3 desk:rounded-2xl desk:px-4 desk:py-2.5">
      <BellRing aria-hidden="true" className="size-8 shrink-0 text-text-muted desk:size-6" />
      <p className="min-w-48 flex-1 font-semibold desk:text-sm">
        Suena una campanita cuando otra persona registra un domicilio nuevo.
      </p>
      <button type="button" onClick={activate} className="btn btn-primary w-full sm:w-auto">
        Activar sonido de nuevos domicilios
      </button>
    </div>
  );
}
