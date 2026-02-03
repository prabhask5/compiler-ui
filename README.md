# Compiler UI

A browser-based playground for a Rust Typed Python compiler. Write, compile, and run Typed Python programs entirely in the browser using WebAssembly.

This is the frontend for the [Typed Python Compiler](https://github.com/prabhask5/typed-python-compiler). The Rust compiler is compiled to WebAssembly and loaded at runtime to handle parsing and type checking. Program execution is handled by a TypeScript tree-walking interpreter that runs the typed AST directly in the browser.

## Features

- **Code Editor** — CodeMirror 6 with Python syntax highlighting and error underlines
- **Compilation** — Full Typed Python parsing and type checking via WASM
- **AST Visualization** — Interactive, color-coded tree view for both untyped and typed ASTs
- **Interpreter** — TypeScript tree-walking interpreter for running programs in the browser
- **Examples** — 12 curated Typed Python programs demonstrating language features
- **URL Sharing** — Share programs via compressed URL hash
- **Responsive** — Desktop split-panel layout, mobile stacked layout with tab switching

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
| `Cmd/Ctrl + 1/2/3/4` | Switch output tabs |

## Project Structure

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed system design.
