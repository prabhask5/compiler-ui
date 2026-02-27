/**
 * @fileoverview Built-in function implementations for the Typed Python interpreter.
 *
 * Provides the runtime behaviour for Python built-in functions (`print`,
 * `input`, `len`) that are recognised by name inside
 * {@link interpret | the interpreter's callFunction path}. Each built-in
 * validates its argument count, delegates I/O through the {@link IOHandler}
 * abstraction, and returns an appropriate {@link Value}.
 *
 * The {@link IOHandler} interface decouples the interpreter from any specific
 * I/O mechanism (browser console, REPL panel, test harness, etc.), making the
 * interpreter fully testable and embeddable in different UI contexts.
 */

import type { Value } from './values';
import { intVal, strVal, noneVal, displayValue } from './values';

/**
 * Abstraction layer for interpreter I/O operations.
 *
 * The interpreter never writes to `console` or reads from `stdin` directly;
 * instead it calls these callbacks so the hosting environment can route
 * output to a UI panel, capture it for tests, or bridge to a real terminal.
 */
export interface IOHandler {
  /**
   * Called when the program produces textual output (e.g., via `print()`).
   *
   * @param text - The display string to emit.
   */
  onOutput: (text: string) => void;

  /**
   * Called when the program requests user input (e.g., via `input()`).
   * The interpreter `await`s the returned promise, pausing execution until
   * the host supplies a line of text.
   *
   * @returns A promise that resolves to the user-supplied input string.
   */
  onInput: () => Promise<string>;

  /**
   * Called when a runtime error occurs during execution.
   *
   * @param message - Human-readable error description.
   * @param location - Optional source location tuple
   *   `[startLine, startCol, endLine, endCol]` for error highlighting.
   */
  onError: (message: string, location?: [number, number, number, number]) => void;
}

/**
 * Implements the Python `print()` built-in (single-argument variant).
 *
 * Converts the argument to its display string via {@link displayValue} and
 * emits it through {@link IOHandler.onOutput}. Reports an error if the
 * argument count is not exactly one.
 *
 * @param args - The evaluated argument values passed to `print()`.
 * @param io - The I/O handler for output and error reporting.
 * @returns Always returns {@link noneVal | None}.
 */
export function builtinPrint(args: Value[], io: IOHandler): Value {
  if (args.length !== 1) {
    io.onError('print() takes exactly 1 argument');
    return noneVal();
  }
  io.onOutput(displayValue(args[0]));
  return noneVal();
}

/**
 * Implements the Python `input()` built-in (zero-argument variant).
 *
 * Pauses interpreter execution by awaiting {@link IOHandler.onInput} until
 * the host environment provides a line of user input. Reports an error if
 * any arguments are supplied.
 *
 * @param args - The evaluated argument values passed to `input()` (must be empty).
 * @param io - The I/O handler for input retrieval and error reporting.
 * @returns A promise resolving to a {@link strVal | string Value} containing the input.
 */
export async function builtinInput(args: Value[], io: IOHandler): Promise<Value> {
  if (args.length !== 0) {
    io.onError('input() takes no arguments');
    return strVal('');
  }
  const result = await io.onInput();
  return strVal(result);
}

/**
 * Implements the Python `len()` built-in.
 *
 * Returns the length of a string or list. Reports an error if the argument
 * is not a string or list, or if the argument count is not exactly one.
 *
 * @param args - The evaluated argument values passed to `len()`.
 * @param io - The I/O handler for error reporting.
 * @returns An {@link intVal | integer Value} containing the length, or `0` on error.
 */
export function builtinLen(args: Value[], io: IOHandler): Value {
  if (args.length !== 1) {
    io.onError('len() takes exactly 1 argument');
    return intVal(0);
  }
  const arg = args[0];
  if (arg.kind === 'str') {
    return intVal(arg.value.length);
  }
  if (arg.kind === 'list') {
    return intVal(arg.elements.length);
  }
  io.onError('len() argument must be a string or list');
  return intVal(0);
}
