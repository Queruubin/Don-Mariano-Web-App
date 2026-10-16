import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastState {
  toasts: Toast[];
  show: (message: string, tone?: ToastTone) => number;
  dismiss: (id: number) => void;
}

export const TOAST_DURATION_MS = 5_000;
const MAX_TOASTS = 3;
let nextId = 1;

/** Short messages after an action ("Domicilio #0142 pasó a Alistando"). */
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (message, tone = 'info') => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }].slice(-MAX_TOASTS) }));
    setTimeout(() => get().dismiss(id), TOAST_DURATION_MS);
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

/** Show a toast from outside React (mutation callbacks). */
export function showToast(message: string, tone: ToastTone = 'info'): void {
  useToastStore.getState().show(message, tone);
}
