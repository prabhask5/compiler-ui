# Architecture

## Overview

Compiler UI runs a Rust Typed Python compiler in the browser via WebAssembly. Programs are compiled (parsed + type-checked) by the WASM module, then executed by a TypeScript tree-walking interpreter.

```
┌─────────────┐    source     ┌─────────────────┐    JSON AST    ┌───────────────┐
│  CodeMirror  │ ──────────── │   WASM Module    │ ────────────── │  AST Tree UI  │
│   Editor     │              │  (Rust→WASM)     │                │  Visualization │
└─────────────┘              │  parse()         │                └───────────────┘
                              │  typecheck()     │
                              │  compile()       │    typed AST   ┌───────────────┐
                              └─────────────────┘ ────────────── │  Interpreter   │
                                                                  │  (TypeScript)  │
                                                                  └───────────────┘
```

## WASM Compilation Pipeline

### Compiler Modifications

The Rust compiler (`typed-python-compiler/chocopy/`) was modified minimally:

1. **Cargo.toml**: Added `[lib]` section and feature-gated native-only dependencies (`getopts`, `cc`, `object`, `gimli`, `rand`) behind a `native` feature flag.

2. **`src/lib.rs`** (new): Exports `pub mod common; pub mod core;` for library consumers.

3. **`src/core/frontend/mod.rs`**: Added `process_str(source: &str) -> Program` that operates on a string instead of a file path.

4. **`src/core/mod.rs`**: Codegen module gated behind `#[cfg(feature = "native")]`.

### WASM Wrapper Crate

Located at `compiler-ui/wasm/`, this is a thin wrapper using `wasm-bindgen`:

- Uses the Typed Python crate with `default-features = false` (no native deps)
- Exports three functions: `parse()`, `typecheck()`, `compile()`
- Each returns JSON strings of the AST
- `compile()` returns both untyped and typed ASTs plus error list
- Built with `wasm-pack build --target web --release`
- Output: ~155KB WASM binary

### Loading Strategy

The WASM module is loaded at runtime via a custom loader (`wasm-loader.ts`):

1. Fetch the JS glue code (`/wasm/chocopy_wasm.js`) as text
2. Create a Blob URL and dynamic-import it as an ES module
3. Call `mod.default('/wasm/chocopy_wasm_bg.wasm')` to initialize
4. Cache the module for subsequent calls

This avoids Vite/Rollup trying to resolve the WASM imports at build time.

## AST Type Mapping

The Rust AST types use serde for JSON serialization. Key mappings:

| Rust | JSON | TypeScript |
|------|------|-----------|
| `Program` | `{ kind: "Program", declarations, statements, errors }` | `Program` |
| `Expr` with `ExprContent` | `{ kind: "BinaryExpr", inferredType?, ... }` | `ExprNode` |
| `Location` | `[startRow, startCol, endRow, endCol]` | `LocationArray` |
| `ValueType::ClassValueType` | `{ kind: "ClassValueType", className }` | `ClassValueType` |

The `inferredType` field is present only on typed AST nodes (after type checking). The untyped AST omits it via `#[serde(skip_serializing_if = "Option::is_none")]`.

## Interpreter Design

The TypeScript interpreter (`src/lib/interpreter/`) executes typed AST JSON directly.

### Scope Model

- **Environment**: Frame stack with global frame at the bottom
- **Global redirects**: `global x` declarations redirect reads/writes to the global frame
- **Nonlocal redirects**: `nonlocal x` declarations redirect to the nearest enclosing scope that defines `x`
- **Closure capture**: Variables are looked up by walking the frame chain

### Class System

- **Registry**: Classes are registered from `ClassDef` declarations before execution
- **Inheritance**: Attributes and methods are copied from parent class, then overridden
- **Method resolution**: Walks up the class hierarchy to find methods
- **Instantiation**: Creates object with default attribute values, then calls `__init__`

### Built-in Functions

| Function | Behavior |
|----------|----------|
| `print(x)` | Calls `io.onOutput(displayValue(x))` |
| `input()` | Returns a Promise that resolves when user submits input |
| `len(x)` | Returns string or list length |

### Safety

- Step counter: max 1,000,000 operations before throwing
- All runtime errors include source location for UI highlighting
- Division by zero, index out of bounds, None attribute access are caught

## UI Architecture

### Design System: "Clarity"

CSS custom properties define the entire visual language:

- **Colors**: Near-black backgrounds, indigo accent, color-coded AST nodes
- **Typography**: System UI fonts for interface, monospace for code
- **Animation**: Apple-style deceleration easing, GPU-accelerated transforms
- **Frosted glass**: `backdrop-filter: blur(20px) saturate(180%)` on header/overlays

### Component Hierarchy

```
+layout.svelte
└── +page.svelte (main playground)
    ├── Toolbar (header bar, examples, compile/run buttons)
    ├── Editor (CodeMirror 6 wrapper)
    ├── Divider (resizable split handle)
    ├── OutputPanel (tab container)
    │   ├── ASTTree → ASTNode (recursive tree)
    │   ├── AssemblyView (placeholder)
    │   └── Console (execution output)
    └── ErrorPanel (error list)
```

### Responsive Strategy

- **Desktop (≥768px)**: Side-by-side split panels with draggable divider
- **Mobile (<768px)**: Full-width stacked with bottom tab bar to switch editor/output

### State Management

All state lives in `+page.svelte` using Svelte 5 runes (`$state`, `$derived`, `$effect`). No external state library needed for this single-page app.

## Build Pipeline

```
compiler-ui/
├── wasm/pkg/          → Built WASM artifacts
├── static/wasm/       → Copied WASM files (served at /wasm/)
├── src/               → SvelteKit source
├── build/             → Production output (adapter-static)
└── .svelte-kit/       → Generated types and SSR output
```

Build command: `npm run build` → Vite builds → adapter-static writes to `build/`.
