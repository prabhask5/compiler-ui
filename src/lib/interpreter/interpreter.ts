import type {
  Program,
  Declaration,
  Stmt,
  ExprNode,
  FuncDef,
  ClassDef,
  VarDef
} from '$lib/compiler/types';
import type { Value } from './values';
import {
  intVal,
  boolVal,
  strVal,
  noneVal,
  listVal,
  objectVal,
  isTruthy,
  valuesEqual,
  displayValue,
  isNone
} from './values';
import { Environment } from './environment';
import { builtinPrint, builtinInput, builtinLen, type IOHandler } from './builtins';

export interface InterpreterOutput {
  kind: 'output' | 'error' | 'input' | 'status';
  text: string;
  location?: [number, number, number, number];
}

const MAX_STEPS = 1_000_000;

class ReturnSignal {
  constructor(public value: Value) {}
}

class RuntimeError extends Error {
  constructor(
    message: string,
    public location?: [number, number, number, number]
  ) {
    super(message);
  }
}

interface ClassInfo {
  name: string;
  superClass: string;
  methods: Map<string, FuncDef>;
  attrs: Map<string, { type: string; init: Value }>;
}

export async function interpret(program: Program, io: IOHandler): Promise<void> {
  const env = new Environment();
  let steps = 0;

  // Build class registry
  const classes = new Map<string, ClassInfo>();

  // Function registry (top-level)
  const functions = new Map<string, FuncDef>();

  function step() {
    steps++;
    if (steps > MAX_STEPS) {
      throw new RuntimeError(
        `Execution limit exceeded (${MAX_STEPS} operations). Possible infinite loop.`
      );
    }
  }

  // Phase 1: Register all declarations
  for (const decl of program.declarations) {
    if (decl.kind === 'ClassDef') {
      registerClass(decl);
    } else if (decl.kind === 'FuncDef') {
      functions.set(decl.name.name, decl);
    } else if (decl.kind === 'VarDef') {
      const val = evalLiteral(decl.value);
      env.define(decl.var.identifier.name, val);
    }
  }

  // Phase 2: Execute statements
  try {
    for (const stmt of program.statements) {
      await execStmt(stmt);
    }
  } catch (e) {
    if (e instanceof ReturnSignal) {
      // Top-level return — ignore
    } else if (e instanceof RuntimeError) {
      io.onError(e.message, e.location);
    } else {
      throw e;
    }
  }

  function registerClass(def: ClassDef) {
    const info: ClassInfo = {
      name: def.name.name,
      superClass: def.superClass.name,
      methods: new Map(),
      attrs: new Map()
    };

    // Inherit from parent
    if (def.superClass.name !== 'object') {
      const parent = classes.get(def.superClass.name);
      if (parent) {
        for (const [k, v] of parent.methods) info.methods.set(k, v);
        for (const [k, v] of parent.attrs) info.attrs.set(k, { ...v });
      }
    }

    for (const d of def.declarations) {
      if (d.kind === 'FuncDef') {
        info.methods.set(d.name.name, d);
      } else if (d.kind === 'VarDef') {
        const init = evalLiteral(d.value);
        const typeName = d.var.type.kind === 'ClassType' ? d.var.type.className : 'object';
        info.attrs.set(d.var.identifier.name, { type: typeName, init });
      }
    }

    classes.set(def.name.name, info);
  }

  function evalLiteral(node: ExprNode): Value {
    switch (node.kind) {
      case 'IntegerLiteral':
        return intVal(node.value);
      case 'BooleanLiteral':
        return boolVal(node.value);
      case 'StringLiteral':
        return strVal(node.value);
      case 'NoneLiteral':
        return noneVal();
      default:
        return noneVal();
    }
  }

  async function execStmt(stmt: Stmt): Promise<void> {
    step();
    switch (stmt.kind) {
      case 'ExprStmt':
        await evalExpr(stmt.expr);
        break;

      case 'AssignStmt': {
        const value = await evalExpr(stmt.value);
        for (const target of stmt.targets) {
          await assignTarget(target, value);
        }
        break;
      }

      case 'IfStmt': {
        const cond = await evalExpr(stmt.condition);
        if (isTruthy(cond)) {
          for (const s of stmt.thenBody) await execStmt(s);
        } else {
          for (const s of stmt.elseBody) await execStmt(s);
        }
        break;
      }

      case 'WhileStmt': {
        while (true) {
          step();
          const cond = await evalExpr(stmt.condition);
          if (!isTruthy(cond)) break;
          for (const s of stmt.body) await execStmt(s);
        }
        break;
      }

      case 'ForStmt': {
        const iterable = await evalExpr(stmt.iterable);
        if (iterable.kind === 'str') {
          for (const ch of iterable.value) {
            step();
            env.set(stmt.identifier.name, strVal(ch));
            for (const s of stmt.body) await execStmt(s);
          }
        } else if (iterable.kind === 'list') {
          for (const elem of iterable.elements) {
            step();
            env.set(stmt.identifier.name, elem);
            for (const s of stmt.body) await execStmt(s);
          }
        } else {
          throw new RuntimeError('Cannot iterate over ' + iterable.kind, stmt.location);
        }
        break;
      }

      case 'ReturnStmt': {
        const val = stmt.value ? await evalExpr(stmt.value) : noneVal();
        throw new ReturnSignal(val);
      }
    }
  }

  async function assignTarget(target: ExprNode, value: Value): Promise<void> {
    if (target.kind === 'Identifier') {
      env.set(target.name, value);
    } else if (target.kind === 'MemberExpr') {
      const obj = await evalExpr(target.object);
      if (obj.kind !== 'object') {
        throw new RuntimeError('Cannot set attribute on non-object', target.location);
      }
      if (isNone(obj)) {
        throw new RuntimeError('Cannot set attribute on None', target.location);
      }
      obj.attrs.set(target.member.name, value);
    } else if (target.kind === 'IndexExpr') {
      const list = await evalExpr(target.list);
      const index = await evalExpr(target.index);
      if (list.kind !== 'list') {
        throw new RuntimeError('Cannot index non-list', target.location);
      }
      if (index.kind !== 'int') {
        throw new RuntimeError('Index must be an integer', target.location);
      }
      if (index.value < 0 || index.value >= list.elements.length) {
        throw new RuntimeError(`Index out of bounds: ${index.value}`, target.location);
      }
      list.elements[index.value] = value;
    }
  }

  async function evalExpr(expr: ExprNode): Promise<Value> {
    step();
    switch (expr.kind) {
      case 'IntegerLiteral':
        return intVal(expr.value);
      case 'BooleanLiteral':
        return boolVal(expr.value);
      case 'StringLiteral':
        return strVal(expr.value);
      case 'NoneLiteral':
        return noneVal();

      case 'Identifier':
        return env.get(expr.name);

      case 'UnaryExpr': {
        const operand = await evalExpr(expr.operand);
        if (expr.operator === '-') {
          if (operand.kind !== 'int')
            throw new RuntimeError('Cannot negate non-integer', expr.location);
          return intVal(-operand.value);
        }
        if (expr.operator === 'not') {
          return boolVal(!isTruthy(operand));
        }
        throw new RuntimeError(`Unknown unary operator: ${expr.operator}`, expr.location);
      }

      case 'BinaryExpr':
        return evalBinary(expr);

      case 'IfExpr': {
        const cond = await evalExpr(expr.condition);
        return isTruthy(cond) ? evalExpr(expr.thenExpr) : evalExpr(expr.elseExpr);
      }

      case 'ListExpr': {
        const elements: Value[] = [];
        for (const el of expr.elements) {
          elements.push(await evalExpr(el));
        }
        return listVal(elements);
      }

      case 'IndexExpr': {
        const list = await evalExpr(expr.list);
        const index = await evalExpr(expr.index);
        if (list.kind === 'str') {
          if (index.kind !== 'int')
            throw new RuntimeError('Index must be an integer', expr.location);
          if (index.value < 0 || index.value >= list.value.length) {
            throw new RuntimeError(`Index out of bounds: ${index.value}`, expr.location);
          }
          return strVal(list.value[index.value]);
        }
        if (list.kind === 'list') {
          if (index.kind !== 'int')
            throw new RuntimeError('Index must be an integer', expr.location);
          if (index.value < 0 || index.value >= list.elements.length) {
            throw new RuntimeError(`Index out of bounds: ${index.value}`, expr.location);
          }
          return list.elements[index.value];
        }
        throw new RuntimeError('Cannot index into ' + list.kind, expr.location);
      }

      case 'MemberExpr': {
        const obj = await evalExpr(expr.object);
        if (obj.kind !== 'object') {
          throw new RuntimeError('Cannot access attribute on non-object', expr.location);
        }
        if (isNone(obj)) {
          throw new RuntimeError('Cannot access attribute on None', expr.location);
        }
        const attrVal = obj.attrs.get(expr.member.name);
        if (attrVal !== undefined) return attrVal;
        // Check if it's a method (return as-is, will be handled by MethodCallExpr)
        throw new RuntimeError(`Object has no attribute '${expr.member.name}'`, expr.location);
      }

      case 'CallExpr':
        return callFunction(expr.function.name, expr.args, expr.location);

      case 'MethodCallExpr': {
        const obj = await evalExpr(expr.method.object);
        if (obj.kind !== 'object') {
          throw new RuntimeError('Cannot call method on non-object', expr.location);
        }
        if (isNone(obj)) {
          throw new RuntimeError('Cannot call method on None', expr.location);
        }
        const methodName = expr.method.member.name;
        const classInfo = classes.get(obj.className);
        if (!classInfo) {
          throw new RuntimeError(`Unknown class: ${obj.className}`, expr.location);
        }

        // Walk up class hierarchy for method
        const method = resolveMethod(obj.className, methodName);
        if (!method) {
          throw new RuntimeError(`No method '${methodName}' on ${obj.className}`, expr.location);
        }

        const argVals: Value[] = [obj];
        for (const arg of expr.args) {
          argVals.push(await evalExpr(arg));
        }
        return callFuncDef(method, argVals);
      }

      default:
        throw new RuntimeError(
          `Unknown expression kind: ${(expr as { kind: string }).kind}`,
          expr.location
        );
    }
  }

  async function evalBinary(expr: ExprNode & { kind: 'BinaryExpr' }): Promise<Value> {
    // Short-circuit for `and` and `or`
    if (expr.operator === 'and') {
      const left = await evalExpr(expr.left);
      if (!isTruthy(left)) return left;
      return evalExpr(expr.right);
    }
    if (expr.operator === 'or') {
      const left = await evalExpr(expr.left);
      if (isTruthy(left)) return left;
      return evalExpr(expr.right);
    }

    const left = await evalExpr(expr.left);
    const right = await evalExpr(expr.right);

    // `is` operator — reference equality
    if (expr.operator === 'is') {
      if (left.kind === 'none' && right.kind === 'none') return boolVal(true);
      if (left.kind === 'none' || right.kind === 'none') return boolVal(false);
      return boolVal(left === right);
    }

    // String concatenation
    if (expr.operator === '+' && left.kind === 'str' && right.kind === 'str') {
      return strVal(left.value + right.value);
    }

    // List concatenation
    if (expr.operator === '+' && left.kind === 'list' && right.kind === 'list') {
      return listVal([...left.elements, ...right.elements]);
    }

    // Integer arithmetic
    if (left.kind === 'int' && right.kind === 'int') {
      switch (expr.operator) {
        case '+':
          return intVal(left.value + right.value);
        case '-':
          return intVal(left.value - right.value);
        case '*':
          return intVal(left.value * right.value);
        case '//': {
          if (right.value === 0) throw new RuntimeError('Division by zero', expr.location);
          return intVal(Math.trunc(left.value / right.value));
        }
        case '%': {
          if (right.value === 0) throw new RuntimeError('Division by zero', expr.location);
          // Python-style modulo
          const result = left.value % right.value;
          return intVal(result >= 0 ? result : result + Math.abs(right.value));
        }
        case '<':
          return boolVal(left.value < right.value);
        case '>':
          return boolVal(left.value > right.value);
        case '<=':
          return boolVal(left.value <= right.value);
        case '>=':
          return boolVal(left.value >= right.value);
        case '==':
          return boolVal(left.value === right.value);
        case '!=':
          return boolVal(left.value !== right.value);
      }
    }

    // Boolean comparisons
    if (left.kind === 'bool' && right.kind === 'bool') {
      if (expr.operator === '==') return boolVal(left.value === right.value);
      if (expr.operator === '!=') return boolVal(left.value !== right.value);
    }

    // String comparisons
    if (left.kind === 'str' && right.kind === 'str') {
      switch (expr.operator) {
        case '==':
          return boolVal(left.value === right.value);
        case '!=':
          return boolVal(left.value !== right.value);
        case '<':
          return boolVal(left.value < right.value);
        case '>':
          return boolVal(left.value > right.value);
        case '<=':
          return boolVal(left.value <= right.value);
        case '>=':
          return boolVal(left.value >= right.value);
      }
    }

    throw new RuntimeError(
      `Unsupported operation: ${left.kind} ${expr.operator} ${right.kind}`,
      expr.location
    );
  }

  function resolveMethod(className: string, methodName: string): FuncDef | null {
    let cls: string | undefined = className;
    while (cls) {
      const info = classes.get(cls);
      if (!info) return null;
      const m = info.methods.get(methodName);
      if (m) return m;
      cls = info.superClass === 'object' ? undefined : info.superClass;
    }
    return null;
  }

  async function callFunction(
    name: string,
    args: ExprNode[],
    location: [number, number, number, number]
  ): Promise<Value> {
    // Evaluate arguments
    const argVals: Value[] = [];
    for (const arg of args) {
      argVals.push(await evalExpr(arg));
    }

    // Builtins
    if (name === 'print') return builtinPrint(argVals, io);
    if (name === 'input') return builtinInput(argVals, io);
    if (name === 'len') return builtinLen(argVals, io);

    // Primitive constructors
    if (name === 'int') return intVal(0);
    if (name === 'bool') return boolVal(false);
    if (name === 'str') return strVal('');

    // Class instantiation
    const classInfo = classes.get(name);
    if (classInfo) {
      const obj = objectVal(name);

      // Set default attribute values
      for (const [attrName, attrInfo] of classInfo.attrs) {
        // Clone value for mutable types
        const val = cloneValue(attrInfo.init);
        obj.attrs.set(attrName, val);
      }

      // Call __init__ if defined
      const initMethod = resolveMethod(name, '__init__');
      if (initMethod) {
        await callFuncDef(initMethod, [obj, ...argVals]);
      }

      return obj;
    }

    // User-defined functions
    const func = functions.get(name);
    if (func) {
      return callFuncDef(func, argVals);
    }

    // Try looking up in environment (for nested functions passed as values)
    const val = env.get(name);
    if (val.kind !== 'none') {
      // Nested functions aren't first-class values in Typed Python in a straightforward way,
      // but the environment may have a function registered
      throw new RuntimeError(`'${name}' is not callable`, location);
    }

    throw new RuntimeError(`Unknown function: ${name}`, location);
  }

  async function callFuncDef(func: FuncDef, args: Value[]): Promise<Value> {
    env.pushFrame();

    try {
      // Process declarations first
      for (const decl of func.declarations) {
        processDeclaration(decl);
      }

      // Bind parameters
      for (let i = 0; i < func.params.length; i++) {
        env.define(func.params[i].identifier.name, args[i] ?? noneVal());
      }

      // Register nested functions
      for (const decl of func.declarations) {
        if (decl.kind === 'FuncDef') {
          // Store funcdef reference so nested calls can find it
          const nestedFunc = decl;
          functions.set(nestedFunc.name.name, nestedFunc);
        }
      }

      // Execute body
      for (const stmt of func.statements) {
        await execStmt(stmt);
      }

      return noneVal();
    } catch (e) {
      if (e instanceof ReturnSignal) {
        return e.value;
      }
      throw e;
    } finally {
      // Clean up nested function registrations
      for (const decl of func.declarations) {
        if (decl.kind === 'FuncDef') {
          functions.delete(decl.name.name);
        }
      }
      env.popFrame();
    }
  }

  function processDeclaration(decl: Declaration): void {
    switch (decl.kind) {
      case 'VarDef': {
        const val = evalLiteral(decl.value);
        env.define(decl.var.identifier.name, val);
        break;
      }
      case 'GlobalDecl':
        env.declareGlobal(decl.variable.name);
        break;
      case 'NonLocalDecl':
        env.declareNonlocal(decl.variable.name);
        break;
      case 'FuncDef':
      case 'ClassDef':
        // Handled separately
        break;
    }
  }

  function cloneValue(v: Value): Value {
    if (v.kind === 'list') {
      return listVal(v.elements.map(cloneValue), v.elementType);
    }
    return v;
  }
}
