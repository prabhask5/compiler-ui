/**
 * @fileoverview Tree-walking interpreter for the Typed Python AST.
 *
 * Executes a type-checked {@link Program} by walking its AST nodes in two
 * phases: first registering all top-level declarations (classes, functions,
 * variables) into a {@link Environment | scope environment} and class/function
 * registries, then sequentially executing the program's statements.
 *
 * The interpreter is fully async to support the `input()` built-in, which
 * pauses execution until the host environment supplies a line of text via the
 * {@link IOHandler} callback interface.
 *
 * A step counter ({@link MAX_STEPS}) acts as a safety net against infinite
 * loops, throwing a {@link RuntimeError} when exceeded. Function returns are
 * modeled as thrown {@link ReturnSignal} exceptions that unwind the call stack
 * to the nearest `callFuncDef` catch boundary — a simple and reliable
 * alternative to explicit return-value plumbing through every statement
 * executor.
 *
 * @see {@link Environment} for the scope/variable resolution model.
 * @see {@link Value} for the runtime value representation.
 * @see {@link IOHandler} for the I/O abstraction layer.
 */

import type { Program, Declaration, Stmt, ExprNode, FuncDef, ClassDef } from '$lib/compiler/types';
import type { Value } from './values';
import {
  intVal,
  boolVal,
  strVal,
  noneVal,
  listVal,
  objectVal,
  isTruthy,
  isNone,
  displayValue
} from './values';
import { Environment } from './environment';
import { builtinPrint, builtinInput, builtinLen, type IOHandler } from './builtins';

/**
 * A single line of interpreter output routed to the host UI.
 *
 * The `kind` discriminant tells the UI how to render the entry:
 * - `'output'` — normal `print()` output.
 * - `'error'`  — runtime error message.
 * - `'input'`  — echoed user input.
 * - `'status'` — interpreter status message (e.g., "program finished").
 */
export interface InterpreterOutput {
  /** Discriminant indicating the output category. */
  kind: 'output' | 'error' | 'input' | 'status';

  /** The textual content of this output line. */
  text: string;

  /**
   * Optional source location tuple `[startLine, startCol, endLine, endCol]`
   * for error highlighting in the editor.
   */
  location?: [number, number, number, number];
}

/**
 * Event emitted at each statement during step-through execution.
 * Contains the current execution context for the UI to display.
 */
export interface StepEvent {
  /** Monotonically increasing step counter. */
  stepNumber: number;
  /** AST node kind being executed (e.g. "AssignStmt"). */
  kind: string;
  /** Source location [startLine, startCol, endLine, endCol], or null. */
  location: [number, number, number, number] | null;
  /** Snapshot of all visible variables as name → display string pairs. */
  variables: Map<string, string>;
  /** Current function call nesting depth (0 = top-level). */
  callDepth: number;
  /** Name of the currently executing function, or null for top-level. */
  currentFunction: string | null;
}

/**
 * Options for step-through execution mode.
 * When provided to {@link interpret}, execution pauses at each statement
 * and awaits the `onStep` callback's returned Promise before continuing.
 */
export interface StepModeOptions {
  /** Called at each statement. Resolve the returned Promise to advance. */
  onStep: (event: StepEvent) => Promise<void>;
}

/**
 * Thrown to abort step-through execution when the user clicks Stop.
 * Caught in the interpreter's top-level try/catch to cleanly exit.
 */
export class StopExecution extends Error {
  constructor() {
    super('Execution stopped by user');
  }
}

/**
 * Maximum number of interpreter steps before aborting execution.
 * Prevents runaway infinite loops from freezing the UI.
 *
 * @internal
 */
const MAX_STEPS = 1_000_000;

/**
 * Sentinel exception thrown by `return` statements to unwind the call stack.
 *
 * Caught by {@link callFuncDef} to extract the return value. Using an
 * exception avoids threading a "should return" flag through every
 * recursive `execStmt` / `evalExpr` call.
 *
 * @internal
 */
class ReturnSignal {
  constructor(public value: Value) {}
}

/**
 * Error type for runtime failures during interpretation.
 *
 * Carries an optional source location so the host UI can highlight the
 * offending code region.
 *
 * @internal
 */
class RuntimeError extends Error {
  constructor(
    message: string,
    public location?: [number, number, number, number]
  ) {
    super(message);
  }
}

/**
 * Metadata about a registered class, including inherited members.
 *
 * Built during the declaration-registration phase by {@link registerClass}
 * and stored in the interpreter's class registry. Inheritance is resolved
 * eagerly: parent methods and attributes are copied into the child's maps
 * so that method resolution at runtime is a simple map lookup (with a
 * fallback walk for the `super` chain via {@link resolveMethod}).
 */
interface ClassInfo {
  /** The class name as declared in source. */
  name: string;

  /** The superclass name (`'object'` for root classes). */
  superClass: string;

  /** Method name to AST function definition, including inherited methods. */
  methods: Map<string, FuncDef>;

  /**
   * Attribute name to its declared type and default initial value.
   * Includes inherited attributes.
   */
  attrs: Map<string, { type: string; init: Value }>;
}

/**
 * Executes a type-checked Typed Python program.
 *
 * This is the main entry point for interpretation. The function:
 * 1. Registers all top-level declarations (classes, functions, variables).
 * 2. Sequentially executes the program's statements.
 * 3. Routes output, errors, and input requests through the provided {@link IOHandler}.
 *
 * @param program - The fully-parsed and type-checked AST to execute.
 * @param io - The {@link IOHandler} callbacks for I/O operations.
 * @returns A promise that resolves when execution completes (or an error is reported).
 *
 * @throws Re-throws unexpected (non-runtime) errors. {@link RuntimeError} instances
 *   are caught and reported via `io.onError`.
 */
export async function interpret(
  program: Program,
  io: IOHandler,
  stepMode?: StepModeOptions
): Promise<void> {
  const env = new Environment();
  let steps = 0;
  let stmtStepCount = 0;
  let callDepth = 0;
  let currentFunction: string | null = null;

  // Build class registry
  const classes = new Map<string, ClassInfo>();

  // Function registry (top-level)
  const functions = new Map<string, FuncDef>();

  /**
   * Increments the step counter and throws if the execution limit is exceeded.
   * Called at the top of every statement and expression evaluation to guard
   * against infinite loops.
   *
   * @internal
   * @throws {RuntimeError} When the step count exceeds {@link MAX_STEPS}.
   */
  function step() {
    steps++;
    if (steps > MAX_STEPS) {
      throw new RuntimeError(
        `Execution limit exceeded (${MAX_STEPS} operations). Possible infinite loop.`
      );
    }
  }

  /**
   * Pauses execution at a statement boundary when step mode is active.
   * Snapshots visible variables and awaits the host's "continue" signal.
   */
  async function stmtStep(stmt: {
    kind: string;
    location?: [number, number, number, number];
  }): Promise<void> {
    if (!stepMode) return;
    stmtStepCount++;
    const varSnapshot = new Map<string, string>();
    for (const [name, val] of env.snapshotVariables(cloneValue)) {
      varSnapshot.set(name, displayValue(val));
    }
    await stepMode.onStep({
      stepNumber: stmtStepCount,
      kind: stmt.kind,
      location: stmt.location ?? null,
      variables: varSnapshot,
      callDepth,
      currentFunction
    });
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
    if (e instanceof StopExecution) {
      return;
    } else if (e instanceof ReturnSignal) {
      // Top-level return — ignore
    } else if (e instanceof RuntimeError) {
      io.onError(e.message, e.location);
    } else {
      throw e;
    }
  }

  /**
   * Registers a class definition into the class registry.
   *
   * Eagerly copies inherited methods and attributes from the parent class
   * (if any), then overlays the child's own declarations. This means each
   * {@link ClassInfo} entry is self-contained and does not require a
   * chain walk for attribute/method lookup during instantiation.
   *
   * @internal
   * @param def - The class definition AST node.
   */
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

  /**
   * Evaluates a literal AST node to its corresponding runtime value.
   *
   * Only handles literal node kinds (`IntegerLiteral`, `BooleanLiteral`,
   * `StringLiteral`, `NoneLiteral`). Any other node kind falls through
   * to `None` — this is safe because the type checker guarantees that
   * variable initialisers and class attribute defaults are always literals.
   *
   * @internal
   * @param node - The expression AST node (expected to be a literal).
   * @returns The runtime {@link Value} corresponding to the literal.
   */
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

  /**
   * Executes a single statement AST node.
   *
   * Dispatches on `stmt.kind` to handle expression statements, assignments,
   * if/while/for control flow, and return statements. Each iteration of a
   * loop body calls {@link step} to enforce the execution limit.
   *
   * @internal
   * @param stmt - The statement AST node to execute.
   * @throws {ReturnSignal} When a `return` statement is encountered.
   * @throws {RuntimeError} On runtime errors (e.g., iterating a non-iterable).
   */
  async function execStmt(stmt: Stmt): Promise<void> {
    step();
    await stmtStep(stmt);
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

  /**
   * Assigns a value to an assignment target (variable, member, or index).
   *
   * Handles three target kinds:
   * - `Identifier` — sets the variable in the current {@link Environment} scope.
   * - `MemberExpr` — sets an attribute on an object instance.
   * - `IndexExpr` — sets an element in a list by integer index.
   *
   * @internal
   * @param target - The left-hand-side expression (assignment target).
   * @param value - The {@link Value} to assign.
   * @throws {RuntimeError} On type mismatches or out-of-bounds index access.
   */
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

  /**
   * Evaluates an expression AST node to a runtime value.
   *
   * This is the core expression evaluator, handling literals, identifiers,
   * unary/binary operations, conditionals, list construction, indexing,
   * member access, function calls, and method calls. Each evaluation
   * increments the step counter via {@link step}.
   *
   * @internal
   * @param expr - The expression AST node to evaluate.
   * @returns The resulting runtime {@link Value}.
   * @throws {RuntimeError} On type errors, unknown operators, or missing attributes.
   */
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
          (expr as { location: [number, number, number, number] }).location
        );
    }
  }

  /**
   * Evaluates a binary expression, handling arithmetic, comparisons, and
   * logical short-circuit operators (`and`, `or`).
   *
   * Supports:
   * - Short-circuit `and`/`or` (Python semantics: returns the deciding operand).
   * - `is` for reference/None equality.
   * - String and list concatenation via `+`.
   * - Integer arithmetic (`+`, `-`, `*`, `//`, `%`) with Python-style modulo.
   * - Comparison operators for integers, booleans, and strings.
   *
   * @internal
   * @param expr - The binary expression AST node.
   * @returns The result {@link Value} of the operation.
   * @throws {RuntimeError} On division by zero or unsupported operand type combinations.
   */
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

  /**
   * Walks the class hierarchy to find a method by name.
   *
   * Starts at the given class and follows the `superClass` chain until it
   * finds a matching method or reaches the root `'object'` class. This
   * enables inherited method calls and `__init__` resolution.
   *
   * @internal
   * @param className - The class to start searching from.
   * @param methodName - The method name to resolve.
   * @returns The {@link FuncDef} AST node for the method, or `null` if not found.
   */
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

  /**
   * Dispatches a function call by name, checking built-ins, primitive
   * constructors, class instantiation, and user-defined functions in order.
   *
   * Resolution priority:
   * 1. Built-in functions (`print`, `input`, `len`).
   * 2. Primitive type constructors (`int`, `bool`, `str`) returning zero values.
   * 3. Class constructors — creates an object, sets default attributes, calls `__init__`.
   * 4. User-defined top-level functions from the function registry.
   *
   * @internal
   * @param name - The function or class name to call.
   * @param args - Unevaluated argument expression nodes.
   * @param location - Source location for error reporting.
   * @returns The return {@link Value} from the called function.
   * @throws {RuntimeError} If the name is not callable or unknown.
   */
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
      const obj = objectVal(name) as {
        kind: 'object';
        className: string;
        attrs: Map<string, Value>;
      };

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

  /**
   * Invokes a user-defined function (or method) by executing its AST body.
   *
   * Lifecycle:
   * 1. Pushes a new {@link Environment} frame.
   * 2. Processes inner declarations (`VarDef`, `GlobalDecl`, `NonLocalDecl`).
   * 3. Binds parameter names to the provided argument values.
   * 4. Registers nested function definitions in the function registry.
   * 5. Executes the function body statements.
   * 6. Catches {@link ReturnSignal} to extract the return value.
   * 7. Cleans up nested function registrations and pops the frame.
   *
   * @internal
   * @param func - The function definition AST node to execute.
   * @param args - Pre-evaluated argument {@link Value values} (includes `self` for methods).
   * @returns The return {@link Value}, or {@link noneVal | None} if no explicit return.
   * @throws {RuntimeError} Re-thrown from inner statement/expression evaluation.
   */
  async function callFuncDef(func: FuncDef, args: Value[]): Promise<Value> {
    env.pushFrame();
    callDepth++;
    const prevFunction = currentFunction;
    currentFunction = func.name.name;

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
      callDepth--;
      currentFunction = prevFunction;
      // Clean up nested function registrations
      for (const decl of func.declarations) {
        if (decl.kind === 'FuncDef') {
          functions.delete(decl.name.name);
        }
      }
      env.popFrame();
    }
  }

  /**
   * Processes a single declaration node within a function body.
   *
   * Handles:
   * - `VarDef` — evaluates the literal initialiser and defines the local variable.
   * - `GlobalDecl` — registers a global redirect in the current {@link Environment} frame.
   * - `NonLocalDecl` — registers a nonlocal redirect in the current frame.
   * - `FuncDef` / `ClassDef` — no-op here; handled separately after declarations.
   *
   * @internal
   * @param decl - The declaration AST node to process.
   */
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

  /**
   * Deep-clones a runtime value, recursively copying mutable types.
   *
   * Primitive values (`int`, `bool`, `str`, `none`) are immutable and
   * returned as-is. Lists are recursively cloned so that each class
   * instance gets its own copy of default list attributes.
   *
   * @internal
   * @param v - The {@link Value} to clone.
   * @returns A deep copy of the value (or the same reference for immutables).
   */
  function cloneValue(v: Value): Value {
    if (v.kind === 'list') {
      return listVal(v.elements.map(cloneValue), v.elementType);
    }
    return v;
  }
}
