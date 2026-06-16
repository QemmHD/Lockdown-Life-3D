// Tiny typed-ish pub/sub used to decouple sim systems from UI/render.
type Handler = (payload?: any) => void;

export class EventBus {
  private map = new Map<string, Set<Handler>>();
  on(type: string, fn: Handler) { (this.map.get(type) ?? this.map.set(type, new Set()).get(type)!).add(fn); return () => this.off(type, fn); }
  off(type: string, fn: Handler) { this.map.get(type)?.delete(fn); }
  emit(type: string, payload?: any) { this.map.get(type)?.forEach((fn) => fn(payload)); }
}
