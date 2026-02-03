import type {
  Program,
  Declaration,
  Stmt,
  ExprNode,
  FuncDef,
  ClassDef,
  VarDef,
  TypeAnnotation,
  LocationArray,
  ValueType
} from '$lib/compiler/types';
import { formatValueType } from '$lib/compiler/types';

export interface DeclarationInfo {
  name: string;
  declaredType: string;
  location: LocationArray;
  scope: string;
  kind: 'variable' | 'parameter' | 'attribute';
}

export type DeclarationMap = Map<string, DeclarationInfo[]>;

function formatTypeAnnotation(t: TypeAnnotation): string {
  if (t.kind === 'ClassType') return t.className;
  return `[${formatTypeAnnotation(t.elementType)}]`;
}

export function buildDeclarationMap(program: Program): DeclarationMap {
  const map: DeclarationMap = new Map();

  function addDecl(info: DeclarationInfo) {
    const existing = map.get(info.name) ?? [];
    existing.push(info);
    map.set(info.name, existing);
  }

  function walkDeclarations(decls: Declaration[], scope: string) {
    for (const decl of decls) {
      if (decl.kind === 'VarDef') {
        addDecl({
          name: decl.var.identifier.name,
          declaredType: formatTypeAnnotation(decl.var.type),
          location: decl.location,
          scope,
          kind: 'variable'
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

    // Register parameters
    for (const param of func.params) {
      addDecl({
        name: param.identifier.name,
        declaredType: formatTypeAnnotation(param.type),
        location: param.location,
        scope: funcScope,
        kind: 'parameter'
      });
    }

    // Walk nested declarations
    walkDeclarations(func.declarations, funcScope);
  }

  function walkClassDef(cls: ClassDef, parentScope: string) {
    const classScope = parentScope ? `${parentScope}.${cls.name.name}` : cls.name.name;

    for (const decl of cls.declarations) {
      if (decl.kind === 'VarDef') {
        addDecl({
          name: decl.var.identifier.name,
          declaredType: formatTypeAnnotation(decl.var.type),
          location: decl.location,
          scope: classScope,
          kind: 'attribute'
        });
      } else if (decl.kind === 'FuncDef') {
        walkFuncDef(decl, classScope);
      }
    }
  }

  // Walk top-level declarations
  walkDeclarations(program.declarations, '');

  return map;
}

export interface TypeProvenanceInfo {
  text: string;
  declarationLocation?: LocationArray;
}

export function getTypeProvenance(
  node: Record<string, unknown>,
  declarationMap: DeclarationMap
): TypeProvenanceInfo | null {
  const kind = node.kind as string;
  const inferredType = node.inferredType as ValueType | undefined;
  if (!inferredType) return null;

  const typeStr = formatValueType(inferredType);

  if (kind === 'Identifier') {
    const name = node.name as string;
    const decls = declarationMap.get(name);
    if (decls && decls.length > 0) {
      // Use the last declaration (most specific scope)
      const decl = decls[decls.length - 1];
      const kindLabel =
        decl.kind === 'parameter' ? 'parameter' : decl.kind === 'attribute' ? 'attribute' : 'variable';
      return {
        text: `"${name}" declared as ${kindLabel} of type ${decl.declaredType} at line ${decl.location[0]}`,
        declarationLocation: decl.location
      };
    }
    return { text: `"${name}" has type ${typeStr}` };
  }

  if (kind === 'BinaryExpr') {
    const op = node.operator as string;
    const left = node.left as Record<string, unknown>;
    const right = node.right as Record<string, unknown>;
    const leftType = left?.inferredType ? formatValueType(left.inferredType as ValueType) : '?';
    const rightType = right?.inferredType ? formatValueType(right.inferredType as ValueType) : '?';
    return {
      text: `${op} on ${leftType} and ${rightType} produces ${typeStr}`
    };
  }

  if (kind === 'UnaryExpr') {
    const op = node.operator as string;
    const operand = node.operand as Record<string, unknown>;
    const operandType = operand?.inferredType
      ? formatValueType(operand.inferredType as ValueType)
      : '?';
    return { text: `${op} on ${operandType} produces ${typeStr}` };
  }

  if (kind === 'CallExpr') {
    const func = node.function as Record<string, unknown>;
    const funcName = func?.name as string;
    return { text: `${funcName}() returns ${typeStr}` };
  }

  if (kind === 'MethodCallExpr') {
    const method = node.method as Record<string, unknown>;
    const member = method?.member as Record<string, unknown>;
    const methodName = member?.name as string;
    return { text: `.${methodName}() returns ${typeStr}` };
  }

  if (kind === 'MemberExpr') {
    const member = node.member as Record<string, unknown>;
    const memberName = member?.name as string;
    return { text: `Attribute .${memberName} has type ${typeStr}` };
  }

  if (kind === 'IndexExpr') {
    return { text: `Index expression produces ${typeStr}` };
  }

  if (kind === 'IfExpr') {
    return { text: `Conditional expression produces ${typeStr}` };
  }

  if (kind === 'ListExpr') {
    return { text: `List literal has type ${typeStr}` };
  }

  if (kind === 'IntegerLiteral') {
    return { text: `Integer literal is always int` };
  }

  if (kind === 'BooleanLiteral') {
    return { text: `Boolean literal is always bool` };
  }

  if (kind === 'StringLiteral') {
    return { text: `String literal is always str` };
  }

  if (kind === 'NoneLiteral') {
    return { text: `None literal is always <None>` };
  }

  return { text: `Type: ${typeStr}` };
}
