import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  /** One button next to the message ("Ver"); the toast closes when it is used. */
  action?: ToastAction;
}

export interface ToastOptions {
  action?: ToastAction;
  durationMs?: number;
}

interface ToastState {
  toasts: Toast[];
  show: (message: string, tone?: ToastTone, options?: ToastOptions) => number;
  dismiss: (id: number) => void;
}

export const TOAST_DURATION_MS = 5_000;
const MAX_TOASTS = 3;
let nextId = 1;

/** Short messages after an action ("Domicilio #0142 pasó a Alistando"). */
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (message, tone = 'info', { action, durationMs = TOAST_DURATION_MS } = {}) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, message, tone, action }].slice(-MAX_TOASTS) }));
    setTimeout(() => get().dismiss(id), durationMs);
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

/** Show a toast from outside React (mutation callbacks, socket events). */
export function showToast(message: string, tone: ToastTone = 'info', options?: ToastOptions): void {
  useToastStore.getState().show(message, tone, options);
}
