use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn parse(source: &str) -> String {
    let ast = chocopy::core::frontend::process_str(source);
    serde_json::to_string(&ast).unwrap_or_else(|e| {
        format!(r#"{{"error":"Serialization failed: {}"}}"#, e)
    })
}

#[wasm_bindgen]
pub fn typecheck(source: &str) -> String {
    let ast = chocopy::core::frontend::process_str(source);
    let typed = chocopy::core::typecheck::check(ast);
    serde_json::to_string(&typed).unwrap_or_else(|e| {
        format!(r#"{{"error":"Serialization failed: {}"}}"#, e)
    })
}

#[wasm_bindgen]
pub fn compile(source: &str) -> String {
    let untyped_ast = chocopy::core::frontend::process_str(source);
    let untyped_json = serde_json::to_string(&untyped_ast).unwrap_or_default();

    let typed_ast = chocopy::core::typecheck::check(untyped_ast);
    let has_errors = !typed_ast.errors.errors.is_empty();
    let errors_json = serde_json::to_string(&typed_ast.errors.errors).unwrap_or_default();
    let typed_json = serde_json::to_string(&typed_ast).unwrap_or_default();

    format!(
        r#"{{"untypedAst":{},"typedAst":{},"errors":{},"hasErrors":{}}}"#,
        untyped_json, typed_json, errors_json, has_errors
    )
}

#[wasm_bindgen]
pub fn generate_assembly(source: &str) -> String {
    let ast = chocopy::core::frontend::process_str(source);
    let typed = chocopy::core::typecheck::check(ast);
    if !typed.errors.errors.is_empty() {
        return r#"{"error":"Program has errors"}"#.to_string();
    }
    let code_set = chocopy::core::codegen::gen_code_set(typed, chocopy::core::codegen::Platform::Linux);
    let source_lines: Vec<&str> = source.lines().collect();
    let output = chocopy::core::codegen::asm_text::disassemble(&code_set, &source_lines);
    serde_json::to_string(&output).unwrap_or_default()
}
