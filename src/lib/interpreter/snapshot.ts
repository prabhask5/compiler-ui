import type {
  Program,
  Declaration,
  Stmt,
  ExprNode,
  FuncDef,
  ClassDef
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
  displayValue,
  isNone
} from './values';
import { Environment } from './environment';

export interface Snapshot {
  step: number;
  location: [number, number, number, number] | undefined;
  variables: Map<string, Value>;
  consoleOutput: string[];
  callStack: string[];
}

export interface SnapshotResult {
  snapshots: Snapshot[];
  completed: boolean;
  finalOutput: string[];
}

export const MAX_SNAPSHOTS = 5000;
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

export function deepCloneValue(v: Value): Value {
  switch (v.kind) {
    case 'int':
    case 'bool':
    case 'str':
    case 'none':
      return { ...v };
    case 'list':
      return listVal(v.elements.map(deepCloneValue), v.elementType);
    case 'object': {
      const clone = objectVal(v.className);
      for (const [k, val] of v.attrs) {
        clone.attrs.set(k, deepCloneValue(val));
      }
      return clone;
    }
  }
}

export function interpretWithSnapshots(program: Program): SnapshotResult {
  const env = new Environment();
  let steps = 0;
  const snapshots: Snapshot[] = [];
  const output: string[] = [];
  const callStack: string[] = ['<module>'];
  let snapshotOverflow = false;

  const classes = new Map<
    string,
    {
      name: string;
      superClass: string;
      methods: Map<string, FuncDef>;
      attrs: Map<string, { type: string; init: Value }>;
    }
  >();
  const functions = new Map<string, FuncDef>();

  // Check if program uses input() — incompatible with snapshots
  if (programUsesInput(program)) {
    return { snapshots: [], completed: false, finalOutput: [] };
  }

  function step() {
    steps++;
    if (steps > MAX_STEPS) {
      throw new RuntimeError(`Execution limit exceeded (${MAX_STEPS} operations).`);
    }
  }

  function captureSnapshot(location: [number, number, number, number] | undefined) {
    if (snapshotOverflow) return;
    if (snapshots.length >= MAX_SNAPSHOTS) {
      snapshotOverflow = true;
      return;
    }
    snapshots.push({
      step: snapshots.length,
      location,
      variables: env.snapshotVariables(deepCloneValue),
      consoleOutput: [...output],
      callStack: [...callStack]
    });
  }

  function registerClass(def: ClassDef) {
    const info = {
      name: def.name.name,
      superClass: def.superClass.name,
      methods: new Map<string, FuncDef>(),
      attrs: new Map<string, { type: string; init: Value }>()
    };

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

  function execStmt(stmt: Stmt): void {
    step();
    captureSnapshot(stmt.location);

    switch (stmt.kind) {
      case 'ExprStmt':
        evalExpr(stmt.expr);
        break;

      case 'AssignStmt': {
        const value = evalExpr(stmt.value);
        for (const target of stmt.targets) {
          assignTarget(target, value);
        }
        break;
      }

      case 'IfStmt': {
        const cond = evalExpr(stmt.condition);
        if (isTruthy(cond)) {
          for (const s of stmt.thenBody) execStmt(s);
        } else {
          for (const s of stmt.elseBody) execStmt(s);
        }
        break;
      }

      case 'WhileStmt': {
        while (true) {
          step();
          const cond = evalExpr(stmt.condition);
          if (!isTruthy(cond)) break;
          for (const s of stmt.body) execStmt(s);
        }
        break;
      }

      case 'ForStmt': {
        const iterable = evalExpr(stmt.iterable);
        if (iterable.kind === 'str') {
          for (const ch of iterable.value) {
            step();
            env.set(stmt.identifier.name, strVal(ch));
            for (const s of stmt.body) execStmt(s);
          }
        } else if (iterable.kind === 'list') {
          for (const elem of iterable.elements) {
            step();
            env.set(stmt.identifier.name, elem);
            for (const s of stmt.body) execStmt(s);
          }
        } else {
          throw new RuntimeError('Cannot iterate over ' + iterable.kind, stmt.location);
        }
        break;
      }

      case 'ReturnStmt': {
        const val = stmt.value ? evalExpr(stmt.value) : noneVal();
        throw new ReturnSignal(val);
      }
    }
  }

  function assignTarget(target: ExprNode, value: Value): void {
    if (target.kind === 'Identifier') {
      env.set(target.name, value);
    } else if (target.kind === 'MemberExpr') {
      const obj = evalExpr(target.object);
      if (obj.kind !== 'object' || isNone(obj)) return;
      obj.attrs.set(target.member.name, value);
    } else if (target.kind === 'IndexExpr') {
      const list = evalExpr(target.list);
      const index = evalExpr(target.index);
      if (list.kind === 'list' && index.kind === 'int') {
        if (index.value >= 0 && index.value < list.elements.length) {
          list.elements[index.value] = value;
        }
      }
    }
  }

  function evalExpr(expr: ExprNode): Value {
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
        const operand = evalExpr(expr.operand);
        if (expr.operator === '-' && operand.kind === 'int') return intVal(-operand.value);
        if (expr.operator === 'not') return boolVal(!isTruthy(operand));
        throw new RuntimeError(`Unknown unary operator: ${expr.operator}`, expr.location);
      }

      case 'BinaryExpr':
        return evalBinary(expr);

      case 'IfExpr': {
        const cond = evalExpr(expr.condition);
        return isTruthy(cond) ? evalExpr(expr.thenExpr) : evalExpr(expr.elseExpr);
      }

      case 'ListExpr':
        return listVal(expr.elements.map((el) => evalExpr(el)));

      case 'IndexExpr': {
        const list = evalExpr(expr.list);
        const index = evalExpr(expr.index);
        if (list.kind === 'str' && index.kind === 'int') {
          if (index.value >= 0 && index.value < list.value.length) return strVal(list.value[index.value]);
          throw new RuntimeError(`Index out of bounds: ${index.value}`, expr.location);
        }
        if (list.kind === 'list' && index.kind === 'int') {
          if (index.value >= 0 && index.value < list.elements.length) return list.elements[index.value];
          throw new RuntimeError(`Index out of bounds: ${index.value}`, expr.location);
        }
        throw new RuntimeError('Cannot index into ' + list.kind, expr.location);
      }

      case 'MemberExpr': {
        const obj = evalExpr(expr.object);
        if (obj.kind !== 'object' || isNone(obj))
          throw new RuntimeError('Cannot access attribute on non-object', expr.location);
        const attrVal = obj.attrs.get(expr.member.name);
        if (attrVal !== undefined) return attrVal;
        throw new RuntimeError(`Object has no attribute '${expr.member.name}'`, expr.location);
      }

      case 'CallExpr':
        return callFunction(expr.function.name, expr.args, expr.location);

      case 'MethodCallExpr': {
        const obj = evalExpr(expr.method.object);
        if (obj.kind !== 'object' || isNone(obj))
          throw new RuntimeError('Cannot call method on non-object', expr.location);
        const methodName = expr.method.member.name;
        const method = resolveMethod(obj.className, methodName);
        if (!method) throw new RuntimeError(`No method '${methodName}' on ${obj.className}`, expr.location);
        const argVals: Value[] = [obj];
        for (const arg of expr.args) argVals.push(evalExpr(arg));
        return callFuncDef(method, argVals, methodName);
      }

      default:
        throw new RuntimeError(`Unknown expression kind: ${(expr as { kind: string }).kind}`, expr.location);
    }
  }

  function evalBinary(expr: ExprNode & { kind: 'BinaryExpr' }): Value {
    if (expr.operator === 'and') {
      const left = evalExpr(expr.left);
      if (!isTruthy(left)) return left;
      return evalExpr(expr.right);
    }
    if (expr.operator === 'or') {
      const left = evalExpr(expr.left);
      if (isTruthy(left)) return left;
      return evalExpr(expr.right);
    }

    const left = evalExpr(expr.left);
    const right = evalExpr(expr.right);

    if (expr.operator === 'is') {
      if (left.kind === 'none' && right.kind === 'none') return boolVal(true);
      if (left.kind === 'none' || right.kind === 'none') return boolVal(false);
      return boolVal(left === right);
    }

    if (expr.operator === '+' && left.kind === 'str' && right.kind === 'str')
      return strVal(left.value + right.value);
    if (expr.operator === '+' && left.kind === 'list' && right.kind === 'list')
      return listVal([...left.elements, ...right.elements]);

    if (left.kind === 'int' && right.kind === 'int') {
      switch (expr.operator) {
        case '+': return intVal(left.value + right.value);
        case '-': return intVal(left.value - right.value);
        case '*': return intVal(left.value * right.value);
        case '//': {
          if (right.value === 0) throw new RuntimeError('Division by zero', expr.location);
          return intVal(Math.trunc(left.value / right.value));
        }
        case '%': {
          if (right.value === 0) throw new RuntimeError('Division by zero', expr.location);
          const result = left.value % right.value;
          return intVal(result >= 0 ? result : result + Math.abs(right.value));
        }
        case '<': return boolVal(left.value < right.value);
        case '>': return boolVal(left.value > right.value);
        case '<=': return boolVal(left.value <= right.value);
        case '>=': return boolVal(left.value >= right.value);
        case '==': return boolVal(left.value === right.value);
        case '!=': return boolVal(left.value !== right.value);
      }
    }

    if (left.kind === 'bool' && right.kind === 'bool') {
      if (expr.operator === '==') return boolVal(left.value === right.value);
      if (expr.operator === '!=') return boolVal(left.value !== right.value);
    }

    if (left.kind === 'str' && right.kind === 'str') {
      switch (expr.operator) {
        case '==': return boolVal(left.value === right.value);
        case '!=': return boolVal(left.value !== right.value);
        case '<': return boolVal(left.value < right.value);
        case '>': return boolVal(left.value > right.value);
        case '<=': return boolVal(left.value <= right.value);
        case '>=': return boolVal(left.value >= right.value);
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

  function callFunction(
    name: string,
    args: ExprNode[],
    location: [number, number, number, number]
  ): Value {
    const argVals: Value[] = args.map((a) => evalExpr(a));

    // Builtins
    if (name === 'print') {
      if (argVals.length === 1) output.push(displayValue(argVals[0]));
      return noneVal();
    }
    if (name === 'len') {
      const arg = argVals[0];
      if (arg?.kind === 'str') return intVal(arg.value.length);
      if (arg?.kind === 'list') return intVal(arg.elements.length);
      return intVal(0);
    }
    if (name === 'int') return intVal(0);
    if (name === 'bool') return boolVal(false);
    if (name === 'str') return strVal('');

    // Class instantiation
    const classInfo = classes.get(name);
    if (classInfo) {
      const obj = objectVal(name);
      for (const [attrName, attrInfo] of classInfo.attrs) {
        obj.attrs.set(attrName, cloneValue(attrInfo.init));
      }
      const initMethod = resolveMethod(name, '__init__');
      if (initMethod) callFuncDef(initMethod, [obj, ...argVals], '__init__');
      return obj;
    }

    // User-defined functions
    const func = functions.get(name);
    if (func) return callFuncDef(func, argVals, name);

    throw new RuntimeError(`Unknown function: ${name}`, location);
  }

  function callFuncDef(func: FuncDef, args: Value[], funcName: string = ''): Value {
    env.pushFrame();
    callStack.push(funcName || func.name.name);

    try {
      for (const decl of func.declarations) processDeclaration(decl);
      for (let i = 0; i < func.params.length; i++) {
        env.define(func.params[i].identifier.name, args[i] ?? noneVal());
      }
      for (const decl of func.declarations) {
        if (decl.kind === 'FuncDef') functions.set(decl.name.name, decl);
      }
      for (const stmt of func.statements) execStmt(stmt);
      return noneVal();
    } catch (e) {
      if (e instanceof ReturnSignal) return e.value;
      throw e;
    } finally {
      for (const decl of func.declarations) {
        if (decl.kind === 'FuncDef') functions.delete(decl.name.name);
      }
      callStack.pop();
      env.popFrame();
    }
  }

  function processDeclaration(decl: Declaration): void {
    switch (decl.kind) {
      case 'VarDef':
        env.define(decl.var.identifier.name, evalLiteral(decl.value));
        break;
      case 'GlobalDecl':
        env.declareGlobal(decl.variable.name);
        break;
      case 'NonLocalDecl':
        env.declareNonlocal(decl.variable.name);
        break;
    }
  }

  function cloneValue(v: Value): Value {
    if (v.kind === 'list') return listVal(v.elements.map(cloneValue), v.elementType);
    return v;
  }

  // Phase 1: Register
  for (const decl of program.declarations) {
    if (decl.kind === 'ClassDef') registerClass(decl);
    else if (decl.kind === 'FuncDef') functions.set(decl.name.name, decl);
    else if (decl.kind === 'VarDef') env.define(decl.var.identifier.name, evalLiteral(decl.value));
  }

  // Phase 2: Execute
  try {
    for (const stmt of program.statements) execStmt(stmt);
  } catch (e) {
    if (e instanceof ReturnSignal) {
      // Top-level return — ignore
    } else if (e instanceof RuntimeError) {
      output.push(`Error: ${e.message}`);
    } else {
      throw e;
    }
  }

  if (snapshotOverflow) {
    return { snapshots: [], completed: false, finalOutput: output };
  }

  return { snapshots, completed: true, finalOutput: output };
}

function programUsesInput(program: Program): boolean {
  function checkExpr(expr: ExprNode): boolean {
    switch (expr.kind) {
      case 'CallExpr':
        if (expr.function.name === 'input') return true;
        return expr.args.some(checkExpr);
      case 'BinaryExpr':
        return checkExpr(expr.left) || checkExpr(expr.right);
      case 'UnaryExpr':
        return checkExpr(expr.operand);
      case 'IfExpr':
        return checkExpr(expr.condition) || checkExpr(expr.thenExpr) || checkExpr(expr.elseExpr);
      case 'ListExpr':
        return expr.elements.some(checkExpr);
      case 'IndexExpr':
        return checkExpr(expr.list) || checkExpr(expr.index);
      case 'MemberExpr':
        return checkExpr(expr.object);
      case 'MethodCallExpr':
        return checkExpr(expr.method.object) || expr.args.some(checkExpr);
      default:
        return false;
    }
  }

  function checkStmt(stmt: Stmt): boolean {
    switch (stmt.kind) {
      case 'ExprStmt':
        return checkExpr(stmt.expr);
      case 'AssignStmt':
        return checkExpr(stmt.value) || stmt.targets.some(checkExpr);
      case 'IfStmt':
        return checkExpr(stmt.condition) || stmt.thenBody.some(checkStmt) || stmt.elseBody.some(checkStmt);
      case 'WhileStmt':
        return checkExpr(stmt.condition) || stmt.body.some(checkStmt);
      case 'ForStmt':
        return checkExpr(stmt.iterable) || stmt.body.some(checkStmt);
      case 'ReturnStmt':
        return stmt.value ? checkExpr(stmt.value) : false;
    }
  }

  function checkDecls(decls: Declaration[]): boolean {
    for (const d of decls) {
      if (d.kind === 'FuncDef') {
        if (d.statements.some(checkStmt) || checkDecls(d.declarations)) return true;
      } else if (d.kind === 'ClassDef') {
        if (checkDecls(d.declarations)) return true;
      }
    }
    return false;
  }

  return program.statements.some(checkStmt) || checkDecls(program.declarations);
}
