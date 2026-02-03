# Architecture

## Rust Compiler Layer

The compiler is written in Rust. In the browser, only the front-end stages run (via WASM):

- **Lexer** — Hand-written tokenizer with indentation tracking. Implemented as an async pipe model (stable Rust does not support generators).
- **Parser** — Recursive descent with 2-token lookahead to distinguish declarations from statements. Left recursion rewritten into loops; expression parsing uses precedence levels (`parse_exprN`) to manage operator hierarchy.
- **Type Checker** — Produces a fully typed AST with inferred types on every expression. Non-fatal errors are collected with source locations. AST nodes use idiomatic Rust `struct`s and `enum`s with pattern matching instead of a class hierarchy.

The compiler also includes an x86-64 code generator for native compilation, but this is feature-gated out of the WASM build.

### Design Overview

#### Parser

The compiler uses a hand-written lexer and parser.

- **Lexer**: Implemented as a generator-like component. Since stable Rust does not support generators, this is simulated using an asynchronous pipe model.
- **Parser**: A recursive descent parser where each `parse_xxx(...)` function maps to a grammar non-terminal. Left recursion is rewritten into loops. Expression parsing uses precedence levels (`parse_exprN(...)`) to manage operator hierarchy. The parser uses at most 2-token lookahead, primarily to differentiate declarations from statements.

#### Semantic Analysis

The compiler supports intermediate typed and untyped ASTs in JSON format, compliant with the CS 164 spec. Internally:

- AST nodes are implemented with idiomatic Rust `struct`s and `enum`s, instead of a class hierarchy.
- Pattern matching replaces virtual dispatch for semantic analysis.

#### Code Generation

Unlike the [ChocoPy Implementation Guide](https://chocopy.org/chocopy_implementation_guide.pdf), this compiler targets x86 instead of RISC-V and diverges in several implementation details.

##### Symbol Naming

- `$chocopy_main`: User program entry point
- `$global`: Global variable section
- Constructors: Use the class name (`MyClass`)
- Methods: `<ClassName>.<MethodName>`
- Prototypes: `<ClassName>.$proto`
- Nested functions: `<ParentSymbol>.<FuncName>`
- Standard library: All functions prefixed with `$` (except `main`)

User-defined functions are not prefixed. Variable and attribute names are kept as-is. Hidden/internal attributes are prefixed with `$`.

##### Register Usage

- `RSP` and `RBP` retain their conventional roles (stack and frame pointers).
- All other general-purpose registers are used freely.

##### Object Representation

Objects are 64-bit pointers. `0` denotes `None`.

**Unboxed Values:**
- `int` → 4 bytes, `bool` → 1 byte
- Stored in 8-byte stack slots. In global variables and object fields, alignment is based on their actual size (packed layout).

**Object Layout:**
- **Header (24 bytes)**: 8 bytes pointer to `$proto` + 16 bytes reserved for GC (`$gc_is_marked`, `$gc_next`)
- **Attributes** follow the header
- **Array-like types** (`str`, `[T]`) add an 8-byte `$len` field plus packed element layout

**Prototype Objects:**
Every type `C` (including primitives) has a global `C.$proto` symbol pointing to a shared prototype object containing:
- `$size`: Object size (positive) or per-element size for arrays (negative)
- `$tag`: Type tag (`0` → user-defined/built-in object, `-1` → `[int]`/`[bool]`, `-2` → other lists)
- `$map`: Reference bitmap for GC
- Method table (starting with `__init__`)

**Constructors:**
Each class `C` has a constructor symbol `C` that allocates memory, initializes fields manually (not from prototype), and invokes `__init__`.

##### Functions and Methods

**Calling Convention:**
- Arguments pushed in right-to-left order
- Nested functions receive static link in `R10`
- Stack aligned to 8 mod 16
- Return values in `RAX`
- Caller restores stack
- `$chocopy_main` and standard library functions use the system ABI (System V or Windows)

**Stack Frame Layout (Top to Bottom):**
1. Outgoing arguments (for nested calls)
2. Alignment padding (if needed)
3. Temporaries
4. Local variables
5. Static link (`R10`)
6. Saved `RBP` (caller's frame pointer)
7. Return address

##### Execution Environment

The final binary is composed of:
- `program.o`: Compiled user program
- `chocopy_rs_std`: Standard runtime library
- `libc`: System C library

## Overview

Typed Python Compiler UI runs a Rust Typed Python compiler in the browser via WebAssembly. Programs are compiled (parsed + type-checked) by the WASM module, then executed by a TypeScript tree-walking interpreter.

```
┌─────────────┐    source     ┌─────────────────┐    typed AST   ┌───────────────┐
│  CodeMirror  │ ──────────── │   WASM Module    │ ────────────── │  AST Tree UI  │
│   Editor     │              │  (Rust→WASM)     │                │  Visualization │
└─────────────┘              │  compile()       │                └───────────────┘
                              │  (parse +        │
                              │   typecheck)     │    typed AST   ┌───────────────┐
                              └─────────────────┘ ────────────── │  Interpreter   │
                                                                  │  (TypeScript)  │
                                                                  └───────────────┘
```

## WASM Compilation Pipeline

### Compiler Modifications

The Rust compiler source is bundled in the `wasm/` directory. It was modified minimally for WASM compatibility:

1. **Cargo.toml**: Added `[lib]` section and feature-gated native-only dependencies (`getopts`, `cc`, `object`, `gimli`, `rand`) behind a `native` feature flag.

2. **`src/lib.rs`** (new): Exports `pub mod common; pub mod core;` for library consumers.

3. **`src/core/frontend/mod.rs`**: Added `process_str(source: &str) -> Program` that operates on a string instead of a file path.

4. **`src/core/mod.rs`**: Codegen module gated behind `#[cfg(feature = "native")]`.

### WASM Wrapper Crate

Located at `wasm/`, this is a thin wrapper using `wasm-bindgen`:

- Uses the Typed Python crate with `default-features = false` (no native deps)
- Exports three functions: `parse()`, `typecheck()`, `compile()`
- Each returns JSON strings of the AST
- `compile()` returns both the untyped and typed AST plus error list
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

The `inferredType` field is present on typed AST nodes (after type checking) and is displayed as a type badge in the AST visualization. It is omitted from the JSON when absent via `#[serde(skip_serializing_if = "Option::is_none")]`.

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

### Snapshot Infrastructure

The interpreter supports snapshot-based execution for time travel:

- `interpretWithSnapshots()` runs the program synchronously, capturing a `Snapshot` at the top of each statement execution
- Each snapshot records: step number, source location, deep-cloned variable state, console output, and call stack
- Maximum 5,000 snapshots per execution (programs exceeding this show a warning)
- Programs using `input()` are incompatible with snapshot mode (requires interactive I/O)

## Declaration Map / Type Provenance

The `buildDeclarationMap()` utility walks the typed AST and records every variable, parameter, and attribute declaration:

- For each declaration: name, declared type, source location, scope path, and kind (variable/parameter/attribute)
- When hovering a type badge on an Identifier node, the system looks up the declaration and shows where the type originated
- For non-identifier expressions (e.g., binary operations), a type rule explanation is generated describing how the type was inferred

## UI Architecture

### Design System: "Clarity"

CSS custom properties define the entire visual language:

- **Colors**: Near-black backgrounds, indigo accent, color-coded AST nodes
- **Typography**: System UI fonts for interface, monospace for code
- **Animation**: Apple-style deceleration easing (`cubic-bezier(0.16, 1, 0.3, 1)`), GPU-accelerated transforms
- **Frosted glass**: `backdrop-filter: blur(20px) saturate(180%)` on header/overlays

### Animation Principles

- GPU-only properties: only animate `transform` and `opacity`
- Duration hierarchy: 150ms (micro), 200ms (standard), 300ms (emphasis), 400ms (major)
- `prefers-reduced-motion` respected via media queries
- `font-variant-numeric: tabular-nums` on changing numbers to prevent width jumps
- Crossfade between views rather than instant swaps

### Component Hierarchy

```
+layout.svelte
└── +page.svelte (main playground)
    ├── Toolbar (header bar, examples, compile/run buttons)
    ├── Editor (CodeMirror 6 wrapper)
    ├── Divider (resizable split handle)
    ├── OutputPanel (tab container)
    │   ├── ASTTree → ASTNode (recursive tree)
    │   ├── TimelinePanel (time travel scrubber + variable panel)
    │   │   └── VariablePanel (variable state table)
    │   ├── DocsPanel (documentation)
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
