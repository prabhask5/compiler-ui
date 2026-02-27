/**
 * @fileoverview Typed ChocoPy AST Definitions — TypeScript Mirror of Rust Serde Output
 *
 * Defines the complete typed AST (Abstract Syntax Tree) for the ChocoPy language,
 * matching the JSON structure produced by the Rust compiler's `serde` serialization.
 * Every interface here corresponds 1:1 to a Rust enum variant or struct, using
 * a `kind` discriminant for tagged-union deserialization.
 *
 * Architecture note:
 *   The Rust compiler serializes AST nodes as `{ "kind": "NodeType", ...fields }`.
 *   TypeScript discriminated unions on `kind` give us exhaustive pattern matching
 *   and type narrowing without runtime overhead. Location data uses a compact
 *   4-tuple array ({@link LocationArray}) rather than nested objects to minimize
 *   JSON payload size from the WASM boundary.
 *
 * Sections:
 *   - Source Locations — positional tracking ({@link Position}, {@link Location}, {@link LocationArray})
 *   - Types — type annotation and inferred value types ({@link TypeAnnotation}, {@link ValueType})
 *   - Expressions — all expression AST nodes ({@link ExprNode}, {@link BinaryExpr}, etc.)
 *   - Literals — literal subset used for variable initializers ({@link Literal})
 *   - Statements — statement AST nodes ({@link Stmt}, {@link IfStmt}, etc.)
 *   - Declarations — top-level and nested declarations ({@link Declaration}, {@link FuncDef}, etc.)
 *   - Program — root AST node and error containers ({@link Program}, {@link CompilerError})
 *   - Compile Result — full pipeline output ({@link CompileResult})
 *   - Helpers — display and categorization utilities
 */

// ── Source Locations ──────────────────────────────────────────────────────────

/**
 * A row/column position within the source text.
 *
 * Mirrors the Rust `Position` struct. Both `row` and `col` are 1-based,
 * matching standard editor conventions.
 */
export interface Position {
  /** 1-based line number. */
  row: number;
  /** 1-based column offset. */
  col: number;
}

/**
 * A source span defined by a start and end {@link Position}.
 *
 * This is the expanded form produced by {@link parseLocation} — most AST nodes
 * store the compact {@link LocationArray} form instead.
 */
export interface Location {
  /** Inclusive start position of the span. */
  start: Position;
  /** Exclusive end position of the span. */
  end: Position;
}

/**
 * Compact source location tuple: `[start_row, start_col, end_row, end_col]`.
 *
 * Architecture note:
 *   The Rust compiler serializes locations as flat 4-element arrays to reduce
 *   JSON size across the WASM boundary. Every AST node carries one of these.
 *   Use {@link parseLocation} to expand into the structured {@link Location} form.
 *
 * @example
 * const loc: LocationArray = [1, 0, 1, 5]; // line 1, cols 0..5
 */
export type LocationArray = [number, number, number, number];

/**
 * Expands a compact {@link LocationArray} tuple into a structured {@link Location} object.
 *
 * @param loc - The 4-element location tuple from the Rust serde output.
 * @returns A {@link Location} with `start` and `end` {@link Position} objects.
 *
 * @example
 * const loc = parseLocation([1, 0, 1, 5]);
 * // => { start: { row: 1, col: 0 }, end: { row: 1, col: 5 } }
 */
export function parseLocation(loc: LocationArray): Location {
  return {
    start: { row: loc[0], col: loc[1] },
    end: { row: loc[2], col: loc[3] }
  };
}

/**
 * Base fields shared by all AST nodes.
 *
 * Every node carries a {@link LocationArray} for source mapping and an optional
 * `errorMsg` populated by the compiler when the node contains a semantic error.
 */
export interface NodeBase {
  /** Compact source location tuple. See {@link LocationArray}. */
  location: LocationArray;
  /** Compiler error message attached to this node, if any. */
  errorMsg?: string;
}

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Discriminated union of type annotations written in source code.
 *
 * These appear in variable declarations, function parameters, and return types.
 * Discriminated on the `kind` field: `'ClassType'` or `'ListType'`.
 */
export type TypeAnnotation = ClassType | ListType;

/**
 * A named class type annotation (e.g., `int`, `bool`, `str`, `object`, or user-defined classes).
 *
 * Mirrors the Rust `TypeAnnotation::ClassType` variant.
 */
export interface ClassType {
  /** Discriminant for tagged-union deserialization. */
  kind: 'ClassType';
  /** Source location of the type annotation. */
  location: LocationArray;
  /** Compiler error message, if this type annotation is invalid. */
  errorMsg?: string;
  /** The class name (e.g., `"int"`, `"bool"`, `"MyClass"`). */
  className: string;
}

/**
 * A list type annotation (e.g., `[int]`, `[[bool]]`).
 *
 * Mirrors the Rust `TypeAnnotation::ListType` variant. Supports arbitrary nesting
 * via the recursive {@link TypeAnnotation} element type.
 */
export interface ListType {
  /** Discriminant for tagged-union deserialization. */
  kind: 'ListType';
  /** Source location of the type annotation. */
  location: LocationArray;
  /** Compiler error message, if this type annotation is invalid. */
  errorMsg?: string;
  /** The type of elements in the list. Recursive for nested lists like `[[int]]`. */
  elementType: TypeAnnotation;
}

/**
 * Discriminated union of inferred value types produced by the type checker.
 *
 * Unlike {@link TypeAnnotation} (which represents source-level syntax), `ValueType`
 * represents the compiler's resolved type after type checking. Present on AST nodes
 * only after the type-checking pass populates `inferredType`.
 */
export type ValueType = ClassValueType | ListValueType;

/**
 * An inferred class value type (e.g., the result of type-checking `42` yields `{ kind: 'ClassValueType', className: 'int' }`).
 *
 * Mirrors the Rust `ValueType::ClassValueType` variant.
 */
export interface ClassValueType {
  /** Discriminant for tagged-union deserialization. */
  kind: 'ClassValueType';
  /** The resolved class name (e.g., `"int"`, `"bool"`, `"<None>"`). */
  className: string;
}

/**
 * An inferred list value type (e.g., the result of type-checking `[1, 2]` yields a list of `int`).
 *
 * Mirrors the Rust `ValueType::ListValueType` variant.
 */
export interface ListValueType {
  /** Discriminant for tagged-union deserialization. */
  kind: 'ListValueType';
  /** The inferred element type. Recursive for nested lists. */
  elementType: ValueType;
}

// ── Expressions ───────────────────────────────────────────────────────────────

/**
 * Common fields for all expression nodes.
 *
 * The `inferredType` field is populated only after the type-checking pass.
 * Before type checking, it is `undefined`.
 */
export interface Expr {
  /** The type inferred by the type checker, or `undefined` if not yet type-checked. */
  inferredType?: ValueType;
}

/**
 * Discriminated union of all expression AST node types.
 *
 * Each variant is identified by its `kind` field. This union represents the
 * "content" before intersection with {@link Expr} — see {@link ExprNode}.
 */
export type ExprContent =
  | BinaryExpr
  | UnaryExpr
  | CallExpr
  | MethodCallExpr
  | MemberExpr
  | IndexExpr
  | IfExpr
  | ListExpr
  | Identifier
  | IntegerLiteral
  | BooleanLiteral
  | StringLiteral
  | NoneLiteral;

/**
 * A fully-typed expression node: any {@link ExprContent} variant intersected
 * with the {@link Expr} base (which adds `inferredType`).
 *
 * This is the type used throughout the AST wherever an expression is expected.
 */
export type ExprNode = ExprContent & Expr;

/**
 * A binary operation expression (e.g., `a + b`, `x == y`, `a and b`).
 *
 * Mirrors the Rust `Expr::BinaryExpr` variant.
 */
export interface BinaryExpr {
  /** Discriminant for tagged-union deserialization. */
  kind: 'BinaryExpr';
  /** Source location spanning the entire binary expression. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** The type inferred by the type checker. */
  inferredType?: ValueType;
  /** The left-hand operand. */
  left: ExprNode;
  /** The operator symbol (e.g., `"+"`, `"=="`, `"and"`, `"is"`). */
  operator: string;
  /** The right-hand operand. */
  right: ExprNode;
}

/**
 * A unary operation expression (e.g., `-x`, `not flag`).
 *
 * Mirrors the Rust `Expr::UnaryExpr` variant.
 */
export interface UnaryExpr {
  /** Discriminant for tagged-union deserialization. */
  kind: 'UnaryExpr';
  /** Source location spanning the entire unary expression. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** The type inferred by the type checker. */
  inferredType?: ValueType;
  /** The operator symbol (e.g., `"-"`, `"not"`). */
  operator: string;
  /** The operand expression. */
  operand: ExprNode;
}

/**
 * A function call expression (e.g., `print("hello")`, `len(xs)`).
 *
 * Mirrors the Rust `Expr::CallExpr` variant. The callee is always an
 * {@link Identifier} — ChocoPy does not support first-class function values.
 */
export interface CallExpr {
  /** Discriminant for tagged-union deserialization. */
  kind: 'CallExpr';
  /** Source location spanning the entire call expression. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** The type inferred by the type checker. */
  inferredType?: ValueType;
  /** The function name being called. */
  function: Identifier;
  /** Positional arguments passed to the function. */
  args: ExprNode[];
}

/**
 * A method call expression (e.g., `obj.method(arg)`).
 *
 * Mirrors the Rust `Expr::MethodCallExpr` variant. The `method` field is a
 * {@link MemberExpr} that encodes both the receiver object and the method name.
 */
export interface MethodCallExpr {
  /** Discriminant for tagged-union deserialization. */
  kind: 'MethodCallExpr';
  /** Source location spanning the entire method call. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** The type inferred by the type checker. */
  inferredType?: ValueType;
  /** The member access expression identifying the method (receiver + method name). */
  method: MemberExpr;
  /** Positional arguments passed to the method. */
  args: ExprNode[];
}

/**
 * A member (attribute) access expression (e.g., `obj.field`).
 *
 * Mirrors the Rust `Expr::MemberExpr` variant.
 */
export interface MemberExpr {
  /** Discriminant for tagged-union deserialization. */
  kind: 'MemberExpr';
  /** Source location spanning the entire member access. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** The type inferred by the type checker. */
  inferredType?: ValueType;
  /** The object being accessed. */
  object: ExprNode;
  /** The member (attribute) name. */
  member: Identifier;
}

/**
 * An index (subscript) expression (e.g., `xs[0]`).
 *
 * Mirrors the Rust `Expr::IndexExpr` variant.
 */
export interface IndexExpr {
  /** Discriminant for tagged-union deserialization. */
  kind: 'IndexExpr';
  /** Source location spanning the entire index expression. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** The type inferred by the type checker. */
  inferredType?: ValueType;
  /** The list expression being indexed. */
  list: ExprNode;
  /** The index expression (must evaluate to `int`). */
  index: ExprNode;
}

/**
 * A ternary conditional expression (e.g., `x if cond else y`).
 *
 * Mirrors the Rust `Expr::IfExpr` variant. Note this is an *expression*
 * (produces a value), distinct from {@link IfStmt}.
 */
export interface IfExpr {
  /** Discriminant for tagged-union deserialization. */
  kind: 'IfExpr';
  /** Source location spanning the entire conditional expression. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** The type inferred by the type checker. */
  inferredType?: ValueType;
  /** The condition expression (must evaluate to `bool`). */
  condition: ExprNode;
  /** The expression evaluated when the condition is true. */
  thenExpr: ExprNode;
  /** The expression evaluated when the condition is false. */
  elseExpr: ExprNode;
}

/**
 * A list display expression (e.g., `[1, 2, 3]`).
 *
 * Mirrors the Rust `Expr::ListExpr` variant.
 */
export interface ListExpr {
  /** Discriminant for tagged-union deserialization. */
  kind: 'ListExpr';
  /** Source location spanning the entire list expression. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** The type inferred by the type checker. */
  inferredType?: ValueType;
  /** The element expressions in the list. */
  elements: ExprNode[];
}

/**
 * A variable or name reference (e.g., `x`, `print`, `MyClass`).
 *
 * Mirrors the Rust `Expr::Identifier` variant. Also used in non-expression
 * contexts such as function names, class names, and parameter names.
 */
export interface Identifier {
  /** Discriminant for tagged-union deserialization. */
  kind: 'Identifier';
  /** Source location of the identifier token. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** The type inferred by the type checker. */
  inferredType?: ValueType;
  /** The identifier text. */
  name: string;
}

/**
 * An integer literal expression (e.g., `42`, `0`).
 *
 * Mirrors the Rust `Expr::IntegerLiteral` variant.
 */
export interface IntegerLiteral {
  /** Discriminant for tagged-union deserialization. */
  kind: 'IntegerLiteral';
  /** Source location of the literal token. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** The type inferred by the type checker. */
  inferredType?: ValueType;
  /** The numeric value of the literal. */
  value: number;
}

/**
 * A boolean literal expression (`True` or `False`).
 *
 * Mirrors the Rust `Expr::BooleanLiteral` variant.
 */
export interface BooleanLiteral {
  /** Discriminant for tagged-union deserialization. */
  kind: 'BooleanLiteral';
  /** Source location of the literal token. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** The type inferred by the type checker. */
  inferredType?: ValueType;
  /** `true` for `True`, `false` for `False`. */
  value: boolean;
}

/**
 * A string literal expression (e.g., `"hello"`).
 *
 * Mirrors the Rust `Expr::StringLiteral` variant.
 */
export interface StringLiteral {
  /** Discriminant for tagged-union deserialization. */
  kind: 'StringLiteral';
  /** Source location of the literal token. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** The type inferred by the type checker. */
  inferredType?: ValueType;
  /** The string content (without surrounding quotes). */
  value: string;
}

/**
 * A `None` literal expression.
 *
 * Mirrors the Rust `Expr::NoneLiteral` variant.
 */
export interface NoneLiteral {
  /** Discriminant for tagged-union deserialization. */
  kind: 'NoneLiteral';
  /** Source location of the literal token. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** The type inferred by the type checker. */
  inferredType?: ValueType;
}

// ── Literals (for VarDef initial values) ──────────────────────────────────────

/**
 * Subset of expression nodes that are valid as variable definition initializers.
 *
 * In ChocoPy, `VarDef` initializers must be compile-time literals — not arbitrary
 * expressions. This type enforces that constraint at the TypeScript level.
 */
export type Literal = IntegerLiteral | BooleanLiteral | StringLiteral | NoneLiteral;

// ── Statements ────────────────────────────────────────────────────────────────

/**
 * Discriminated union of all statement AST node types.
 *
 * Statements do not produce values (unlike {@link ExprNode}). Each variant
 * is identified by its `kind` field.
 */
export type Stmt = ExprStmt | AssignStmt | IfStmt | WhileStmt | ForStmt | ReturnStmt;

/**
 * An expression used as a statement (e.g., `print("hi")` on its own line).
 *
 * Mirrors the Rust `Stmt::ExprStmt` variant.
 */
export interface ExprStmt {
  /** Discriminant for tagged-union deserialization. */
  kind: 'ExprStmt';
  /** Source location spanning the entire expression statement. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** The expression being evaluated for its side effects. */
  expr: ExprNode;
}

/**
 * An assignment statement (e.g., `x = 5`, `a = b = expr` for chained assignment).
 *
 * Mirrors the Rust `Stmt::AssignStmt` variant. Multiple targets support
 * chained assignment like `a = b = 1`.
 */
export interface AssignStmt {
  /** Discriminant for tagged-union deserialization. */
  kind: 'AssignStmt';
  /** Source location spanning the entire assignment. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** The assignment targets (left-hand sides). Multiple targets for chained assignment. */
  targets: ExprNode[];
  /** The value expression being assigned. */
  value: ExprNode;
}

/**
 * An `if`/`elif`/`else` statement.
 *
 * Mirrors the Rust `Stmt::IfStmt` variant. `elif` branches are represented
 * as nested `IfStmt` nodes within `elseBody`.
 */
export interface IfStmt {
  /** Discriminant for tagged-union deserialization. */
  kind: 'IfStmt';
  /** Source location spanning the entire if statement. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** The condition expression (must evaluate to `bool`). */
  condition: ExprNode;
  /** Statements executed when the condition is true. */
  thenBody: Stmt[];
  /** Statements executed when the condition is false (may contain a nested {@link IfStmt} for `elif`). */
  elseBody: Stmt[];
}

/**
 * A `while` loop statement.
 *
 * Mirrors the Rust `Stmt::WhileStmt` variant.
 */
export interface WhileStmt {
  /** Discriminant for tagged-union deserialization. */
  kind: 'WhileStmt';
  /** Source location spanning the entire while statement. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** The loop condition expression (must evaluate to `bool`). */
  condition: ExprNode;
  /** The loop body statements. */
  body: Stmt[];
}

/**
 * A `for` loop statement (e.g., `for x in xs: ...`).
 *
 * Mirrors the Rust `Stmt::ForStmt` variant. ChocoPy `for` loops iterate
 * over lists or strings only.
 */
export interface ForStmt {
  /** Discriminant for tagged-union deserialization. */
  kind: 'ForStmt';
  /** Source location spanning the entire for statement. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** The loop variable identifier. */
  identifier: Identifier;
  /** The iterable expression (must be a list or string). */
  iterable: ExprNode;
  /** The loop body statements. */
  body: Stmt[];
}

/**
 * A `return` statement, optionally with a value.
 *
 * Mirrors the Rust `Stmt::ReturnStmt` variant. A bare `return` has `value: null`.
 */
export interface ReturnStmt {
  /** Discriminant for tagged-union deserialization. */
  kind: 'ReturnStmt';
  /** Source location spanning the entire return statement. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** The return value expression, or `null` for a bare `return`. */
  value: ExprNode | null;
}

// ── Declarations ──────────────────────────────────────────────────────────────

/**
 * Discriminated union of all declaration AST node types.
 *
 * Declarations appear at the top level of a {@link Program} or inside
 * {@link FuncDef} and {@link ClassDef} bodies.
 */
export type Declaration = VarDef | FuncDef | ClassDef | GlobalDecl | NonLocalDecl;

/**
 * A typed variable binding (e.g., `x: int` in a parameter list or variable definition).
 *
 * Mirrors the Rust `TypedVar` struct. Used in {@link VarDef} and {@link FuncDef} parameters.
 */
export interface TypedVar {
  /** Discriminant for tagged-union deserialization. */
  kind: 'TypedVar';
  /** Source location spanning the typed variable. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** The variable name. */
  identifier: Identifier;
  /** The declared type annotation. */
  type: TypeAnnotation;
}

/**
 * A variable definition with a type annotation and literal initializer (e.g., `x: int = 0`).
 *
 * Mirrors the Rust `Declaration::VarDef` variant. The initializer must be a
 * compile-time {@link Literal} per ChocoPy's static semantics.
 */
export interface VarDef {
  /** Discriminant for tagged-union deserialization. */
  kind: 'VarDef';
  /** Source location spanning the entire variable definition. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** The typed variable being defined (name + type annotation). */
  var: TypedVar;
  /** The literal initializer value (must be a compile-time literal). */
  value: Literal;
}

/**
 * A function definition (e.g., `def foo(x: int) -> int: ...`).
 *
 * Mirrors the Rust `Declaration::FuncDef` variant. Contains nested
 * declarations (local variables, nested functions) and body statements.
 */
export interface FuncDef {
  /** Discriminant for tagged-union deserialization. */
  kind: 'FuncDef';
  /** Source location spanning the entire function definition. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** The function name identifier. */
  name: Identifier;
  /** The function's formal parameters. */
  params: TypedVar[];
  /** The declared return type annotation. */
  returnType: TypeAnnotation;
  /** Local declarations (variables, nested functions, nested classes). */
  declarations: Declaration[];
  /** The function body statements. */
  statements: Stmt[];
}

/**
 * A class definition (e.g., `class Foo(Bar): ...`).
 *
 * Mirrors the Rust `Declaration::ClassDef` variant. ChocoPy supports single
 * inheritance only — `superClass` is always present (defaults to `object`).
 */
export interface ClassDef {
  /** Discriminant for tagged-union deserialization. */
  kind: 'ClassDef';
  /** Source location spanning the entire class definition. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** The class name identifier. */
  name: Identifier;
  /** The superclass identifier (always present; `object` if not explicitly specified). */
  superClass: Identifier;
  /** Class body declarations (attributes and methods). */
  declarations: Declaration[];
}

/**
 * A `global` declaration (e.g., `global x`).
 *
 * Mirrors the Rust `Declaration::GlobalDecl` variant. Declares that a name
 * in a function body refers to the module-level variable.
 */
export interface GlobalDecl {
  /** Discriminant for tagged-union deserialization. */
  kind: 'GlobalDecl';
  /** Source location spanning the global declaration. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** The global variable name being referenced. */
  variable: Identifier;
}

/**
 * A `nonlocal` declaration (e.g., `nonlocal x`).
 *
 * Mirrors the Rust `Declaration::NonLocalDecl` variant. Declares that a name
 * in a nested function body refers to an enclosing function's variable.
 */
export interface NonLocalDecl {
  /** Discriminant for tagged-union deserialization. */
  kind: 'NonLocalDecl';
  /** Source location spanning the nonlocal declaration. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** The nonlocal variable name being referenced. */
  variable: Identifier;
}

// ── Program ───────────────────────────────────────────────────────────────────

/**
 * A single compiler error (syntax or semantic) with source location.
 *
 * Mirrors the Rust `CompilerError` struct. The `syntax` flag distinguishes
 * parse errors from type-checking errors for UI rendering.
 */
export interface CompilerError {
  /** Discriminant for tagged-union deserialization. */
  kind: 'CompilerError';
  /** Source location where the error was detected. */
  location: LocationArray;
  /** Legacy error message field (from {@link NodeBase}). */
  errorMsg?: string;
  /** Human-readable error description. */
  message: string;
  /** `true` for syntax (parse) errors, `false` for semantic (type-check) errors. */
  syntax: boolean;
}

/**
 * Container for a list of {@link CompilerError} instances.
 *
 * Mirrors the Rust `Errors` struct. Attached to every {@link Program} node
 * to collect all errors encountered during compilation.
 */
export interface Errors {
  /** Discriminant for tagged-union deserialization. */
  kind: 'Errors';
  /** Source location spanning the error range (typically the full program). */
  location: LocationArray;
  /** All compiler errors collected during this compilation phase. */
  errors: CompilerError[];
}

/**
 * The root AST node representing an entire ChocoPy program.
 *
 * Mirrors the Rust `Program` struct. A program consists of top-level
 * declarations followed by top-level statements, plus an error container.
 */
export interface Program {
  /** Discriminant for tagged-union deserialization. */
  kind: 'Program';
  /** Source location spanning the entire program. */
  location: LocationArray;
  /** Compiler error message, if any. */
  errorMsg?: string;
  /** Top-level declarations (variables, functions, classes). */
  declarations: Declaration[];
  /** Top-level statements (executed at module scope). */
  statements: Stmt[];
  /** All errors collected during this compilation phase. */
  errors: Errors;
}

// ── Compile Result ────────────────────────────────────────────────────────────

/**
 * The complete output of the compiler pipeline: parse + type-check.
 *
 * Contains both the untyped AST (from parsing only) and the typed AST
 * (after type checking). The `errors` array aggregates all errors from
 * both phases, and `hasErrors` is a convenience flag.
 *
 * Returned by {@link compiler.compile | compile()} in the compiler module.
 */
export interface CompileResult {
  /** The AST produced by the parser, before type checking. */
  untypedAst: Program;
  /** The AST after type checking (nodes have `inferredType` populated). */
  typedAst: Program;
  /** All errors from both parsing and type-checking phases. */
  errors: CompilerError[];
  /** Convenience flag: `true` if `errors.length > 0`. */
  hasErrors: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Formats a {@link ValueType} into a human-readable string for display in the UI.
 *
 * Recursively formats list types using bracket notation (e.g., `[int]`, `[[bool]]`).
 * Returns an empty string for `undefined` (nodes that haven't been type-checked).
 *
 * @param vt - The value type to format, or `undefined`.
 * @returns A human-readable type string, or `''` if the type is undefined.
 *
 * @example
 * formatValueType({ kind: 'ClassValueType', className: 'int' });
 * // => "int"
 *
 * @example
 * formatValueType({ kind: 'ListValueType', elementType: { kind: 'ClassValueType', className: 'bool' } });
 * // => "[bool]"
 */
export function formatValueType(vt: ValueType | undefined): string {
  if (!vt) return '';
  if (vt.kind === 'ClassValueType') return vt.className;
  return `[${formatValueType(vt.elementType)}]`;
}

/**
 * Classifies an AST node `kind` string into a broad category for UI rendering.
 *
 * Used by the AST visualizer to apply category-specific colors and grouping.
 * See {@link getCategoryColor} for the corresponding color mapping.
 *
 * @param kind - The `kind` discriminant string from any AST node.
 * @returns One of `'declaration'`, `'statement'`, `'expression'`, `'type'`, or `'other'`.
 *
 * @example
 * getNodeCategory('FuncDef');    // => "declaration"
 * getNodeCategory('IfStmt');     // => "statement"
 * getNodeCategory('BinaryExpr'); // => "expression"
 * getNodeCategory('ClassType');  // => "type"
 */
export function getNodeCategory(
  kind: string
): 'declaration' | 'statement' | 'expression' | 'type' | 'other' {
  if (
    kind === 'ClassDef' ||
    kind === 'FuncDef' ||
    kind === 'VarDef' ||
    kind === 'GlobalDecl' ||
    kind === 'NonLocalDecl'
  )
    return 'declaration';
  if (
    kind === 'ExprStmt' ||
    kind === 'AssignStmt' ||
    kind === 'IfStmt' ||
    kind === 'WhileStmt' ||
    kind === 'ForStmt' ||
    kind === 'ReturnStmt'
  )
    return 'statement';
  if (
    kind === 'BinaryExpr' ||
    kind === 'UnaryExpr' ||
    kind === 'CallExpr' ||
    kind === 'MethodCallExpr' ||
    kind === 'MemberExpr' ||
    kind === 'IndexExpr' ||
    kind === 'IfExpr' ||
    kind === 'ListExpr' ||
    kind === 'Identifier' ||
    kind === 'IntegerLiteral' ||
    kind === 'BooleanLiteral' ||
    kind === 'StringLiteral' ||
    kind === 'NoneLiteral'
  )
    return 'expression';
  if (
    kind === 'ClassType' ||
    kind === 'ListType' ||
    kind === 'ClassValueType' ||
    kind === 'ListValueType'
  )
    return 'type';
  return 'other';
}

/**
 * Maps an AST node category to its corresponding CSS custom property color.
 *
 * Used by the AST tree visualizer to color-code nodes by category.
 * The CSS custom properties (`--ast-declaration`, etc.) are defined in the
 * app's theme stylesheet.
 *
 * @param category - A category returned by {@link getNodeCategory}.
 * @returns A CSS `var()` expression string for the category's color.
 *
 * @example
 * getCategoryColor('declaration'); // => "var(--ast-declaration)"
 * getCategoryColor('other');       // => "var(--text-muted)"
 */
export function getCategoryColor(category: ReturnType<typeof getNodeCategory>): string {
  switch (category) {
    case 'declaration':
      return 'var(--ast-declaration)';
    case 'statement':
      return 'var(--ast-statement)';
    case 'expression':
      return 'var(--ast-expression)';
    case 'type':
      return 'var(--ast-type)';
    default:
      return 'var(--text-muted)';
  }
}
