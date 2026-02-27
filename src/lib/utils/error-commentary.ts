/**
 * @fileoverview Enriches raw compiler errors with human-readable commentary.
 *
 * The ChocoPy/Typed Python compiler emits terse diagnostic messages that are
 * accurate but often unhelpful to students. This module pattern-matches each
 * {@link CompilerError} message against a catalog of known error shapes and
 * produces a friendlier explanation with concrete suggestions for fixing the
 * issue. When no pattern matches, the enriched error carries a `null`
 * commentary so the UI can fall back to showing the raw message alone.
 *
 * Architecture: Each pattern is tested sequentially in {@link generateCommentary}.
 * Order matters — more specific patterns (e.g. "argument type mismatch") appear
 * before broader ones (e.g. "not a function") to avoid false matches.
 */
import type { CompilerError } from '$lib/compiler/types';

/**
 * A compiler error paired with an optional human-readable explanation.
 *
 * Produced by {@link enrichErrors} and consumed by the error panel UI
 * to display both the original diagnostic and a friendlier commentary.
 */
export interface EnrichedError {
  /** The unmodified error object from the compiler. */
  original: CompilerError;
  /**
   * A plain-English explanation of the error with fix suggestions,
   * or `null` when no known pattern matches the error message.
   */
  commentary: string | null;
}

/**
 * Enriches an array of compiler errors with human-readable commentary
 * by pattern-matching each error message against known diagnostic shapes.
 *
 * The source code is used to extract the offending line for inclusion in
 * commentary text, giving students immediate context without needing to
 * cross-reference line numbers manually.
 *
 * @param errors - Raw compiler errors from a parse, type-check, or codegen phase.
 * @param source - The full source code string that was compiled (used for line lookups).
 * @returns An array of {@link EnrichedError} objects in the same order as the input.
 */
export function enrichErrors(errors: CompilerError[], source: string): EnrichedError[] {
  const lines = source.split('\n');

  return errors.map((error) => {
    const commentary = generateCommentary(error, lines);
    return { original: error, commentary };
  });
}

/**
 * Retrieves a trimmed source line by its 1-based line number.
 *
 * @internal
 * @param lines - The source code split into lines.
 * @param lineNum - 1-based line number (as reported by the compiler).
 * @returns The trimmed source line, or an empty string if the line number is out of range.
 */
function getSourceLine(lines: string[], lineNum: number): string {
  const idx = lineNum - 1;
  if (idx >= 0 && idx < lines.length) return lines[idx].trim();
  return '';
}

/**
 * Maps a single compiler error to a human-readable commentary string.
 *
 * Each block below tests a regex against the error message. The patterns are
 * ordered from most-specific to least-specific so that narrower matches
 * (e.g. "argument N has type") take priority over broader ones (e.g. "type mismatch").
 *
 * @internal
 * @param error - A single compiler error to generate commentary for.
 * @param lines - Source lines array for {@link getSourceLine} lookups.
 * @returns A plain-English explanation, or `null` if no pattern matches.
 */
function generateCommentary(error: CompilerError, lines: string[]): string | null {
  const msg = error.message;
  const loc = error.location;

  // Pattern: assignment / expression type incompatibility ("expected `X` but got `Y`")
  const typeMismatch = msg.match(/Type mismatch: expected `(.+?)` but got `(.+?)`/);
  if (typeMismatch) {
    const [, expectedType, gotType] = typeMismatch;
    return `The target expects ${expectedType}, but the expression evaluates to ${gotType}. These types are not compatible.`;
  }

  // Pattern: binary operator applied to incompatible operand types
  const binaryError = msg.match(/Cannot use `(.+?)` with `(.+?)` and `(.+?)`/);
  if (binaryError) {
    const [, op, leftType, rightType] = binaryError;
    const sourceLine = getSourceLine(lines, loc[0]);
    return `At line ${loc[0]}: "${sourceLine}" — the left side is ${leftType} and the right side is ${rightType}. The "${op}" operator cannot combine these types.`;
  }

  // Pattern: function called with wrong number of arguments (arity mismatch)
  const argCount = msg.match(/Wrong number of arguments: expected (\d+) but got (\d+)/);
  if (argCount) {
    const [, expected, got] = argCount;
    const sourceLine = getSourceLine(lines, loc[0]);
    const callMatch = sourceLine.match(/(\w+)\s*\(/);
    if (callMatch) {
      const funcName = callMatch[1];
      return `"${funcName}" expects ${expected} argument(s), but ${got} were passed at line ${loc[0]}: "${sourceLine}".`;
    }
    return null;
  }

  // Pattern: specific argument has wrong type (positional type mismatch)
  const argType = msg.match(/Argument (\d+) has type `(.+?)` but the parameter expects `(.+?)`/);
  if (argType) {
    const [, argNum, gotType, expectedType] = argType;
    const sourceLine = getSourceLine(lines, loc[0]);
    const callMatch = sourceLine.match(/(\w+)\s*\(/);
    if (callMatch) {
      const funcName = callMatch[1];
      return `In the call to "${funcName}" at line ${loc[0]}, argument ${argNum} is ${gotType} but the function parameter expects ${expectedType}.`;
    }
    return null;
  }

  // Pattern: identifier exists in scope but is not a variable (e.g. function/class name used as lvalue)
  const notVar = msg.match(/`(.+?)` is not a variable in this scope/);
  if (notVar) {
    const [, name] = notVar;
    return `"${name}" exists in this scope but is a function or class name. Only variables (declared with a type annotation) can be assigned to.`;
  }

  // Pattern: non-bool expression used as if/while/elif condition (no implicit truthiness)
  const condError = msg.match(/Condition must be `bool`, but this expression is `(.+?)`/);
  if (condError) {
    const [, actualType] = condError;
    const sourceLine = getSourceLine(lines, loc[0]);
    return `At line ${loc[0]}: "${sourceLine}" — the condition expression is ${actualType}. In Typed Python, conditions must be bool. Try comparing with a value, e.g. "x != 0" or "x is not None".`;
  }

  // Pattern: same name declared twice in a single scope (variable, function, or class)
  const dupError = msg.match(/Duplicate declaration of `(.+?)` in the same scope/);
  if (dupError) {
    return `Each name can only be declared once per scope.`;
  }

  // Pattern: function with a return type annotation has branches that fall through without returning
  const returnError = msg.match(/Not all paths in `(.+?)` have a return statement/);
  if (returnError) {
    const [, funcName] = returnError;
    return `The function "${funcName}" has code paths that don't end with a return statement. If the function should return a value, add return statements to all branches (if/else).`;
  }

  // Pattern: type annotation references a class name that does not exist
  const invalidType = msg.match(/Invalid type annotation: there is no class named `(.+?)`/);
  if (invalidType) {
    const [, typeName] = invalidType;
    return `"${typeName}" is used as a type but no class with that name exists. Check for typos. Available built-in types are: int, bool, str, object.`;
  }

  // Pattern: subscript operator [] applied to a non-indexable type (not str or list)
  const indexError = msg.match(/Cannot index into type `(.+?)`/);
  if (indexError) {
    const [, typeName] = indexError;
    return `Only str and list types support indexing with []. The expression has type ${typeName}, which cannot be indexed.`;
  }

  // Pattern: for-loop target expression is not an iterable type (not str or list)
  const iterError = msg.match(/Cannot iterate over type `(.+?)`/);
  if (iterError) {
    const [, typeName] = iterError;
    return `Only str and list types can be used in a for loop. The expression has type ${typeName}.`;
  }

  // Pattern: unary operator (-, not) applied to an incompatible operand type
  const unaryError = msg.match(/Cannot apply `(.+?)` to type `(.+?)`/);
  if (unaryError) {
    const [, op, operandType] = unaryError;
    const sourceLine = getSourceLine(lines, loc[0]);
    if (op === '-') {
      return `At line ${loc[0]}: "${sourceLine}" — the negation operator "-" requires an int, but this expression is ${operandType}.`;
    }
    return `At line ${loc[0]}: "${sourceLine}" — the "${op}" operator cannot be applied to type ${operandType}.`;
  }

  // Pattern: dot-access on a primitive or non-class type (e.g. int.foo)
  const memberError = msg.match(/Cannot access a member of type `(.+?)`/);
  if (memberError) {
    const [, typeName] = memberError;
    const sourceLine = getSourceLine(lines, loc[0]);
    return `At line ${loc[0]}: "${sourceLine}" — you're trying to access an attribute on a ${typeName} value. Only class instances have accessible attributes.`;
  }

  // Pattern: attribute access on a class instance for an attribute not defined in the class body
  const attrError = msg.match(/Class `(.+?)` has no attribute named `(.+?)`/);
  if (attrError) {
    const [, className, attrName] = attrError;
    return `The class "${className}" does not define an attribute "${attrName}". Check the class definition for available attributes, or add "${attrName}" as a class variable.`;
  }

  // Pattern: method call on a class instance for a method not defined in the class hierarchy
  const methodError = msg.match(/Class `(.+?)` has no method named `(.+?)`/);
  if (methodError) {
    const [, className, methodName] = methodError;
    return `The class "${className}" does not define a method "${methodName}". Check the class definition for available methods, or define "${methodName}" in the class body.`;
  }

  // Pattern: call expression on an identifier that is neither a function nor a class constructor
  const notFuncError = msg.match(/`(.+?)` is not a function or class/);
  if (notFuncError) {
    const [, name] = notFuncError;
    return `"${name}" is not defined as a function or class in this scope.`;
  }

  // Pattern: assignment to a variable from an outer scope without global/nonlocal declaration
  const nonlocalAssign = msg.match(
    /Cannot assign to `(.+?)` because it is not explicitly declared/
  );
  if (nonlocalAssign) {
    const [, name] = nonlocalAssign;
    return `"${name}" is defined in an outer scope. To assign to it here, add a "global ${name}" or "nonlocal ${name}" declaration at the top of this function.`;
  }

  // Pattern: class extends a superclass name that has not been defined
  const superUndef = msg.match(/Super-class `(.+?)` is not defined/);
  if (superUndef) {
    const [, name] = superUndef;
    return `You're trying to extend "${name}", but no class with that name has been defined yet. Define "${name}" before this class definition.`;
  }

  // Pattern: subclass overrides a parent method but changes its type signature
  const overrideError = msg.match(/Method `(.+?)` is overridden with a different type signature/);
  if (overrideError) {
    const [, methodName] = overrideError;
    return `The method "${methodName}" in this class has a different signature than the parent's version. Overriding methods must match the parent's parameter types and return type exactly.`;
  }

  // Pattern: attempt to assign to a string index (strings are immutable in ChocoPy)
  if (msg.includes('Strings are immutable')) {
    const sourceLine = getSourceLine(lines, loc[0]);
    return `At line ${loc[0]}: "${sourceLine}" — strings in Typed Python are immutable. You cannot modify individual characters. Consider building a new string instead.`;
  }

  // Pattern: return statement used outside any function body (at module top level)
  if (msg.includes('cannot appear at the top level')) {
    return `"return" can only be used inside a function or method body. If you want to stop program execution, remove this return statement.`;
  }

  // Pattern: function declares a non-None return type but implicitly returns None
  const noneReturn = msg.match(/Expected return type `(.+?)` but the function returns `None`/);
  if (noneReturn) {
    const [, expectedType] = noneReturn;
    return `This function is declared to return ${expectedType}, but some code paths end without returning a value (implicitly returning None). Add an explicit return statement.`;
  }

  // Pattern: "global x" declaration but x does not exist at module top level
  const notGlobal = msg.match(/`(.+?)` is not a global variable/);
  if (notGlobal) {
    const [, name] = notGlobal;
    return `You declared "global ${name}", but "${name}" is not defined at the top level of the program. Add a variable definition for "${name}" at the global scope.`;
  }

  // Pattern: "nonlocal x" declaration but x does not exist in any enclosing function scope
  const notNonlocal = msg.match(/`(.+?)` is not a nonlocal variable/);
  if (notNonlocal) {
    const [, name] = notNonlocal;
    return `You declared "nonlocal ${name}", but "${name}" is not defined in any enclosing function scope. The nonlocal keyword requires the variable to exist in a parent (non-global) scope.`;
  }

  // Pattern: variable or function declaration reuses an existing class name in the same scope
  const shadowError = msg.match(/Cannot shadow class name `(.+?)`/);
  if (shadowError) {
    const [, name] = shadowError;
    return `"${name}" is already defined as a class. Variables and functions cannot reuse class names within the same scope.`;
  }

  return null;
}
