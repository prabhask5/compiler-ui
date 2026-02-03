import type { Value } from './values';
import { intVal, strVal, noneVal, displayValue } from './values';

export interface IOHandler {
  onOutput: (text: string) => void;
  onInput: () => Promise<string>;
  onError: (message: string, location?: [number, number, number, number]) => void;
}

export function builtinPrint(args: Value[], io: IOHandler): Value {
  if (args.length !== 1) {
    io.onError('print() takes exactly 1 argument');
    return noneVal();
  }
  io.onOutput(displayValue(args[0]));
  return noneVal();
}

export async function builtinInput(args: Value[], io: IOHandler): Promise<Value> {
  if (args.length !== 0) {
    io.onError('input() takes no arguments');
    return strVal('');
  }
  const result = await io.onInput();
  return strVal(result);
}

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
