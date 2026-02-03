import { initWasm, getWasm } from './wasm-loader';
import type { CompileResult, Program } from './types';

export async function ensureReady(): Promise<void> {
  await initWasm();
}

export function compile(source: string): CompileResult | null {
  const wasm = getWasm();
  if (!wasm) return null;

  try {
    const json = wasm.compile(source);
    return JSON.parse(json) as CompileResult;
  } catch (e) {
    console.error('Compilation error:', e);
    return null;
  }
}

export function parse(source: string): Program | null {
  const wasm = getWasm();
  if (!wasm) return null;

  try {
    const json = wasm.parse(source);
    return JSON.parse(json) as Program;
  } catch (e) {
    console.error('Parse error:', e);
    return null;
  }
}

export function typecheck(source: string): Program | null {
  const wasm = getWasm();
  if (!wasm) return null;

  try {
    const json = wasm.typecheck(source);
    return JSON.parse(json) as Program;
  } catch (e) {
    console.error('Typecheck error:', e);
    return null;
  }
}
