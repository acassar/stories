/**
 * Minimal typed event emitter.
 *
 * Neither `EventTarget` nor `EventEmitter` is used, on purpose: the first comes
 * from the DOM, the second from Node. The engine must run identically in a
 * browser, in Node, in a worker or in a test — without assuming anything about
 * its host.
 */

export type Listener<T> = (payload: T) => void;
export type Unsubscribe = () => void;

/**
 * `EventMap` maps each event name to the type of its payload. The constraint is
 * `object` rather than `Record<string, unknown>`: an `interface` has no implicit
 * index signature and would otherwise be rejected.
 */
export class Emitter<EventMap extends object> {
  private readonly listeners = new Map<keyof EventMap, Set<Listener<never>>>();

  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): Unsubscribe {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<never>);
    return () => this.off(event, listener);
  }

  /** Subscribes for a single firing. */
  once<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): Unsubscribe {
    const unsubscribe = this.on(event, (payload) => {
      unsubscribe();
      listener(payload);
    });
    return unsubscribe;
  }

  off<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): void {
    this.listeners.get(event)?.delete(listener as Listener<never>);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    // Copy: a listener may unsubscribe (or subscribe another) during emission.
    for (const listener of [...set]) {
      (listener as Listener<EventMap[K]>)(payload);
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }

  listenerCount(event: keyof EventMap): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
