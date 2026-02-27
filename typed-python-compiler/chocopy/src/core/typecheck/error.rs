use crate::common::node::*;

pub fn error_dup(name: &str) -> String {
    format!(
        "Duplicate declaration of `{}` in the same scope. Each name can only be declared once per scope — rename one of the declarations.",
        name
    )
}

pub fn error_super_undef(name: &str) -> String {
    format!(
        "Super-class `{}` is not defined. Declare or import the class before extending it.",
        name
    )
}

pub fn error_super_not_class(name: &str) -> String {
    format!(
        "`{}` is not a class, so it cannot be used as a super-class. Only class names are allowed after the colon in a class definition.",
        name
    )
}

pub fn error_super_special(name: &str) -> String {
    format!(
        "Cannot extend the special built-in class `{}`. Only user-defined classes can be subclassed.",
        name
    )
}

pub fn error_method_self(name: &str) -> String {
    format!(
        "The first parameter of method `{}` must have the enclosing class type. Methods receive the instance as their first argument (like `self`).",
        name
    )
}

pub fn error_method_override(name: &str) -> String {
    format!(
        "Method `{}` is overridden with a different type signature. Overriding methods must have the same parameter and return types as the parent method.",
        name
    )
}

pub fn error_attribute_redefine(name: &str) -> String {
    format!(
        "Cannot re-define attribute `{}`. Attributes inherited from a parent class cannot be redeclared in the subclass.",
        name
    )
}

pub fn error_invalid_type(name: &str) -> String {
    format!(
        "Invalid type annotation: there is no class named `{}`. Check for typos or define the class before using it as a type.",
        name
    )
}

pub fn error_shadow(name: &str) -> String {
    format!(
        "Cannot shadow class name `{}`. A variable or function cannot reuse the name of an existing class in this scope.",
        name
    )
}

pub fn error_nonlocal(name: &str) -> String {
    format!(
        "`{}` is not a nonlocal variable. The `nonlocal` declaration requires that `{}` is defined in an enclosing (non-global) scope.",
        name, name
    )
}

pub fn error_global(name: &str) -> String {
    format!(
        "`{}` is not a global variable. The `global` declaration requires that `{}` is defined at the top level of the program.",
        name, name
    )
}

pub fn error_return(name: &str) -> String {
    format!(
        "Not all paths in `{}` have a return statement. Every possible execution path in a non-void function must return a value.",
        name
    )
}

pub fn error_variable(name: &str) -> String {
    format!(
        "`{}` is not a variable in this scope. It may be a function or class name, which cannot be used as an assignable value.",
        name
    )
}

pub fn error_assign(left: &ValueType, right: &ValueType) -> String {
    format!(
        "Type mismatch: expected `{}` but got `{}`. The target was declared as `{}`, so only `{}`-compatible values can be assigned here.",
        left, right, left, left
    )
}

pub fn error_nonlocal_assign(name: &str) -> String {
    format!(
        "Cannot assign to `{}` because it is not explicitly declared in this scope. Add a `global` or `nonlocal` declaration, or define it as a local variable.",
        name
    )
}

pub fn error_unary(operator: &str, operand: &ValueType) -> String {
    format!(
        "Cannot apply `{}` to type `{}`. The `{}` operator requires an operand of a compatible type.",
        operator, operand, operator
    )
}

pub fn error_binary(operator: &str, left: &ValueType, right: &ValueType) -> String {
    format!(
        "Cannot use `{}` with `{}` and `{}`. The `{}` operator requires both operands to be the same compatible type.",
        operator, left, right, operator
    )
}

pub fn error_condition(condition: &ValueType) -> String {
    format!(
        "Condition must be `bool`, but this expression is `{}`. Use a comparison like `x != 0` to produce a `bool`.",
        condition
    )
}

pub fn error_member(t: &ValueType) -> String {
    format!(
        "Cannot access a member of type `{}` because it is not a class instance. Only objects with class types have accessible attributes.",
        t
    )
}

pub fn error_call_count(expected: usize, got: usize) -> String {
    format!(
        "Wrong number of arguments: expected {} but got {}. Check the function definition for the correct parameter count.",
        expected, got
    )
}

pub fn error_call_type(location: usize, expected: &ValueType, got: &ValueType) -> String {
    format!(
        "Argument {} has type `{}` but the parameter expects `{}`. Pass a value of type `{}` instead.",
        location, got, expected, expected
    )
}

pub fn error_index_left(left: &ValueType) -> String {
    format!(
        "Cannot index into type `{}`. Only `str` and list types support indexing with `[]`.",
        left
    )
}

pub fn error_index_right(index: &ValueType) -> String {
    format!(
        "Index must be `int`, but got `{}`. List and string indices must be integers.",
        index
    )
}

pub fn error_attribute(name: &str, class_name: &str) -> String {
    format!(
        "Class `{}` has no attribute named `{}`. Check the class definition for available attributes.",
        class_name, name
    )
}

pub fn error_function(name: &str) -> String {
    format!(
        "`{}` is not a function or class. It cannot be called — check for typos or ensure it was defined as a function.",
        name
    )
}

pub fn error_method(method_name: &str, class_name: &str) -> String {
    format!(
        "Class `{}` has no method named `{}`. Check the class definition for available methods.",
        class_name, method_name
    )
}

pub fn error_none_return(return_expected: &ValueType) -> String {
    format!(
        "Expected return type `{}` but the function returns `None`. Add an explicit return statement with a value of type `{}`.",
        return_expected, return_expected
    )
}

pub fn error_iterable(iterable: &ValueType) -> String {
    format!(
        "Cannot iterate over type `{}`. Only `str` and list types can be used in a `for` loop.",
        iterable
    )
}

pub fn error_multi_assign() -> String {
    "Multiple assignment targets cannot be used when the right-hand side may be `None`. Assign to each target individually instead.".to_owned()
}

pub fn error_top_return() -> String {
    "A `return` statement cannot appear at the top level. `return` can only be used inside a function or method body.".to_owned()
}

pub fn error_str_index_assign() -> String {
    "Cannot assign to a `str` index. Strings are immutable — only lists support index assignment.".to_owned()
}
