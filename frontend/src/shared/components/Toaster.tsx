import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { useToastStore, type ToastTone } from '../toast/toastStore';

const TONES: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: { icon: CircleCheck, className: 'border-primary bg-primary-soft text-primary-hover' },
  error: { icon: CircleAlert, className: 'border-danger bg-danger-soft text-danger' },
  info: { icon: Info, className: 'border-border bg-surface text-text' },
};

/** Toast stack, above the phone bottom bar. Errors are announced assertively. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6 print:hidden">
      {toasts.map(({ id, message, tone }) => {
        const { icon: Icon, className } = TONES[tone];
        return (
          <div
            key={id}
            role={tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border-2 px-4 py-2 font-bold shadow-lg ${className}`}
          >
            <Icon aria-hidden="true" className="size-6 shrink-0" />
            <p className="flex-1">{message}</p>
            <button type="button" className="btn btn-ghost min-h-12 shrink-0 px-3" onClick={() => dismiss(id)} aria-label="Cerrar aviso">
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
