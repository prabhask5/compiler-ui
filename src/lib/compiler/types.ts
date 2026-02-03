// ChocoPy AST TypeScript types — mirrors the Rust serde output

export interface Position {
  row: number;
  col: number;
}

export interface Location {
  start: Position;
  end: Position;
}

// Location is serialized as [start_row, start_col, end_row, end_col]
export type LocationArray = [number, number, number, number];

export function parseLocation(loc: LocationArray): Location {
  return {
    start: { row: loc[0], col: loc[1] },
    end: { row: loc[2], col: loc[3] }
  };
}

export interface NodeBase {
  location: LocationArray;
  errorMsg?: string;
}

// ── Types ──

export type TypeAnnotation = ClassType | ListType;

export interface ClassType {
  kind: 'ClassType';
  location: LocationArray;
  errorMsg?: string;
  className: string;
}

export interface ListType {
  kind: 'ListType';
  location: LocationArray;
  errorMsg?: string;
  elementType: TypeAnnotation;
}

export type ValueType = ClassValueType | ListValueType;

export interface ClassValueType {
  kind: 'ClassValueType';
  className: string;
}

export interface ListValueType {
  kind: 'ListValueType';
  elementType: ValueType;
}

// ── Expressions ──

export interface Expr {
  inferredType?: ValueType;
}

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

export type ExprNode = ExprContent & Expr;

export interface BinaryExpr {
  kind: 'BinaryExpr';
  location: LocationArray;
  errorMsg?: string;
  inferredType?: ValueType;
  left: ExprNode;
  operator: string;
  right: ExprNode;
}

export interface UnaryExpr {
  kind: 'UnaryExpr';
  location: LocationArray;
  errorMsg?: string;
  inferredType?: ValueType;
  operator: string;
  operand: ExprNode;
}

export interface CallExpr {
  kind: 'CallExpr';
  location: LocationArray;
  errorMsg?: string;
  inferredType?: ValueType;
  function: Identifier;
  args: ExprNode[];
}

export interface MethodCallExpr {
  kind: 'MethodCallExpr';
  location: LocationArray;
  errorMsg?: string;
  inferredType?: ValueType;
  method: MemberExpr;
  args: ExprNode[];
}

export interface MemberExpr {
  kind: 'MemberExpr';
  location: LocationArray;
  errorMsg?: string;
  inferredType?: ValueType;
  object: ExprNode;
  member: Identifier;
}

export interface IndexExpr {
  kind: 'IndexExpr';
  location: LocationArray;
  errorMsg?: string;
  inferredType?: ValueType;
  list: ExprNode;
  index: ExprNode;
}

export interface IfExpr {
  kind: 'IfExpr';
  location: LocationArray;
  errorMsg?: string;
  inferredType?: ValueType;
  condition: ExprNode;
  thenExpr: ExprNode;
  elseExpr: ExprNode;
}

export interface ListExpr {
  kind: 'ListExpr';
  location: LocationArray;
  errorMsg?: string;
  inferredType?: ValueType;
  elements: ExprNode[];
}

export interface Identifier {
  kind: 'Identifier';
  location: LocationArray;
  errorMsg?: string;
  inferredType?: ValueType;
  name: string;
}

export interface IntegerLiteral {
  kind: 'IntegerLiteral';
  location: LocationArray;
  errorMsg?: string;
  inferredType?: ValueType;
  value: number;
}

export interface BooleanLiteral {
  kind: 'BooleanLiteral';
  location: LocationArray;
  errorMsg?: string;
  inferredType?: ValueType;
  value: boolean;
}

export interface StringLiteral {
  kind: 'StringLiteral';
  location: LocationArray;
  errorMsg?: string;
  inferredType?: ValueType;
  value: string;
}

export interface NoneLiteral {
  kind: 'NoneLiteral';
  location: LocationArray;
  errorMsg?: string;
  inferredType?: ValueType;
}

// ── Literals (for VarDef initial values) ──

export type Literal = IntegerLiteral | BooleanLiteral | StringLiteral | NoneLiteral;

// ── Statements ──

export type Stmt = ExprStmt | AssignStmt | IfStmt | WhileStmt | ForStmt | ReturnStmt;

export interface ExprStmt {
  kind: 'ExprStmt';
  location: LocationArray;
  errorMsg?: string;
  expr: ExprNode;
}

export interface AssignStmt {
  kind: 'AssignStmt';
  location: LocationArray;
  errorMsg?: string;
  targets: ExprNode[];
  value: ExprNode;
}

export interface IfStmt {
  kind: 'IfStmt';
  location: LocationArray;
  errorMsg?: string;
  condition: ExprNode;
  thenBody: Stmt[];
  elseBody: Stmt[];
}

export interface WhileStmt {
  kind: 'WhileStmt';
  location: LocationArray;
  errorMsg?: string;
  condition: ExprNode;
  body: Stmt[];
}

export interface ForStmt {
  kind: 'ForStmt';
  location: LocationArray;
  errorMsg?: string;
  identifier: Identifier;
  iterable: ExprNode;
  body: Stmt[];
}

export interface ReturnStmt {
  kind: 'ReturnStmt';
  location: LocationArray;
  errorMsg?: string;
  value: ExprNode | null;
}

// ── Declarations ──

export type Declaration = VarDef | FuncDef | ClassDef | GlobalDecl | NonLocalDecl;

export interface TypedVar {
  kind: 'TypedVar';
  location: LocationArray;
  errorMsg?: string;
  identifier: Identifier;
  type: TypeAnnotation;
}

export interface VarDef {
  kind: 'VarDef';
  location: LocationArray;
  errorMsg?: string;
  var: TypedVar;
  value: Literal;
}

export interface FuncDef {
  kind: 'FuncDef';
  location: LocationArray;
  errorMsg?: string;
  name: Identifier;
  params: TypedVar[];
  returnType: TypeAnnotation;
  declarations: Declaration[];
  statements: Stmt[];
}

export interface ClassDef {
  kind: 'ClassDef';
  location: LocationArray;
  errorMsg?: string;
  name: Identifier;
  superClass: Identifier;
  declarations: Declaration[];
}

export interface GlobalDecl {
  kind: 'GlobalDecl';
  location: LocationArray;
  errorMsg?: string;
  variable: Identifier;
}

export interface NonLocalDecl {
  kind: 'NonLocalDecl';
  location: LocationArray;
  errorMsg?: string;
  variable: Identifier;
}

// ── Program ──

export interface CompilerError {
  kind: 'CompilerError';
  location: LocationArray;
  errorMsg?: string;
  message: string;
  syntax: boolean;
}

export interface Errors {
  kind: 'Errors';
  location: LocationArray;
  errors: CompilerError[];
}

export interface Program {
  kind: 'Program';
  location: LocationArray;
  errorMsg?: string;
  declarations: Declaration[];
  statements: Stmt[];
  errors: Errors;
}

// ── Compile Result ──

export interface CompileResult {
  untypedAst: Program;
  typedAst: Program;
  errors: CompilerError[];
  hasErrors: boolean;
}

// ── Helpers ──

export function formatValueType(vt: ValueType | undefined): string {
  if (!vt) return '';
  if (vt.kind === 'ClassValueType') return vt.className;
  return `[${formatValueType(vt.elementType)}]`;
}

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
