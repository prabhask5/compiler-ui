# Typed Python Compiler UI

Try it here: **[compiler.prabhas.io](https://compiler.prabhas.io)**

> ChocoPy is a programming language designed for classroom use in undergraduate compilers courses. ChocoPy is a restricted subset of Python 3, which can easily be compiled to a target such as RISC-V. The language is fully specified using formal grammar, typing rules, and operational semantics. ChocoPy is used to teach CS 164 at UC Berkeley. ChocoPy has been designed by Rohan Padhye and Koushik Sen, with substantial contributions from Paul Hilfinger.

A Rust compiler for Typed Python (ChocoPy) — featuring a hand-written lexer/parser, type checker, x86-64 code generator with mark-and-sweep garbage collection — with a browser-based playground compiled to WebAssembly. Write, compile, and run Typed Python programs entirely in the browser with no server required.

## Features

- **Code Editor** — CodeMirror 6 with Python syntax highlighting and error underlines
- **Compilation** — Full Typed Python parsing and type checking via WASM
- **AST Visualization** — Interactive, color-coded tree view of the typed AST with inferred type badges
- **Interpreter** — TypeScript tree-walking interpreter for running programs in the browser
- **Examples** — 12 curated Typed Python programs demonstrating language features
- **URL Sharing** — Share programs via compressed URL hash (recipients see code, compilation result, and program output automatically)
- **Responsive** — Desktop split-panel layout, mobile stacked layout with tab switching

## Compiler

The compiler is written in Rust and handles the full pipeline from source code to native x86-64 executables:

- **Lexer** — Hand-written tokenizer with indentation tracking
- **Parser** — Recursive descent with 2-token lookahead to distinguish declarations from statements
- **Type Checker** — Produces a fully typed AST with inferred types on every expression; non-fatal errors collected with source locations
- **Code Generator** — Emits x86-64 assembly with cross-platform object file output (Windows, Linux, Mac)
- **Garbage Collector** — Mark-and-sweep GC triggered on allocation threshold
- **Standard Library** — `chocopy_rs_std` provides built-in functions (`print`, `len`, `input`), memory allocation, GC, and error handling

## Design Overview

### Parser

The compiler uses a hand-written lexer and parser.

- **Lexer**: Implemented as a generator-like component. Since stable Rust does not support generators, this is simulated using an asynchronous pipe model.
- **Parser**: A recursive descent parser where each `parse_xxx(...)` function maps to a grammar non-terminal. Left recursion is rewritten into loops. Expression parsing uses precedence levels (`parse_exprN(...)`) to manage operator hierarchy. The parser uses at most 2-token lookahead, primarily to differentiate declarations from statements.

### Semantic Analysis

The compiler supports intermediate typed and untyped ASTs in JSON format, compliant with the CS 164 spec. Internally:

- AST nodes are implemented with idiomatic Rust `struct`s and `enum`s, instead of a class hierarchy.
- Pattern matching replaces virtual dispatch for semantic analysis.

### Code Generation

Unlike the [ChocoPy Implementation Guide](https://chocopy.org/chocopy_implementation_guide.pdf), this compiler targets x86 instead of RISC-V and diverges in several implementation details.

#### Symbol Naming

- `$chocopy_main`: User program entry point
- `$global`: Global variable section
- Constructors: Use the class name (`MyClass`)
- Methods: `<ClassName>.<MethodName>`
- Prototypes: `<ClassName>.$proto`
- Nested functions: `<ParentSymbol>.<FuncName>`
- Standard library: All functions prefixed with `$` (except `main`)

User-defined functions are not prefixed. Variable and attribute names are kept as-is. Hidden/internal attributes are prefixed with `$`.

#### Register Usage

- `RSP` and `RBP` retain their conventional roles (stack and frame pointers).
- All other general-purpose registers are used freely.

#### Object Representation

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

#### Functions and Methods

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

#### Execution Environment

The final binary is composed of:
- `program.o`: Compiled user program
- `chocopy_rs_std`: Standard runtime library
- `libc`: System C library

#### Standard Library

`chocopy_rs_std` provides:
- Built-in function implementations (`$print`, `$len`, etc.)
- Memory allocation (`$alloc`) and garbage collection
- Error handling
- Entry point `main` → calls `$chocopy_main`

### Garbage Collection

Implements mark-and-sweep GC triggered by `$alloc` when a memory threshold is reached.

**Allocation and Marking:**
- Objects dynamically allocated on the heap are linked together via `$gc_next`
- `$gc_is_marked` is set to `1` for reachable objects during mark phase
- Unmarked objects are deallocated in the sweep phase
- Live objects reset `$gc_is_marked` to `0`

**Root Discovery:**
GC walks through:
- **Global references**: Map passed at `$init`
- **Local references**: Maps attached after function calls (via `PREFETCHNTA`)
- **Object members**: Maps in the class prototype (`$reference_bitmap`)

Reference maps are bitstrings indicating which fields are pointers. For locals, each map describes one stack frame. The GC walks the full stack to gather all active maps.

## Browser Playground

The browser playground compiles the Rust compiler to WebAssembly so the full parsing and type-checking pipeline runs client-side.

- **WASM compilation**: The Rust compiler crate is built with `wasm-pack` using `default-features = false` to gate out native-only dependencies (`getopts`, `cc`, `object`, `gimli`, `rand`). Output is a ~155KB WASM binary.
- **Loading strategy**: The WASM module is loaded at runtime by fetching the JS glue code as text, creating a Blob URL, and dynamic-importing it as an ES module. This avoids Vite/Rollup trying to resolve WASM imports at build time.
- **Interpreter**: Program execution uses a TypeScript tree-walking interpreter that traverses the typed AST JSON directly. Includes scope model with global/nonlocal redirects, class system with inheritance, and 1,000,000 operation safety limit.
- **SvelteKit architecture**: Built with SvelteKit 2 and Svelte 5 runes (`$state`, `$derived`, `$effect`). All state lives in `+page.svelte`. Static site output via `@sveltejs/adapter-static`.
- **CodeMirror editor**: CodeMirror 6 with Python syntax highlighting, inline error decorations, and keyboard shortcuts.
- **AST visualization**: Interactive, color-coded tree view of the typed AST with collapsible nodes and inferred type badges.
- **URL sharing**: Programs are compressed with LZ-string and encoded into the URL hash. Shared links restore code, compilation result, and program output.
- **Version detection**: The app detects WASM module updates and shows an auto-reload notification when a new version is available.

## Tech Stack

- **Frontend**: SvelteKit 2, Svelte 5, TypeScript
- **Compiler**: Rust → WebAssembly via `wasm-bindgen` + `wasm-pack`
- **Editor**: CodeMirror 6
- **Styling**: Custom "Clarity" design system (CSS custom properties)
- **Deployment**: Static site via `@sveltejs/adapter-static`

## Local Development

### Prerequisites

- Node.js 22+
- Rust + `wasm-pack` (only needed if rebuilding the WASM module)

### Setup

```sh
cd compiler-ui
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

### Rebuilding WASM

If you modify the Rust compiler:

```sh
cd wasm
wasm-pack build --target web --release
cp pkg/chocopy_wasm.js pkg/chocopy_wasm_bg.wasm ../static/wasm/
```

### Building for Production

```sh
npm run build
```

Output goes to `build/`. Serve statically or deploy to Vercel.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Enter` | Compile |
| `Cmd/Ctrl + Shift + Enter` | Compile + Run |
| `Cmd/Ctrl + 1/2/3` | Switch output tabs |

## Project Structure

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed system design.

## Acknowledgments

- **ChocoPy**: Rohan Padhye, Koushik Sen, Paul Hilfinger — UC Berkeley CS 164
- Test suite under BSD 2-Clause License (Regents of University of California, 2017-2018)
