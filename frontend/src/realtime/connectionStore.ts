import { create } from 'zustand';

/**
 * - `connecting`: opening or re-opening the socket ("Reconectando…").
 * - `live`: authenticated and receiving events ("En vivo").
 * - `offline`: no socket for now; the board polls every 15s ("Sin conexión").
 */
export type ConnectionStatus = 'connecting' | 'live' | 'offline';

interface ConnectionState {
  status: ConnectionStatus;
  /** False while no socket should exist (logged out, no branch chosen). */
  active: boolean;
  setStatus: (status: ConnectionStatus) => void;
  setActive: (active: boolean) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'offline',
  active: false,
  setStatus: (status) => set({ status }),
  setActive: (active) => set(active ? { active } : { active, status: 'offline' }),
}));
