import type { Value } from './values';
import { noneVal } from './values';

export interface Frame {
  locals: Map<string, Value>;
  globals: Set<string>;
  nonlocals: Set<string>;
  parent: Frame | null;
}

export class Environment {
  private globalFrame: Frame;
  private currentFrame: Frame;

  constructor() {
    this.globalFrame = {
      locals: new Map(),
      globals: new Set(),
      nonlocals: new Set(),
      parent: null
    };
    this.currentFrame = this.globalFrame;
  }

  pushFrame(): void {
    const frame: Frame = {
      locals: new Map(),
      globals: new Set(),
      nonlocals: new Set(),
      parent: this.currentFrame
    };
    this.currentFrame = frame;
  }

  popFrame(): void {
    if (this.currentFrame.parent) {
      this.currentFrame = this.currentFrame.parent;
    }
  }

  declareGlobal(name: string): void {
    this.currentFrame.globals.add(name);
  }

  declareNonlocal(name: string): void {
    this.currentFrame.nonlocals.add(name);
  }

  get(name: string): Value {
    // Check if it's a global redirect
    if (this.currentFrame.globals.has(name)) {
      return this.globalFrame.locals.get(name) ?? noneVal();
    }

    // Check if it's a nonlocal redirect
    if (this.currentFrame.nonlocals.has(name)) {
      return this.findInParent(name, this.currentFrame.parent);
    }

    // Check local scope first
    if (this.currentFrame.locals.has(name)) {
      return this.currentFrame.locals.get(name)!;
    }

    // Walk up for implicit closure captures (if in nested function)
    let frame = this.currentFrame.parent;
    while (frame) {
      if (frame.locals.has(name)) {
        return frame.locals.get(name)!;
      }
      frame = frame.parent;
    }

    return noneVal();
  }

  set(name: string, value: Value): void {
    // Check if it's a global redirect
    if (this.currentFrame.globals.has(name)) {
      this.globalFrame.locals.set(name, value);
      return;
    }

    // Check if it's a nonlocal redirect
    if (this.currentFrame.nonlocals.has(name)) {
      this.setInParent(name, value, this.currentFrame.parent);
      return;
    }

    // Set in current frame
    this.currentFrame.locals.set(name, value);
  }

  define(name: string, value: Value): void {
    this.currentFrame.locals.set(name, value);
  }

  private findInParent(name: string, frame: Frame | null): Value {
    while (frame && frame !== this.globalFrame) {
      if (frame.locals.has(name)) {
        return frame.locals.get(name)!;
      }
      frame = frame.parent;
    }
    return noneVal();
  }

  private setInParent(name: string, value: Value, frame: Frame | null): void {
    while (frame && frame !== this.globalFrame) {
      if (frame.locals.has(name)) {
        frame.locals.set(name, value);
        return;
      }
      frame = frame.parent;
    }
  }

  isGlobal(): boolean {
    return this.currentFrame === this.globalFrame;
  }

  snapshotVariables(cloneFn: (v: Value) => Value): Map<string, Value> {
    const result = new Map<string, Value>();
    // Collect from all frames, starting from global
    const frames: Frame[] = [];
    let f: Frame | null = this.currentFrame;
    while (f) {
      frames.push(f);
      f = f.parent;
    }
    // Walk from global (bottom) to current (top) so inner scopes override
    for (let i = frames.length - 1; i >= 0; i--) {
      for (const [name, val] of frames[i].locals) {
        result.set(name, cloneFn(val));
      }
    }
    return result;
  }
}
