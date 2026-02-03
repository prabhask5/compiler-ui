// AST node formatting helpers

// Fields to skip in tree display (metadata, not structural)
const SKIP_FIELDS = new Set(['kind', 'location', 'errorMsg', 'inferredType']);

// Fields that are always scalar values (not objects to recurse into)
const SCALAR_FIELDS = new Set(['name', 'value', 'operator', 'className', 'syntax', 'message']);

export function getNodeSummary(node: Record<string, unknown>): string {
  if (!node || typeof node !== 'object') return '';

  const kind = node.kind as string;
  switch (kind) {
    case 'Identifier':
      return `"${node.name}"`;
    case 'IntegerLiteral':
      return String(node.value);
    case 'BooleanLiteral':
      return String(node.value);
    case 'StringLiteral':
      return `"${truncate(String(node.value), 40)}"`;
    case 'NoneLiteral':
      return 'None';
    case 'BinaryExpr':
      return String(node.operator);
    case 'UnaryExpr':
      return String(node.operator);
    case 'ClassType':
      return String(node.className);
    case 'ClassValueType':
      return String(node.className);
    case 'VarDef':
      return '';
    case 'FuncDef':
      return `${(node.name as Record<string, unknown>)?.name || ''}()`;
    case 'ClassDef':
      return String((node.name as Record<string, unknown>)?.name || '');
    case 'GlobalDecl':
    case 'NonLocalDecl':
      return String((node.variable as Record<string, unknown>)?.name || '');
    case 'AssignStmt':
      return '';
    case 'CallExpr': {
      const fn = node.function as Record<string, unknown>;
      return fn?.name ? `${fn.name}()` : '';
    }
    case 'MethodCallExpr': {
      const method = node.method as Record<string, unknown>;
      const member = method?.member as Record<string, unknown>;
      return member?.name ? `.${member.name}()` : '';
    }
    case 'MemberExpr': {
      const m = node.member as Record<string, unknown>;
      return m?.name ? `.${m.name}` : '';
    }
    case 'CompilerError':
      return truncate(String(node.message), 60);
    default:
      return '';
  }
}

export interface NodeChild {
  key: string;
  value: unknown;
}

export function getNodeChildren(node: Record<string, unknown>): NodeChild[] {
  if (!node || typeof node !== 'object') return [];

  const children: NodeChild[] = [];

  for (const [key, value] of Object.entries(node)) {
    if (SKIP_FIELDS.has(key)) continue;
    if (value === null || value === undefined) continue;

    if (
      SCALAR_FIELDS.has(key) &&
      (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    ) {
      children.push({ key, value });
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      children.push({ key, value });
    } else if (typeof value === 'object') {
      children.push({ key, value });
    } else {
      children.push({ key, value });
    }
  }

  return children;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}
