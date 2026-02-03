import type { CompilerError, Program, LocationArray } from '$lib/compiler/types';
import type { DeclarationMap, DeclarationInfo } from './declarations';

export interface EnrichedError {
  original: CompilerError;
  commentary: string | null;
}

/**
 * Enriches compiler errors with human-readable commentary by cross-referencing
 * the error message and location against the declaration map (type provenance).
 *
 * For type mismatches: explains where each type was inferred from.
 * For undefined/scope errors: suggests what the name might refer to.
 * For argument errors: shows the function signature context.
 */
export function enrichErrors(
  errors: CompilerError[],
  declarationMap: DeclarationMap | undefined,
  source: string
): EnrichedError[] {
  if (!declarationMap) {
    return errors.map((e) => ({ original: e, commentary: null }));
  }

  const lines = source.split('\n');

  return errors.map((error) => {
    const commentary = generateCommentary(error, declarationMap, lines);
    return { original: error, commentary };
  });
}

function getSourceLine(lines: string[], lineNum: number): string {
  const idx = lineNum - 1;
  if (idx >= 0 && idx < lines.length) return lines[idx].trim();
  return '';
}

function generateCommentary(
  error: CompilerError,
  declarationMap: DeclarationMap,
  lines: string[]
): string | null {
  const msg = error.message;
  const loc = error.location;

  // Type mismatch: "Type mismatch: expected `X` but got `Y`..."
  const typeMismatch = msg.match(/Type mismatch: expected `(.+?)` but got `(.+?)`/);
  if (typeMismatch) {
    const [, expectedType, gotType] = typeMismatch;
    const sourceLine = getSourceLine(lines, loc[0]);

    // Try to find what variable is being assigned to
    const assignMatch = sourceLine.match(/^(\w+)\s*=/);
    if (assignMatch) {
      const varName = assignMatch[1];
      const decls = declarationMap.get(varName);
      if (decls && decls.length > 0) {
        const decl = decls[decls.length - 1];
        return `"${varName}" was declared as ${decl.declaredType} at line ${decl.location[0]}: "${getSourceLine(lines, decl.location[0])}". The value being assigned here is ${gotType}, which is incompatible with ${expectedType}.`;
      }
    }

    return `The target expects ${expectedType}, but the expression evaluates to ${gotType}. These types are not compatible.`;
  }

  // Cannot use operator: "Cannot use `op` with `X` and `Y`..."
  const binaryError = msg.match(/Cannot use `(.+?)` with `(.+?)` and `(.+?)`/);
  if (binaryError) {
    const [, op, leftType, rightType] = binaryError;
    const sourceLine = getSourceLine(lines, loc[0]);
    return `At line ${loc[0]}: "${sourceLine}" — the left side is ${leftType} and the right side is ${rightType}. The "${op}" operator cannot combine these types.`;
  }

  // Wrong argument count: "Wrong number of arguments: expected N but got M..."
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

  // Argument type mismatch: "Argument N has type `Y` but the parameter expects `X`..."
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

  // Not a variable: "`name` is not a variable..."
  const notVar = msg.match(/`(.+?)` is not a variable in this scope/);
  if (notVar) {
    const [, name] = notVar;
    return `"${name}" exists in this scope but is a function or class name. Only variables (declared with a type annotation) can be assigned to.`;
  }

  // Condition type: "Condition must be `bool`..."
  const condError = msg.match(/Condition must be `bool`, but this expression is `(.+?)`/);
  if (condError) {
    const [, actualType] = condError;
    const sourceLine = getSourceLine(lines, loc[0]);
    return `At line ${loc[0]}: "${sourceLine}" — the condition expression is ${actualType}. In Typed Python, conditions must be bool. Try comparing with a value, e.g. "x != 0" or "x is not None".`;
  }

  // Duplicate declaration
  const dupError = msg.match(/Duplicate declaration of `(.+?)` in the same scope/);
  if (dupError) {
    const [, name] = dupError;
    const decls = declarationMap.get(name);
    if (decls && decls.length > 0) {
      const firstDecl = decls[0];
      return `"${name}" was already declared at line ${firstDecl.location[0]}: "${getSourceLine(lines, firstDecl.location[0])}". Each name can only be declared once per scope.`;
    }
    return null;
  }

  // Not all paths return
  const returnError = msg.match(/Not all paths in `(.+?)` have a return statement/);
  if (returnError) {
    const [, funcName] = returnError;
    return `The function "${funcName}" has code paths that don't end with a return statement. If the function should return a value, add return statements to all branches (if/else).`;
  }

  // Invalid type annotation
  const invalidType = msg.match(/Invalid type annotation: there is no class named `(.+?)`/);
  if (invalidType) {
    const [, typeName] = invalidType;
    return `"${typeName}" is used as a type but no class with that name exists. Check for typos. Available built-in types are: int, bool, str, object.`;
  }

  // Cannot index
  const indexError = msg.match(/Cannot index into type `(.+?)`/);
  if (indexError) {
    const [, typeName] = indexError;
    return `Only str and list types support indexing with []. The expression has type ${typeName}, which cannot be indexed.`;
  }

  // Cannot iterate
  const iterError = msg.match(/Cannot iterate over type `(.+?)`/);
  if (iterError) {
    const [, typeName] = iterError;
    return `Only str and list types can be used in a for loop. The expression has type ${typeName}.`;
  }

  // Cannot apply unary operator
  const unaryError = msg.match(/Cannot apply `(.+?)` to type `(.+?)`/);
  if (unaryError) {
    const [, op, operandType] = unaryError;
    const sourceLine = getSourceLine(lines, loc[0]);
    if (op === '-') {
      return `At line ${loc[0]}: "${sourceLine}" — the negation operator "-" requires an int, but this expression is ${operandType}.`;
    }
    return `At line ${loc[0]}: "${sourceLine}" — the "${op}" operator cannot be applied to type ${operandType}.`;
  }

  // Cannot access member
  const memberError = msg.match(/Cannot access a member of type `(.+?)`/);
  if (memberError) {
    const [, typeName] = memberError;
    const sourceLine = getSourceLine(lines, loc[0]);
    return `At line ${loc[0]}: "${sourceLine}" — you're trying to access an attribute on a ${typeName} value. Only class instances have accessible attributes.`;
  }

  // No attribute on class
  const attrError = msg.match(/Class `(.+?)` has no attribute named `(.+?)`/);
  if (attrError) {
    const [, className, attrName] = attrError;
    return `The class "${className}" does not define an attribute "${attrName}". Check the class definition for available attributes, or add "${attrName}" as a class variable.`;
  }

  // No method on class
  const methodError = msg.match(/Class `(.+?)` has no method named `(.+?)`/);
  if (methodError) {
    const [, className, methodName] = methodError;
    return `The class "${className}" does not define a method "${methodName}". Check the class definition for available methods, or define "${methodName}" in the class body.`;
  }

  // Not a function or class
  const notFuncError = msg.match(/`(.+?)` is not a function or class/);
  if (notFuncError) {
    const [, name] = notFuncError;
    const decls = declarationMap.get(name);
    if (decls && decls.length > 0) {
      const decl = decls[decls.length - 1];
      return `"${name}" is a ${decl.kind} of type ${decl.declaredType} (declared at line ${decl.location[0]}). It cannot be called like a function.`;
    }
    return `"${name}" is not defined as a function or class in this scope.`;
  }

  // Cannot assign to non-local
  const nonlocalAssign = msg.match(/Cannot assign to `(.+?)` because it is not explicitly declared/);
  if (nonlocalAssign) {
    const [, name] = nonlocalAssign;
    return `"${name}" is defined in an outer scope. To assign to it here, add a "global ${name}" or "nonlocal ${name}" declaration at the top of this function.`;
  }

  // Super-class errors
  const superUndef = msg.match(/Super-class `(.+?)` is not defined/);
  if (superUndef) {
    const [, name] = superUndef;
    return `You're trying to extend "${name}", but no class with that name has been defined yet. Define "${name}" before this class definition.`;
  }

  // Method override error
  const overrideError = msg.match(/Method `(.+?)` is overridden with a different type signature/);
  if (overrideError) {
    const [, methodName] = overrideError;
    return `The method "${methodName}" in this class has a different signature than the parent's version. Overriding methods must match the parent's parameter types and return type exactly.`;
  }

  // String index assignment
  if (msg.includes('Strings are immutable')) {
    const sourceLine = getSourceLine(lines, loc[0]);
    return `At line ${loc[0]}: "${sourceLine}" — strings in Typed Python are immutable. You cannot modify individual characters. Consider building a new string instead.`;
  }

  // Top-level return
  if (msg.includes('cannot appear at the top level')) {
    return `"return" can only be used inside a function or method body. If you want to stop program execution, remove this return statement.`;
  }

  // Expected return type but got None
  const noneReturn = msg.match(/Expected return type `(.+?)` but the function returns `None`/);
  if (noneReturn) {
    const [, expectedType] = noneReturn;
    return `This function is declared to return ${expectedType}, but some code paths end without returning a value (implicitly returning None). Add an explicit return statement.`;
  }

  // Global/nonlocal declaration errors
  const notGlobal = msg.match(/`(.+?)` is not a global variable/);
  if (notGlobal) {
    const [, name] = notGlobal;
    return `You declared "global ${name}", but "${name}" is not defined at the top level of the program. Add a variable definition for "${name}" at the global scope.`;
  }

  const notNonlocal = msg.match(/`(.+?)` is not a nonlocal variable/);
  if (notNonlocal) {
    const [, name] = notNonlocal;
    return `You declared "nonlocal ${name}", but "${name}" is not defined in any enclosing function scope. The nonlocal keyword requires the variable to exist in a parent (non-global) scope.`;
  }

  // Shadow class name
  const shadowError = msg.match(/Cannot shadow class name `(.+?)`/);
  if (shadowError) {
    const [, name] = shadowError;
    return `"${name}" is already defined as a class. Variables and functions cannot reuse class names within the same scope.`;
  }

  return null;
}
