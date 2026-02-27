/**
 * @fileoverview WASM Module Loader with Blob URL Strategy
 *
 * Handles loading and initializing the ChocoPy compiler WASM binary, exposing
 * a state machine ({@link WasmState}) that the UI can observe for loading indicators.
 *
 * Architecture note — why the Blob URL approach:
 *   The `wasm-pack`-generated JS glue code (`chocopy_wasm.js`) cannot be imported
 *   directly via standard `import` because Vite/Rollup would try to resolve and
 *   bundle it during the build. The glue code contains dynamic `fetch()` calls
 *   for the `.wasm` binary that assume specific relative paths — paths that break
 *   after Vite rewrites them. By fetching the JS glue as plain text, wrapping it
 *   in a `Blob`, and creating an `Object URL`, we bypass Vite's module graph
 *   entirely. The `@vite-ignore` comment on the dynamic `import()` prevents
 *   Rollup from warning about the non-analyzable import.
 *
 * Loading lifecycle:
 *   1. `idle`    — No load attempted yet.
 *   2. `loading` — Fetch + instantiation in progress.
 *   3. `ready`   — WASM exports available via {@link getWasm}.
 *   4. `error`   — Load failed; error message available via {@link getError}.
 *
 * This module is consumed by {@link compiler.ts}, which provides the public
 * high-level API ({@link compiler.compile | compile}, {@link compiler.parse | parse}, etc.).
 */

// ── WASM Export Interface ─────────────────────────────────────────────────────

/**
 * The typed interface for functions exported by the ChocoPy WASM module.
 *
 * Each function accepts a ChocoPy source string and returns a JSON-serialized
 * AST string. The JSON is deserialized into typed AST structures
 * ({@link types.CompileResult}, {@link types.Program}) by the caller.
 *
 * @internal Not exported — consumers use the high-level API in {@link compiler.ts}.
 */
interface WasmExports {
  /** Runs the full pipeline (parse + type-check) and returns JSON-serialized {@link types.CompileResult}. */
  compile: (source: string) => string;
  /** Runs only the parser and returns JSON-serialized {@link types.Program}. */
  parse: (source: string) => string;
  /** Runs parse + type-check and returns JSON-serialized typed {@link types.Program}. */
  typecheck: (source: string) => string;
}

// ── Module-Level State ────────────────────────────────────────────────────────

/** @internal Cached WASM module instance, or `null` if not yet loaded. */
let wasmModule: WasmExports | null = null;

/** @internal In-flight load promise for deduplication (prevents double-loading). */
let loadPromise: Promise<WasmExports> | null = null;

/** @internal Human-readable error message from the most recent failed load attempt. */
let loadError: string | null = null;

/**
 * The lifecycle states of the WASM loader.
 *
 * - `'idle'`    — Initial state; no load has been attempted.
 * - `'loading'` — The WASM binary is being fetched and instantiated.
 * - `'ready'`   — The module is loaded and exports are available.
 * - `'error'`   — Loading failed; call {@link getError} for details.
 */
export type WasmState = 'idle' | 'loading' | 'ready' | 'error';

/** @internal Set of registered state-change listener callbacks. */
const stateListeners: Set<(state: WasmState) => void> = new Set();

/** @internal The current loader state. */
let currentState: WasmState = 'idle';

/**
 * Updates the current state and notifies all registered listeners.
 *
 * @internal
 * @param state - The new {@link WasmState} to transition to.
 */
function setState(state: WasmState) {
  currentState = state;
  for (const listener of stateListeners) {
    listener(state);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Subscribes to WASM loader state changes.
 *
 * The listener is called immediately with the current state upon registration,
 * then again whenever the state transitions. Returns an unsubscribe function.
 *
 * @param listener - Callback invoked with the new {@link WasmState} on each transition.
 * @returns An unsubscribe function that removes the listener.
 *
 * @example
 * const unsubscribe = onStateChange((state) => {
 *   if (state === 'ready') console.log('Compiler loaded!');
 *   if (state === 'error') console.error('Load failed:', getError());
 * });
 * // Later: unsubscribe();
 */
export function onStateChange(listener: (state: WasmState) => void): () => void {
  stateListeners.add(listener);
  listener(currentState);
  return () => stateListeners.delete(listener);
}

/**
 * Returns the current WASM loader state.
 *
 * @returns The current {@link WasmState}.
 */
export function getState(): WasmState {
  return currentState;
}

/**
 * Returns the error message from the most recent failed load attempt.
 *
 * @returns The error message string, or `null` if no error has occurred.
 */
export function getError(): string | null {
  return loadError;
}

/**
 * Initializes the WASM compiler module by fetching and instantiating the binary.
 *
 * This function is idempotent: if the module is already loaded, it returns
 * immediately. If a load is already in progress, it returns the same promise
 * (deduplication). The loading uses a Blob URL strategy to bypass Vite's
 * module resolution — see the fileoverview for architectural details.
 *
 * @returns A promise that resolves to the {@link WasmExports} interface.
 * @throws If the JS glue code or WASM binary fails to fetch or instantiate.
 *         The error is also stored for retrieval via {@link getError}.
 */
export async function initWasm(): Promise<WasmExports> {
  if (wasmModule) return wasmModule;
  if (loadPromise) return loadPromise;

  setState('loading');

  loadPromise = (async () => {
    try {
      // Fetch the JS glue code as text and create a module from it
      // (Blob URL bypass — see @fileoverview for rationale)
      const jsResponse = await fetch('/wasm/chocopy_wasm.js');
      const jsText = await jsResponse.text();
      const blob = new Blob([jsText], { type: 'text/javascript' });
      const blobUrl = URL.createObjectURL(blob);

      // Dynamic import of the blob URL
      const mod = await import(/* @vite-ignore */ blobUrl);
      URL.revokeObjectURL(blobUrl);

      // Initialize WASM by passing the URL to the .wasm binary
      await mod.default('/wasm/chocopy_wasm_bg.wasm');

      wasmModule = {
        compile: mod.compile,
        parse: mod.parse,
        typecheck: mod.typecheck
      };

      setState('ready');
      console.log('WASM loaded successfully');
      return wasmModule;
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
      setState('error');
      console.error('WASM load failed:', e);
      throw e;
    }
  })();

  return loadPromise;
}

/**
 * Returns the loaded WASM module exports, or `null` if not yet initialized.
 *
 * This is a synchronous accessor — callers must ensure {@link initWasm} has
 * resolved before relying on a non-null return value.
 *
 * @returns The {@link WasmExports} interface, or `null` if the module is not loaded.
 */
export function getWasm(): WasmExports | null {
  return wasmModule;
}
