import type { Renderable, RootRenderable } from "./renderable";
import type { KeyEvent } from "./renderer";

export class FocusManager {
  private readonly root: RootRenderable;
  private _focused: Renderable | null = null;

  constructor(root: RootRenderable) {
    this.root = root;
  }

  get focused(): Renderable | null {
    this.invalidateDetachedFocus();
    return this._focused;
  }

  focus(renderable: Renderable): boolean {
    this.invalidateDetachedFocus();
    if (!this.canFocus(renderable)) {
      return false;
    }
    if (renderable === this._focused) {
      return true;
    }

    this._focused?._blur();
    this._focused = renderable;
    renderable._focus();
    return true;
  }

  blur(): void {
    this.invalidateDetachedFocus();
    this._focused?._blur();
    this._focused = null;
  }

  focusNext(): Renderable | null {
    return this.focusByOffset(1);
  }

  focusPrevious(): Renderable | null {
    return this.focusByOffset(-1);
  }

  dispatchKey(event: KeyEvent): void {
    this.invalidateDetachedFocus();
    this._focused?._handleKey(event);
    if (event.defaultPrevented) {
      return;
    }
    if (event.key.toLowerCase() !== "tab") {
      return;
    }

    if (event.modifiers.shift) {
      this.focusPrevious();
    } else {
      this.focusNext();
    }
    event.preventDefault();
    event.stopPropagation();
  }

  firstFocusable(): Renderable | null {
    return this.focusableRenderables()[0] ?? null;
  }

  private focusByOffset(offset: 1 | -1): Renderable | null {
    this.invalidateDetachedFocus();
    const focusable = this.focusableRenderables();
    if (focusable.length === 0) {
      this.blur();
      return null;
    }

    const currentIndex = this.currentFocusIndex(focusable, offset);
    const nextIndex =
      (currentIndex + offset + focusable.length) % focusable.length;
    const next = focusable[nextIndex];
    if (!next) {
      return null;
    }

    this.focus(next);
    return next;
  }

  private focusableRenderables(): Renderable[] {
    return walkTree(this.root).filter(
      (renderable) => renderable.focusable && !renderable.disabled
    );
  }

  private currentFocusIndex(focusable: Renderable[], offset: 1 | -1): number {
    if (this._focused) {
      return focusable.indexOf(this._focused);
    }
    if (offset === 1) {
      return -1;
    }
    return 0;
  }

  private canFocus(renderable: Renderable): boolean {
    return (
      renderable.focusable &&
      !renderable.disabled &&
      (renderable === this.root || isDescendantOf(renderable, this.root))
    );
  }

  private invalidateDetachedFocus(): void {
    if (!this._focused) {
      return;
    }
    if (
      this._focused.focused &&
      this._focused.focusable &&
      !this._focused.disabled &&
      (this._focused === this.root || isDescendantOf(this._focused, this.root))
    ) {
      return;
    }

    this._focused._blur();
    this._focused = null;
  }
}

function walkTree(root: Renderable): Renderable[] {
  return [root, ...root.children.flatMap((child) => walkTree(child))];
}

function isDescendantOf(renderable: Renderable, root: Renderable): boolean {
  if (renderable.parent === null) {
    return false;
  }
  if (renderable.parent === root) {
    return true;
  }
  return isDescendantOf(renderable.parent, root);
}
