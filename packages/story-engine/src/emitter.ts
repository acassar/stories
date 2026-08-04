/**
 * Emetteur d'evenements minimal et type.
 *
 * On n'utilise volontairement ni `EventTarget` ni `EventEmitter` : le premier
 * vient du DOM, le second de Node. Le moteur doit tourner a l'identique dans un
 * navigateur, dans Node, dans un worker ou dans un test — sans rien supposer de
 * son hote.
 */

export type Listener<T> = (payload: T) => void;
export type Unsubscribe = () => void;

/** `EventMap` associe chaque nom d'evenement au type de sa charge utile. */
export class Emitter<EventMap extends Record<string, unknown>> {
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

  /** S'abonne pour un seul declenchement. */
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
    // Copie : un abonne peut se desabonner (ou en abonner un autre) pendant l'emission.
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
