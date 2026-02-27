/**
 * @fileoverview Runtime value types for the Typed Python interpreter.
 *
 * Defines the tagged-union {@link Value} type that represents every possible
 * runtime value the interpreter can produce or consume: integers, booleans,
 * strings, `None`, lists, and class instances. Each variant is created via a
 * dedicated factory function (e.g., {@link intVal}, {@link strVal}) rather than
 * raw object literals, ensuring consistent shape and making the codebase easier
 * to refactor if the representation changes.
 *
 * Helper utilities ({@link isTruthy}, {@link valuesEqual}, {@link displayValue})
 * centralise the truthiness, equality, and display semantics that Python
 * programmers expect, keeping the interpreter itself free of scattered
 * type-switching logic.
 */

/**
 * Discriminated union of every runtime value the interpreter can hold.
 *
 * The `kind` field acts as the discriminant tag so TypeScript narrows the
 * variant automatically in `switch` / `if` blocks. Primitive kinds (`int`,
 * `bool`, `str`, `none`) are immutable value types, while `list` and `object`
 * are mutable reference types — mirroring Python semantics.
 *
 * - `int`    — Wraps a JS `number` (integer subset).
 * - `bool`   — Wraps a JS `boolean`.
 * - `str`    — Wraps a JS `string`.
 * - `none`   — The Python `None` singleton (no payload).
 * - `list`   — Ordered mutable collection with a declared element type.
 * - `object` — Class instance with a class name and attribute map.
 */
export type Value =
  | { kind: 'int'; value: number }
  | { kind: 'bool'; value: boolean }
  | { kind: 'str'; value: string }
  | { kind: 'none' }
  | { kind: 'list'; elements: Value[]; elementType: string }
  | { kind: 'object'; className: string; attrs: Map<string, Value> };

/**
 * Creates an integer runtime value.
 *
 * @param n - The numeric value (should be a safe integer).
 * @returns A {@link Value} with `kind: 'int'`.
 */
export function intVal(n: number): Value {
  return { kind: 'int', value: n };
}

/**
 * Creates a boolean runtime value.
 *
 * @param b - The boolean payload.
 * @returns A {@link Value} with `kind: 'bool'`.
 */
export function boolVal(b: boolean): Value {
  return { kind: 'bool', value: b };
}

/**
 * Creates a string runtime value.
 *
 * @param s - The string payload.
 * @returns A {@link Value} with `kind: 'str'`.
 */
export function strVal(s: string): Value {
  return { kind: 'str', value: s };
}

/**
 * Creates the `None` runtime value (Python's null equivalent).
 *
 * @returns A {@link Value} with `kind: 'none'`.
 */
export function noneVal(): Value {
  return { kind: 'none' };
}

/**
 * Creates a list runtime value.
 *
 * Lists are mutable reference types — the returned object shares the
 * `elements` array, so mutations are visible to all holders.
 *
 * @param elements - The initial elements of the list.
 * @param elementType - The declared element type name (defaults to `'object'`).
 * @returns A {@link Value} with `kind: 'list'`.
 */
export function listVal(elements: Value[], elementType: string = 'object'): Value {
  return { kind: 'list', elements, elementType };
}

/**
 * Creates a class-instance (object) runtime value.
 *
 * The returned object starts with an empty attribute map; the interpreter
 * populates default attribute values and then invokes `__init__` during
 * class instantiation.
 *
 * @param className - The name of the class this instance belongs to.
 * @returns A {@link Value} with `kind: 'object'` and an empty `attrs` map.
 *
 * @see {@link interpret} for the full instantiation flow.
 */
export function objectVal(className: string): Value {
  return { kind: 'object', className, attrs: new Map() };
}

/**
 * Determines the truthiness of a runtime value following Python semantics.
 *
 * - `bool` — its boolean payload.
 * - `int`  — truthy when non-zero.
 * - `str`  — truthy when non-empty.
 * - `none` — always falsy.
 * - `list` — truthy when non-empty.
 * - `object` — always truthy (consistent with Python default `__bool__`).
 *
 * @param v - The runtime value to test.
 * @returns `true` if the value is truthy in Python terms.
 */
export function isTruthy(v: Value): boolean {
  switch (v.kind) {
    case 'bool':
      return v.value;
    case 'int':
      return v.value !== 0;
    case 'str':
      return v.value.length > 0;
    case 'none':
      return false;
    case 'list':
      return v.elements.length > 0;
    case 'object':
      return true;
  }
}

/**
 * Converts a runtime value to its Python `str()` representation.
 *
 * Used by {@link builtinPrint} and error messages. Booleans render as
 * `True`/`False` (Python convention), and objects render as
 * `<ClassName object>`.
 *
 * @param v - The runtime value to display.
 * @returns A human-readable string representation.
 */
export function displayValue(v: Value): string {
  switch (v.kind) {
    case 'int':
      return String(v.value);
    case 'bool':
      return v.value ? 'True' : 'False';
    case 'str':
      return v.value;
    case 'none':
      return 'None';
    case 'list':
      return `[${v.elements.map(displayValue).join(', ')}]`;
    case 'object':
      return `<${v.className} object>`;
  }
}

/**
 * Like {@link displayValue} but truncates large collections for UI display.
 *
 * Lists with more than 8 elements show the first 5 and last 2 with "..."
 * in between. Strings longer than 60 characters are truncated with "...".
 * Recursion depth is limited to 2 levels for nested structures.
 *
 * @param v - The runtime value to display.
 * @param depth - Current nesting depth (defaults to 0).
 * @returns A truncated human-readable string representation.
 */
export function displayValueTruncated(v: Value, depth: number = 0): string {
  switch (v.kind) {
    case 'int':
      return String(v.value);
    case 'bool':
      return v.value ? 'True' : 'False';
    case 'str':
      return v.value.length > 60 ? v.value.slice(0, 57) + '...' : v.value;
    case 'none':
      return 'None';
    case 'list': {
      if (depth >= 2) return `[...${v.elements.length} items]`;
      const els = v.elements;
      if (els.length <= 8) {
        return `[${els.map((e) => displayValueTruncated(e, depth + 1)).join(', ')}]`;
      }
      const head = els.slice(0, 5).map((e) => displayValueTruncated(e, depth + 1));
      const tail = els.slice(-2).map((e) => displayValueTruncated(e, depth + 1));
      return `[${head.join(', ')}, ..., ${tail.join(', ')}]`;
    }
    case 'object':
      return `<${v.className} object>`;
  }
}

/**
 * Tests structural equality of two runtime values.
 *
 * Primitive types (`int`, `bool`, `str`, `none`) are compared by value.
 * Composite types (`list`, `object`) use reference equality (`===`),
 * matching Python's default `__eq__` behavior for user-defined classes.
 *
 * @param a - First operand.
 * @param b - Second operand.
 * @returns `true` if the values are considered equal.
 */
export function valuesEqual(a: Value, b: Value): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'int':
      return a.value === (b as { kind: 'int'; value: number }).value;
    case 'bool':
      return a.value === (b as { kind: 'bool'; value: boolean }).value;
    case 'str':
      return a.value === (b as { kind: 'str'; value: string }).value;
    case 'none':
      return true;
    case 'list':
    case 'object':
      return a === b; // reference equality
  }
}

/**
 * Checks whether a runtime value is the `None` singleton.
 *
 * @param v - The runtime value to test.
 * @returns `true` if `v.kind === 'none'`.
 */
export function isNone(v: Value): boolean {
  return v.kind === 'none';
}

/**
 * Returns the default (zero) value for a given type name.
 *
 * Used when initialising variables that have a declared type but no
 * explicit initialiser. Mirrors Python/ChocoPy defaults:
 * - `int`  -> `0`
 * - `bool` -> `False`
 * - `str`  -> `""`
 * - anything else -> `None`
 *
 * @param typeName - The type name string (e.g., `'int'`, `'bool'`, `'str'`).
 * @returns The zero-value {@link Value} for that type.
 */
export function defaultValue(typeName: string): Value {
  switch (typeName) {
    case 'int':
      return intVal(0);
    case 'bool':
      return boolVal(false);
    case 'str':
      return strVal('');
    default:
      return noneVal();
  }
}
