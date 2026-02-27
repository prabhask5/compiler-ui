# Typed Python Compiler UI

Try it here: **[compiler.prabhas.io](https://compiler.prabhas.io)**

A browser-based playground for Typed Python ([ChocoPy](https://chocopy.org/)). The full Rust compiler runs as WebAssembly — write, compile, and run Typed Python programs entirely in the browser with no server required.

For compiler internals (lexer, parser, type checker, code generator), see [typed-python-compiler](https://github.com/prabhask5/typed-python-compiler).

## Features

- **Full Parsing + Type Checking via WebAssembly** — The Rust compiler runs client-side as a ~155KB WASM binary
- **Interactive Typed AST Visualization** — Color-coded tree view with collapsible nodes and inferred type badges on every expression
- **Human-Readable Error Commentary** — Compiler errors include explanations that describe what went wrong and suggest fixes
- **TypeScript Tree-Walking Interpreter** — Run programs in-browser with runtime error detection and source location tracking
- **URL Sharing** — Share programs via LZ-string compressed URL hash; recipients see code, compilation result, and output automatically
- **Responsive Split-Panel Layout** — Desktop side-by-side panels with draggable divider; mobile stacked layout with tab switching
- **12 Curated Examples** — Demonstrating classes, inheritance, closures, lists, and more

## How It Works

The Rust compiler is compiled to WebAssembly via `wasm-pack`. It handles parsing and type checking entirely in the browser, producing a fully typed AST as JSON. A TypeScript tree-walking interpreter then executes the typed AST directly — no server required.

```
Source Code → WASM Module (parse + typecheck) → Typed AST JSON → TypeScript Interpreter → Console Output
                                                       ↓
                                                  AST Tree UI
```

## Tech Stack

- **Frontend**: SvelteKit 2, Svelte 5, TypeScript
- **Compiler**: Rust → WebAssembly via `wasm-bindgen` + `wasm-pack`
- **Editor**: CodeMirror 6 with Python syntax highlighting
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
| `Cmd/Ctrl + 1/2/3` | Switch output tabs (AST / Run / Docs) |

## Project Structure

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed system design.

## Acknowledgments

- **ChocoPy**: Rohan Padhye, Koushik Sen, Paul Hilfinger — UC Berkeley CS 164
- Test suite under BSD 2-Clause License (Regents of University of California, 2017-2018)
