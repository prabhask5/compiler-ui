<div class="docs-panel">
  <div class="docs-content">
    <section class="docs-section">
      <h2>Language Overview</h2>
      <p>
        <strong>Typed Python</strong> (also known as
        <a href="https://chocopy.org/" target="_blank" rel="noopener">ChocoPy</a>) is a restricted
        subset of Python 3 designed for compilers courses. It features:
      </p>
      <ul>
        <li>Static type annotations on all variables, parameters, and return types</li>
        <li>Classes with single inheritance and method overriding</li>
        <li>First-class lists with type-checked element types</li>
        <li>Nested functions with lexical closures</li>
        <li>
          <code>for</code>/<code>while</code> loops, <code>if</code>/<code>elif</code>/<code
            >else</code
          > branching
        </li>
        <li>Built-in functions: <code>print</code>, <code>input</code>, <code>len</code></li>
        <li>Integer, boolean, string, and <code>None</code> types</li>
      </ul>
    </section>

    <section class="docs-section">
      <h2>Compiler Architecture</h2>
      <p>
        The underlying compiler is written in <strong>Rust</strong> and runs in the browser via WebAssembly:
      </p>
      <ul>
        <li>
          <strong>Lexer</strong> — Hand-written tokenizer with indentation tracking, implemented as an
          async pipe model (stable Rust has no generators)
        </li>
        <li>
          <strong>Parser</strong> — Recursive descent with 2-token lookahead. Left recursion
          rewritten into loops; expression parsing uses precedence levels (<code>parse_exprN</code>)
          to manage operator hierarchy
        </li>
        <li>
          <strong>Type Checker</strong> — Produces a fully typed AST with inferred types on every
          expression. Non-fatal errors are collected and reported with source locations. AST nodes
          use idiomatic Rust <code>struct</code>s and <code>enum</code>s with pattern matching
        </li>
        <li>
          <strong>Code Generator</strong> — Emits x86-64 machine code targeting the Linux ABI. The
          assembly view disassembles the generated code using <code>iced-x86</code> with source line mappings
          for bidirectional navigation
        </li>
      </ul>
    </section>

    <section class="docs-section">
      <h2>Browser Playground</h2>
      <p>This UI runs the compiler entirely in the browser:</p>
      <ul>
        <li>
          The Rust compiler is compiled to <strong>WebAssembly</strong> via <code>wasm-pack</code> with
          native-only dependencies feature-gated out — includes x86-64 code generation and disassembly
        </li>
        <li>
          WASM is loaded at runtime via a Blob URL strategy to avoid Vite/Rollup import resolution
          issues
        </li>
        <li>Parsing and type checking happen in WASM — producing a fully typed AST as JSON</li>
        <li>
          Program execution uses a <strong>TypeScript tree-walking interpreter</strong> that traverses
          the typed AST directly
        </li>
        <li>No server required — everything runs client-side</li>
      </ul>
    </section>

    <section class="docs-section">
      <h2>Features</h2>
      <ul>
        <li>
          <strong>Interactive AST</strong> — Color-coded tree view of the typed AST with collapsible nodes
          and inferred type badges on every expression
        </li>
        <li>
          <strong>Error commentary</strong> — Compiler errors include human-readable explanations that
          describe what went wrong and suggest fixes
        </li>
        <li>
          <strong>Assembly view</strong> — x86-64 assembly output with syntax coloring, source line annotations,
          and bidirectional highlighting between source, AST, and assembly
        </li>
        <li>
          <strong>URL sharing</strong> — Programs are compressed with LZ-string and encoded into the URL
          hash. Shared links restore code, compilation result, and output
        </li>
        <li>
          <strong>Type propagation visualization</strong> — Watch the type checker annotate the AST in
          real time. The "Visualize Type Propagation" button in the AST tab replays a bottom-up animation
          showing how types are inferred from leaf expressions to their parents
        </li>
      </ul>
    </section>

    <section class="docs-section">
      <h2>Step-Through Execution</h2>
      <p>
        The <strong>Step</strong> button (or <kbd>F10</kbd>) starts a slow-motion debugger that
        executes your program one statement at a time.
      </p>
      <ul>
        <li>
          <strong>Synchronized highlights</strong> — A green execution cursor highlights the current statement
          across the editor, AST tree, and assembly panel simultaneously
        </li>
        <li>
          <strong>Step controls</strong> — Stop, Step Forward, and Play/Pause buttons appear above the
          console. Play auto-advances through statements at an adjustable speed (0.5x&ndash;4x)
        </li>
        <li>
          <strong>Live variables</strong> — A variables panel shows every in-scope variable and its current
          value. Changed values flash green; new variables fade in
        </li>
        <li>
          <strong>Call tracking</strong> — The status bar shows the current step number, function name,
          and call depth. Entering a function increments the depth; returning decrements it
        </li>
        <li>
          <strong>Interactive input</strong> — Programs that call <code>input()</code> still pause for
          user input during stepping
        </li>
      </ul>
    </section>

    <section class="docs-section">
      <h2>Error Handling</h2>
      <ul>
        <li><strong>Syntax errors</strong> — Reported with source line and column locations</li>
        <li>
          <strong>Type errors</strong> — Human-readable messages that explain what went wrong and suggest
          fixes. Non-fatal; all errors collected and shown with source locations
        </li>
        <li>
          <strong>Runtime errors</strong> — Division by zero, index out of bounds, <code>None</code> attribute
          access — shown with source locations in the console
        </li>
        <li>
          <strong>Infinite loop protection</strong> — The interpreter enforces a 1,000,000 operation limit
        </li>
      </ul>
    </section>

    <section class="docs-section">
      <h2>Keyboard Shortcuts</h2>
      <div class="shortcuts-table">
        <div class="shortcut-row">
          <kbd>Cmd/Ctrl + Enter</kbd>
          <span>Compile</span>
        </div>
        <div class="shortcut-row">
          <kbd>Cmd/Ctrl + Shift + Enter</kbd>
          <span>Compile + Run</span>
        </div>
        <div class="shortcut-row">
          <kbd>Cmd/Ctrl + 1/2/3/4</kbd>
          <span>Switch output tabs (AST / ASM / Run / Docs)</span>
        </div>
        <div class="shortcut-row">
          <kbd>F10</kbd>
          <span>Step forward (or start stepping)</span>
        </div>
        <div class="shortcut-row">
          <kbd>Escape</kbd>
          <span>Stop step-through execution</span>
        </div>
      </div>
    </section>

    <section class="docs-section">
      <h2>Links</h2>
      <ul>
        <li>
          <a href="https://github.com/prabhask5/compiler-ui" target="_blank" rel="noopener"
            >compiler-ui</a
          > — Source code
        </li>
        <li>
          <a
            href="https://github.com/prabhask5/compiler-ui/tree/main/typed-python-compiler"
            target="_blank"
            rel="noopener">typed-python-compiler</a
          > — Rust compiler internals
        </li>
        <li>
          <a href="https://compiler.prabhas.io" target="_blank" rel="noopener"
            >compiler.prabhas.io</a
          > — Live site
        </li>
      </ul>
    </section>
  </div>
</div>

<style>
  .docs-panel {
    height: 100%;
    overflow: auto;
  }

  .docs-content {
    max-width: 640px;
    padding: var(--space-lg) var(--space-xl);
  }

  .docs-section {
    margin-bottom: var(--space-xl);
  }

  .docs-section h2 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: var(--space-sm);
    letter-spacing: -0.01em;
  }

  .docs-section p {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.6;
    margin-bottom: var(--space-sm);
  }

  .docs-section ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .docs-section li {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.6;
    padding-left: var(--space-md);
    position: relative;
  }

  .docs-section li::before {
    content: '\00b7';
    position: absolute;
    left: 4px;
    color: var(--text-muted);
    font-weight: 700;
  }

  .docs-section a {
    color: var(--accent);
    text-decoration: none;
    transition: color var(--duration-fast) var(--ease);
  }

  .docs-section a:hover {
    color: var(--accent-hover);
    text-decoration: underline;
  }

  .docs-section code {
    font-family: var(--font-code);
    font-size: 12px;
    padding: 1px 5px;
    background: var(--bg-hover);
    border-radius: 3px;
    color: var(--text);
  }

  .docs-section strong {
    color: var(--text);
    font-weight: 600;
  }

  .shortcuts-table {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    font-size: 13px;
    color: var(--text-secondary);
  }

  .shortcut-row kbd {
    font-family: var(--font-code);
    font-size: 11px;
    padding: 2px 6px;
    background: var(--bg-hover);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
    min-width: 180px;
  }

  @media (max-width: 767px) {
    .shortcut-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
    }

    .shortcut-row kbd {
      min-width: unset;
    }
  }
</style>
