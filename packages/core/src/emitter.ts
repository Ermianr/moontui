export class TypedEmitter<Events extends { [K in keyof Events]: unknown[] }> {
  private readonly _handlers = new Map<
    keyof Events,
    // biome-ignore lint/suspicious/noExplicitAny: handler storage for generic event types
    Set<(...args: any[]) => void>
  >();

  on<K extends keyof Events>(
    event: K,
    handler: (...args: Events[K]) => void
  ): void {
    let set = this._handlers.get(event);
    if (!set) {
      set = new Set();
      this._handlers.set(event, set);
    }
    set.add(handler);
  }

  off<K extends keyof Events>(
    event: K,
    handler: (...args: Events[K]) => void
  ): void {
    this._handlers.get(event)?.delete(handler);
  }

  emit<K extends keyof Events>(event: K, ...args: Events[K]): void {
    const set = this._handlers.get(event);
    if (set) {
      for (const handler of set) {
        handler(...args);
      }
    }
  }
}
