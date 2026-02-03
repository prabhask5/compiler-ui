interface WasmExports {
  compile: (source: string) => string;
  parse: (source: string) => string;
  typecheck: (source: string) => string;
}

let wasmModule: WasmExports | null = null;
let loadPromise: Promise<WasmExports> | null = null;
let loadError: string | null = null;

export type WasmState = 'idle' | 'loading' | 'ready' | 'error';

const stateListeners: Set<(state: WasmState) => void> = new Set();
let currentState: WasmState = 'idle';

function setState(state: WasmState) {
  currentState = state;
  for (const listener of stateListeners) {
    listener(state);
  }
}

export function onStateChange(listener: (state: WasmState) => void): () => void {
  stateListeners.add(listener);
  listener(currentState);
  return () => stateListeners.delete(listener);
}

export function getState(): WasmState {
  return currentState;
}

export function getError(): string | null {
  return loadError;
}

export async function initWasm(): Promise<WasmExports> {
  if (wasmModule) return wasmModule;
  if (loadPromise) return loadPromise;

  setState('loading');

  loadPromise = (async () => {
    try {
      // Fetch the JS glue code as text and create a module from it
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

export function getWasm(): WasmExports | null {
  return wasmModule;
}
