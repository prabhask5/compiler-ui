import type {
  Program,
  Declaration,
  Stmt,
  ExprNode,
  FuncDef,
  ClassDef,
  TypeAnnotation,
  LocationArray
} from '$lib/compiler/types';

export interface VariableLifetime {
  name: string;
  declLine: number;
  scopeEndLine: number;
  usageLines: number[];
  color: string;
  scope: string;
}

const PALETTE = [
  '#818cf8', // indigo
  '#34d399', // emerald
  '#f59e0b', // amber
  '#f472b6', // pink
  '#60a5fa', // blue
  '#a78bfa', // violet
  '#fb923c', // orange
  '#2dd4bf', // teal
  '#e879f9', // fuchsia
  '#4ade80'  // green
];

function formatTypeAnnotation(t: TypeAnnotation): string {
  if (t.kind === 'ClassType') return t.className;
  return `[${formatTypeAnnotation(t.elementType)}]`;
}

export function analyzeLifetimes(program: Program): VariableLifetime[] {
  const lifetimes: VariableLifetime[] = [];
  let colorIndex = 0;

  function nextColor(): string {
    const c = PALETTE[colorIndex % PALETTE.length];
    colorIndex++;
    return c;
  }

  function findUsages(name: string, stmts: Stmt[]): number[] {
    const lines: number[] = [];

    function walkExpr(expr: ExprNode) {
      if (expr.kind === 'Identifier' && expr.name === name) {
        lines.push(expr.location[0]);
      }
      if (expr.kind === 'BinaryExpr') {
        walkExpr(expr.left);
        walkExpr(expr.right);
      }
      if (expr.kind === 'UnaryExpr') walkExpr(expr.operand);
      if (expr.kind === 'CallExpr') {
        if (expr.function.name === name) lines.push(expr.function.location[0]);
        expr.args.forEach(walkExpr);
      }
      if (expr.kind === 'MethodCallExpr') {
        walkExpr(expr.method.object);
        expr.args.forEach(walkExpr);
      }
      if (expr.kind === 'MemberExpr') walkExpr(expr.object);
      if (expr.kind === 'IndexExpr') {
        walkExpr(expr.list);
        walkExpr(expr.index);
      }
      if (expr.kind === 'IfExpr') {
        walkExpr(expr.condition);
        walkExpr(expr.thenExpr);
        walkExpr(expr.elseExpr);
      }
      if (expr.kind === 'ListExpr') expr.elements.forEach(walkExpr);
    }

    function walkStmt(stmt: Stmt) {
      switch (stmt.kind) {
        case 'ExprStmt':
          walkExpr(stmt.expr);
          break;
        case 'AssignStmt':
          stmt.targets.forEach(walkExpr);
          walkExpr(stmt.value);
          break;
        case 'IfStmt':
          walkExpr(stmt.condition);
          stmt.thenBody.forEach(walkStmt);
          stmt.elseBody.forEach(walkStmt);
          break;
        case 'WhileStmt':
          walkExpr(stmt.condition);
          stmt.body.forEach(walkStmt);
          break;
        case 'ForStmt':
          if (stmt.identifier.name === name) lines.push(stmt.identifier.location[0]);
          walkExpr(stmt.iterable);
          stmt.body.forEach(walkStmt);
          break;
        case 'ReturnStmt':
          if (stmt.value) walkExpr(stmt.value);
          break;
      }
    }

    stmts.forEach(walkStmt);
    return [...new Set(lines)].sort((a, b) => a - b);
  }

  function walkDeclarations(decls: Declaration[], stmts: Stmt[], scope: string, scopeEnd: number) {
    for (const decl of decls) {
      if (decl.kind === 'VarDef') {
        const name = decl.var.identifier.name;
        lifetimes.push({
          name,
          declLine: decl.location[0],
          scopeEndLine: scopeEnd,
          usageLines: findUsages(name, stmts),
          color: nextColor(),
          scope
        });
      } else if (decl.kind === 'FuncDef') {
        walkFuncDef(decl, scope);
      } else if (decl.kind === 'ClassDef') {
        walkClassDef(decl, scope);
      }
    }
  }

  function walkFuncDef(func: FuncDef, parentScope: string) {
    const funcScope = parentScope ? `${parentScope}.${func.name.name}` : func.name.name;
    const funcEnd = func.location[2];

    for (const param of func.params) {
      const name = param.identifier.name;
      lifetimes.push({
        name,
        declLine: param.location[0],
        scopeEndLine: funcEnd,
        usageLines: findUsages(name, func.statements),
        color: nextColor(),
        scope: funcScope
      });
    }

    walkDeclarations(func.declarations, func.statements, funcScope, funcEnd);
  }

  function walkClassDef(cls: ClassDef, parentScope: string) {
    const classScope = parentScope ? `${parentScope}.${cls.name.name}` : cls.name.name;
    for (const decl of cls.declarations) {
      if (decl.kind === 'FuncDef') walkFuncDef(decl, classScope);
    }
  }

  const programEnd = program.location[2];
  walkDeclarations(program.declarations, program.statements, '', programEnd);

  return lifetimes;
}
