/**
 * @fileoverview High-Level WASM Compiler API
 *
 * Provides the public interface for invoking the ChocoPy compiler from TypeScript.
 * Each function delegates to the corresponding WASM export via {@link wasm-loader},
 * handling initialization, JSON deserialization, and error recovery.
 *
 * Architecture note:
 *   The Rust compiler is compiled to WebAssembly and exposes three entry points
 *   (`compile`, `parse`, `typecheck`), each accepting a source string and returning
 *   a JSON-serialized AST. This module wraps those raw string-in/string-out calls
 *   with proper TypeScript types ({@link CompileResult}, {@link Program}) and
 *   null-safe error handling. Callers should await {@link ensureReady} before
 *   invoking any synchronous compiler function.
 *
 * Usage:
 *   1. Call {@link ensureReady} once at app startup (loads the WASM binary).
 *   2. Call {@link compile}, {@link parse}, or {@link typecheck} synchronously.
 *
 * @example
 * await ensureReady();
 * const result = compile("x: int = 1\nprint(x)");
 * if (result && !result.hasErrors) {
 *   console.log(result.typedAst);
 * }
 */

import { initWasm, getWasm } from './wasm-loader';
import type { CompileResult, Program } from './types';

// ── Initialization ────────────────────────────────────────────────────────────

/**
 * Ensures the WASM compiler module is loaded and ready for use.
 *
 * This must be called (and awaited) before any synchronous compiler function
 * ({@link compile}, {@link parse}, {@link typecheck}). Subsequent calls are
 * no-ops — the WASM module is loaded only once via {@link initWasm}.
 *
 * @returns A promise that resolves when the WASM module is initialized.
 * @throws If the WASM binary fails to fetch or instantiate (network error,
 *         corrupt binary, etc.). The error is also surfaced via
 *         {@link wasm-loader.getError | getError()} and the state listener.
 */
export async function ensureReady(): Promise<void> {
  await initWasm();
}

// ── Compiler Entry Points ─────────────────────────────────────────────────────

/**
 * Runs the full compiler pipeline (parse + type-check) on ChocoPy source code.
 *
 * Returns a {@link CompileResult} containing both the untyped AST (from parsing)
 * and the typed AST (after type checking), along with aggregated errors.
 *
 * @param source - The ChocoPy source code string to compile.
 * @returns The {@link CompileResult} with both ASTs and error info, or `null`
 *          if the WASM module is not loaded or an unexpected error occurs.
 *
 * @example
 * const result = compile("x: int = 1\nprint(x)");
 * if (result && !result.hasErrors) {
 *   // result.typedAst has inferred types on every expression node
 * }
 */
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

/**
 * Runs only the parser on ChocoPy source code, without type checking.
 *
 * Returns a {@link Program} AST where expression nodes have no `inferredType`.
 * Useful for displaying the raw parse tree before semantic analysis.
 *
 * @param source - The ChocoPy source code string to parse.
 * @returns The parsed {@link Program} AST, or `null` if the WASM module is not
 *          loaded or an unexpected error occurs.
 *
 * @example
 * const ast = parse("x = 1 + 2");
 * // ast.statements[0] is an AssignStmt with no inferredType on sub-expressions
 */
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

/**
 * Runs the parser and type checker on ChocoPy source code.
 *
 * Returns a {@link Program} AST with `inferredType` populated on expression nodes.
 * Unlike {@link compile}, this returns only the typed AST (not the untyped one).
 *
 * @param source - The ChocoPy source code string to type-check.
 * @returns The type-checked {@link Program} AST, or `null` if the WASM module
 *          is not loaded or an unexpected error occurs.
 *
 * @example
 * const ast = typecheck("x: int = 1\nprint(x)");
 * // Expression nodes now have inferredType set
 */
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
