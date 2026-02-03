// Runtime value types for the Typed Python interpreter

export type Value =
  | { kind: 'int'; value: number }
  | { kind: 'bool'; value: boolean }
  | { kind: 'str'; value: string }
  | { kind: 'none' }
  | { kind: 'list'; elements: Value[]; elementType: string }
  | { kind: 'object'; className: string; attrs: Map<string, Value> };

export function intVal(n: number): Value {
  return { kind: 'int', value: n };
}

export function boolVal(b: boolean): Value {
  return { kind: 'bool', value: b };
}

export function strVal(s: string): Value {
  return { kind: 'str', value: s };
}

export function noneVal(): Value {
  return { kind: 'none' };
}

export function listVal(elements: Value[], elementType: string = 'object'): Value {
  return { kind: 'list', elements, elementType };
}

export function objectVal(className: string): Value {
  return { kind: 'object', className, attrs: new Map() };
}

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

export function isNone(v: Value): boolean {
  return v.kind === 'none';
}

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
