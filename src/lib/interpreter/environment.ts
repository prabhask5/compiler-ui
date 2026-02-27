/**
 * @fileoverview Scope model with global/nonlocal redirects for the Typed Python interpreter.
 *
 * Implements a stack-based scope chain that mirrors Python's LEGB
 * (Local, Enclosing, Global, Built-in) variable resolution rules.
 * Each function call pushes a new {@link Frame} onto the stack; `global`
 * and `nonlocal` declarations register redirect markers so that reads
 * and writes to those names skip the local frame and resolve in the
 * correct enclosing or global scope instead.
 *
 * **Why redirect sets instead of a simpler chain walk?**
 * Python's scoping requires that a `global x` declaration causes *all*
 * accesses to `x` in that function to go directly to the module-level
 * frame, bypassing any intermediate enclosing scopes. A plain chain walk
 * would find the nearest definition, which is incorrect for `global`.
 * The `nonlocals` set serves the analogous purpose for `nonlocal`
 * declarations, skipping the local frame but stopping before the global
 * frame.
 */

import type { Value } from './values';
import { noneVal } from './values';

/**
 * A single scope frame in the environment stack.
 *
 * Each function invocation creates a new frame that is pushed onto the
 * {@link Environment} stack. The frame holds its own local variables
 * plus sets of names that have been declared `global` or `nonlocal`,
 * which act as redirect markers during variable lookup and assignment.
 */
export interface Frame {
  /** Local variable bindings for this scope. */
  locals: Map<string, Value>;

  /**
   * Names declared with `global` — reads and writes for these names
   * bypass the entire scope chain and go directly to the global frame.
   */
  globals: Set<string>;

  /**
   * Names declared with `nonlocal` — reads and writes for these names
   * skip the local frame and resolve in the nearest enclosing (non-global)
   * frame that contains the name.
   */
  nonlocals: Set<string>;

  /**
   * Link to the enclosing scope frame, or `null` for the global frame.
   * Forms the chain that {@link Environment.get} walks during lookup.
   */
  parent: Frame | null;
}

/**
 * Stack-based variable environment implementing Python scope semantics.
 *
 * The environment maintains a pointer to the current (innermost) frame
 * and a separate pointer to the global frame. Variable operations
 * ({@link get}, {@link set}, {@link define}) consult the `globals` and
 * `nonlocals` redirect sets before falling back to the normal scope
 * chain walk.
 *
 * Typical lifecycle:
 * 1. Create an `Environment` (starts with a single global frame).
 * 2. Before executing a function body, call {@link pushFrame}.
 * 3. Register `global`/`nonlocal` redirects via {@link declareGlobal} / {@link declareNonlocal}.
 * 4. Bind parameters with {@link define}, execute statements using {@link get}/{@link set}.
 * 5. After the function returns, call {@link popFrame} to restore the caller's scope.
 */
export class Environment {
  /** The outermost (module-level) frame. Always at the bottom of the stack. */
  private globalFrame: Frame;

  /** The currently active (innermost) frame. */
  private currentFrame: Frame;

  /**
   * Creates a new environment with a single empty global frame.
   */
  constructor() {
    this.globalFrame = {
      locals: new Map(),
      globals: new Set(),
      nonlocals: new Set(),
      parent: null
    };
    this.currentFrame = this.globalFrame;
  }

  /**
   * Pushes a new empty frame onto the scope stack.
   *
   * Called at the start of every function invocation. The new frame's
   * `parent` points to the previous current frame, forming the chain
   * used for implicit closure capture during {@link get} lookups.
   */
  pushFrame(): void {
    const frame: Frame = {
      locals: new Map(),
      globals: new Set(),
      nonlocals: new Set(),
      parent: this.currentFrame
    };
    this.currentFrame = frame;
  }

  /**
   * Pops the current frame and restores the parent as the active scope.
   *
   * Called after a function body finishes executing. If already at the
   * global frame (no parent), this is a no-op — prevents underflow.
   */
  popFrame(): void {
    if (this.currentFrame.parent) {
      this.currentFrame = this.currentFrame.parent;
    }
  }

  /**
   * Marks a variable name as `global` in the current frame.
   *
   * After this call, all {@link get} and {@link set} operations for
   * `name` in the current frame will redirect to the global frame,
   * bypassing any intermediate enclosing scopes.
   *
   * @param name - The variable name to redirect to global scope.
   */
  declareGlobal(name: string): void {
    this.currentFrame.globals.add(name);
  }

  /**
   * Marks a variable name as `nonlocal` in the current frame.
   *
   * After this call, all {@link get} and {@link set} operations for
   * `name` in the current frame will resolve in the nearest enclosing
   * (non-global) frame that contains the name.
   *
   * @param name - The variable name to redirect to the enclosing scope.
   */
  declareNonlocal(name: string): void {
    this.currentFrame.nonlocals.add(name);
  }

  /**
   * Looks up a variable by name, respecting global/nonlocal redirects.
   *
   * Resolution order:
   * 1. If `name` is in the current frame's `globals` set, read from the global frame.
   * 2. If `name` is in the current frame's `nonlocals` set, walk parent frames
   *    (excluding global) via {@link findInParent}.
   * 3. Check the current frame's locals.
   * 4. Walk up the parent chain (implicit closure capture).
   * 5. Return `None` if not found anywhere.
   *
   * @param name - The variable name to resolve.
   * @returns The bound {@link Value}, or {@link noneVal | None} if unbound.
   */
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

  /**
   * Assigns a value to a variable, respecting global/nonlocal redirects.
   *
   * Resolution order mirrors {@link get}:
   * 1. If `name` is in the current frame's `globals` set, write to the global frame.
   * 2. If `name` is in the current frame's `nonlocals` set, write to the
   *    nearest enclosing frame via {@link setInParent}.
   * 3. Otherwise, write to the current frame's locals.
   *
   * @param name - The variable name to assign.
   * @param value - The {@link Value} to bind to the name.
   */
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

  /**
   * Defines a variable directly in the current frame's locals.
   *
   * Unlike {@link set}, this bypasses global/nonlocal redirect checks.
   * Used during function entry to bind parameter names and during
   * declaration processing to initialise local variables.
   *
   * @param name - The variable name to define.
   * @param value - The initial {@link Value} to bind.
   */
  define(name: string, value: Value): void {
    this.currentFrame.locals.set(name, value);
  }

  /**
   * Walks parent frames (excluding global) to find a nonlocal variable.
   *
   * @internal
   * @param name - The variable name to find.
   * @param frame - The starting parent frame to search from.
   * @returns The bound {@link Value}, or {@link noneVal | None} if not found.
   */
  private findInParent(name: string, frame: Frame | null): Value {
    while (frame && frame !== this.globalFrame) {
      if (frame.locals.has(name)) {
        return frame.locals.get(name)!;
      }
      frame = frame.parent;
    }
    return noneVal();
  }

  /**
   * Walks parent frames (excluding global) to assign a nonlocal variable.
   *
   * @internal
   * @param name - The variable name to assign.
   * @param value - The {@link Value} to write.
   * @param frame - The starting parent frame to search from.
   */
  private setInParent(name: string, value: Value, frame: Frame | null): void {
    while (frame && frame !== this.globalFrame) {
      if (frame.locals.has(name)) {
        frame.locals.set(name, value);
        return;
      }
      frame = frame.parent;
    }
  }

  /**
   * Checks whether the current frame is the global (module-level) frame.
   *
   * @returns `true` if the environment is at the top-level scope.
   */
  isGlobal(): boolean {
    return this.currentFrame === this.globalFrame;
  }

  /**
   * Captures a snapshot of all visible variables across the entire scope chain.
   *
   * Walks from the global frame up to the current frame, collecting every
   * local binding. Inner scopes override outer scopes (last-write-wins),
   * producing a flat map that reflects what the program "sees" at the
   * current execution point.
   *
   * Each value is deep-cloned via the provided `cloneFn` so the snapshot
   * is independent of future mutations.
   *
   * @param cloneFn - A function that deep-clones a {@link Value} (needed
   *   for mutable types like lists and objects).
   * @returns A flat map from variable name to cloned value.
   */
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

  /**
   * Produces a snapshot of all visible variables as display strings directly.
   *
   * Unlike {@link snapshotVariables}, this avoids deep-cloning intermediate
   * {@link Value} objects — it calls the provided display function on each
   * value in-place, which is much faster for step-mode UI updates.
   *
   * @param displayFn - A function that converts a {@link Value} to its
   *   string representation (e.g., `displayValue`).
   * @returns A flat map from variable name to display string.
   */
  snapshotDisplayStrings(displayFn: (v: Value) => string): Map<string, string> {
    const result = new Map<string, string>();
    const frames: Frame[] = [];
    let f: Frame | null = this.currentFrame;
    while (f) {
      frames.push(f);
      f = f.parent;
    }
    for (let i = frames.length - 1; i >= 0; i--) {
      for (const [name, val] of frames[i].locals) {
        result.set(name, displayFn(val));
      }
    }
    return result;
  }
}
