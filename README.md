# Typed Python Compiler UI

Try it here: **[compiler.prabhas.io](https://compiler.prabhas.io)**

> ChocoPy is a programming language designed for classroom use in undergraduate compilers courses. ChocoPy is a restricted subset of Python 3, which can easily be compiled to a target such as RISC-V. The language is fully specified using formal grammar, typing rules, and operational semantics. ChocoPy is used to teach CS 164 at UC Berkeley. ChocoPy has been designed by Rohan Padhye and Koushik Sen, with substantial contributions from Paul Hilfinger.

A browser-based compiler playground for Typed Python (ChocoPy). The full Rust compiler runs as WebAssembly — write, compile, and run Typed Python programs entirely in the browser with no server required.

## Features

- **Full Parsing + Type Checking via WebAssembly** — The Rust compiler runs client-side as a ~155KB WASM binary
- **Human-Readable Error Messages** — Compiler errors explain what went wrong and suggest how to fix it, with source locations
- **Interactive Typed AST Visualization** — Color-coded tree view with collapsible nodes and inferred type badges on every expression
- **Type Provenance on Hover** — Hover any type badge to see where and why the type was inferred, with links to the declaration
- **Execution Time Travel** — Step through program execution with a timeline scrubber; watch variables change in real-time and see the AST morph from untyped to typed
- **Variable Lifetime Visualization** — See variable scopes and usage patterns across the program
- **TypeScript Tree-Walking Interpreter** — Run programs in-browser with runtime error detection and source location tracking
- **URL Sharing** — Share programs via LZ-string compressed URL hash; recipients see code, compilation result, and program output automatically
- **Responsive Split-Panel Layout** — Desktop side-by-side panels with draggable divider; mobile stacked layout with tab switching
- **12 Curated Examples** — Demonstrating classes, inheritance, closures, lists, and more

## Compiler Architecture

The compiler is written in Rust. In the browser, only the front-end stages run (via WASM):

- **Lexer** — Hand-written tokenizer with indentation tracking. Implemented as an async pipe model (stable Rust does not support generators).
- **Parser** — Recursive descent with 2-token lookahead to distinguish declarations from statements. Left recursion rewritten into loops; expression parsing uses precedence levels (`parse_exprN`) to manage operator hierarchy.
- **Type Checker** — Produces a fully typed AST with inferred types on every expression. Non-fatal errors are collected with source locations. AST nodes use idiomatic Rust `struct`s and `enum`s with pattern matching instead of a class hierarchy.

The compiler also includes an x86-64 code generator for native compilation, but this is feature-gated out of the WASM build.

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

## Browser Playground

The browser playground compiles the Rust compiler to WebAssembly so the full parsing and type-checking pipeline runs client-side.

- **WASM compilation**: The Rust compiler crate is built with `wasm-pack` using `default-features = false` to gate out native-only dependencies (`getopts`, `cc`, `object`, `gimli`, `rand`). Output is a ~155KB WASM binary.
- **Loading strategy**: The WASM module is loaded at runtime by fetching the JS glue code as text, creating a Blob URL, and dynamic-importing it as an ES module. This avoids Vite/Rollup trying to resolve WASM imports at build time.
- **Interpreter**: Program execution uses a TypeScript tree-walking interpreter that traverses the typed AST JSON directly. Includes scope model with global/nonlocal redirects, class system with inheritance, and 1,000,000 operation safety limit.
- **SvelteKit architecture**: Built with SvelteKit 2 and Svelte 5 runes (`$state`, `$derived`, `$effect`). All state lives in `+page.svelte`. Static site output via `@sveltejs/adapter-static`.
- **CodeMirror editor**: CodeMirror 6 with Python syntax highlighting, inline error decorations, and keyboard shortcuts.
- **AST visualization**: Interactive, color-coded tree view of the typed AST with collapsible nodes, inferred type badges, and type provenance tooltips.
- **Time travel**: Timeline tab with execution scrubber, variable state tracking, and AST morph animations between untyped and typed phases.
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
| `Cmd/Ctrl + 1/2/3/4` | Switch output tabs (AST / Run / Timeline / Docs) |

## Project Structure

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed system design.

## Acknowledgments

- **ChocoPy**: Rohan Padhye, Koushik Sen, Paul Hilfinger — UC Berkeley CS 164
- Test suite under BSD 2-Clause License (Regents of University of California, 2017-2018)
