import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Sticky action row at the bottom. */
  footer?: ReactNode;
  size?: 'md' | 'lg';
}

/**
 * Accessible dialog: full-screen sheet on phones, centered card on tablet and desktop.
 * Escape closes it and focus moves inside on open and back on close.
 */
export function Modal({ title, onClose, children, footer, size = 'md' }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const firstField = panel?.querySelector<HTMLElement>('input, select, textarea');
    (firstField ?? panel)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-text/50 sm:items-center sm:p-6">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`flex max-h-dvh w-full flex-col bg-surface sm:max-h-[90dvh] sm:rounded-3xl sm:shadow-xl ${size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-xl'}`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
          <h2 id={titleId} className="text-xl">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="btn btn-ghost px-3" aria-label="Cerrar">
            <X aria-hidden="true" className="size-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-3 border-t border-border px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}
