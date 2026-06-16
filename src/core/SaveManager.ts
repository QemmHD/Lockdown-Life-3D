// localStorage save/load. (IndexedDB / Capacitor Preferences are a later upgrade.)
const KEY = 'prison_sim_save_v1';

export const SaveManager = {
  has(): boolean { try { return !!localStorage.getItem(KEY); } catch { return false; } },
  save(data: unknown): boolean {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
  },
  load<T = any>(): T | null {
    try { const r = localStorage.getItem(KEY); return r ? (JSON.parse(r) as T) : null; } catch { return null; }
  },
  clear() { try { localStorage.removeItem(KEY); } catch {} }
};
