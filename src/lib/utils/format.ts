/**
 * @fileoverview AST node formatting helpers for the interactive tree visualization.
 *
 * The compiler emits AST nodes as plain JSON objects with a `kind` discriminator
 * field. This module provides two complementary functions for rendering those
 * nodes in a collapsible tree view:
 *
 * - {@link getNodeSummary} produces a short inline label for a node (e.g. the
 *   identifier name, literal value, or operator symbol) so each tree row is
 *   scannable at a glance.
 * - {@link getNodeChildren} determines which fields of a node should appear as
 *   expandable child rows, filtering out internal metadata and surfacing scalar
 *   values alongside structural sub-trees.
 *
 * Together they decouple the tree UI component from any knowledge of specific
 * AST node shapes — the component simply calls these two functions and renders
 * whatever comes back.
 */

/**
 * AST metadata fields excluded from the tree display.
 *
 * These fields are present on every node but carry bookkeeping data (node
 * discriminator, source location, error state, inferred type) rather than
 * structural children. Showing them would clutter the tree without adding
 * pedagogical value.
 *
 * @internal
 */
const SKIP_FIELDS = new Set(['kind', 'location', 'errorMsg', 'inferredType']);

/**
 * Fields whose values are always primitives (string, number, boolean).
 *
 * When one of these fields appears on a node, it is rendered as a leaf
 * value rather than being recursed into — even if the field name might
 * suggest a nested object in other contexts. This prevents, for example,
 * an `Identifier` node's `name` string from being treated as an object.
 *
 * @internal
 */
const SCALAR_FIELDS = new Set(['name', 'value', 'operator', 'className', 'syntax', 'message']);

/**
 * Produces a concise inline summary string for a single AST node.
 *
 * The summary is displayed next to the node's `kind` label in the tree view,
 * giving users immediate context. For example, an `Identifier` node shows its
 * name in quotes, a `BinaryExpr` shows its operator, and a `FuncDef` shows
 * the function name followed by `()`.
 *
 * @param node - A plain-object AST node with at least a `kind` field.
 * @returns A short display string, or an empty string if no meaningful summary
 *          can be derived for the node's kind.
 */
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

/**
 * A single child entry extracted from an AST node for tree rendering.
 *
 * The tree UI iterates over an array of these to render expandable rows.
 * Scalar values are displayed inline; object/array values become nested
 * sub-trees.
 */
export interface NodeChild {
  /** The field name on the parent AST node (e.g. `"left"`, `"body"`, `"name"`). */
  key: string;
  /** The field value — may be a primitive, a nested AST node object, or an array of nodes. */
  value: unknown;
}

/**
 * Extracts the renderable child entries from an AST node.
 *
 * Walks the node's own enumerable properties, skipping fields listed in
 * {@link SKIP_FIELDS} and null/undefined values. Fields in {@link SCALAR_FIELDS}
 * are emitted as leaf entries when their runtime value is a primitive. All
 * remaining fields (objects, arrays) are emitted as sub-tree entries for
 * recursive rendering.
 *
 * @param node - A plain-object AST node.
 * @returns An ordered array of {@link NodeChild} entries to render as tree rows.
 */
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

/**
 * Collects all typed AST nodes in bottom-up (deepest-first) order.
 *
 * Walks the AST recursively, recording every node that has both an
 * `inferredType` (truthy) and a `location` (4-element array). Nodes are
 * sorted by depth descending (leaves first), with ties broken by source
 * position (earlier in file first). This ordering simulates how a type
 * checker infers types from literals/identifiers upward through expressions.
 *
 * @param root - The root AST node (typically a Program).
 * @returns An array of location key strings (`location.join(',')`) in reveal order.
 */
export function collectTypedNodesBottomUp(root: unknown): string[] {
  const entries: { locationKey: string; depth: number; pos: number }[] = [];

  function walk(node: unknown, depth: number): void {
    if (!node || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth);
      return;
    }

    const obj = node as Record<string, unknown>;

    // Recurse into children first (same traversal as getNodeChildren)
    for (const [key, value] of Object.entries(obj)) {
      if (SKIP_FIELDS.has(key)) continue;
      if (value === null || value === undefined) continue;
      if (
        SCALAR_FIELDS.has(key) &&
        (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
      ) {
        continue;
      }
      walk(value, depth + 1);
    }

    // Record this node if it has type info and a location
    const loc = obj.location as number[] | undefined;
    if (obj.inferredType && Array.isArray(loc) && loc.length === 4) {
      entries.push({
        locationKey: loc.join(','),
        depth,
        pos: loc[0] * 10000 + loc[1]
      });
    }
  }

  walk(root, 0);

  // Sort: deepest first, then by source position (earlier first)
  entries.sort((a, b) => b.depth - a.depth || a.pos - b.pos);

  return entries.map((e) => e.locationKey);
}

/**
 * Truncates a string to a maximum length, appending an ellipsis if needed.
 *
 * Used by {@link getNodeSummary} to keep inline labels from overflowing
 * the tree view when string literals or error messages are long.
 *
 * @internal
 * @param s - The string to truncate.
 * @param max - Maximum allowed character count before truncation.
 * @returns The original string if within the limit, otherwise a truncated version ending with "...".
 */
function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}
