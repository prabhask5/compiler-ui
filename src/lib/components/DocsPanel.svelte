<div class="docs-panel">
  <div class="docs-content">
    <section class="docs-section">
      <h2>Language Overview</h2>
      <p>
        <strong>Typed Python</strong> (also known as <a href="https://chocopy.org/" target="_blank" rel="noopener">ChocoPy</a>)
        is a restricted subset of Python 3 designed for compilers courses. It features:
      </p>
      <ul>
        <li>Static type annotations on all variables, parameters, and return types</li>
        <li>Classes with single inheritance and method overriding</li>
        <li>First-class lists with type-checked element types</li>
        <li>Nested functions with lexical closures</li>
        <li><code>for</code>/<code>while</code> loops, <code>if</code>/<code>elif</code>/<code>else</code> branching</li>
        <li>Built-in functions: <code>print</code>, <code>input</code>, <code>len</code></li>
        <li>Integer, boolean, string, and <code>None</code> types</li>
      </ul>
    </section>

    <section class="docs-section">
      <h2>Compiler Architecture</h2>
      <p>The underlying compiler is written in Rust and consists of:</p>
      <ul>
        <li><strong>Lexer</strong> — Hand-written tokenizer with indentation tracking</li>
        <li><strong>Parser</strong> — Recursive descent with 2-token lookahead to distinguish declarations from statements</li>
        <li><strong>Type Checker</strong> — Produces a fully typed AST with inferred types on every expression</li>
        <li><strong>Code Generator</strong> — Emits x86-64 assembly with mark-and-sweep garbage collection (native only)</li>
      </ul>
    </section>

    <section class="docs-section">
      <h2>Browser Playground</h2>
      <p>This UI runs the compiler entirely in the browser:</p>
      <ul>
        <li>The Rust compiler is compiled to <strong>WebAssembly</strong> via <code>wasm-pack</code></li>
        <li>Parsing and type checking happen in WASM — producing both untyped and typed ASTs</li>
        <li>Program execution uses a <strong>TypeScript tree-walking interpreter</strong> that traverses the typed AST directly</li>
        <li>No server required — everything runs client-side</li>
      </ul>
    </section>

    <section class="docs-section">
      <h2>Error Handling</h2>
      <ul>
        <li><strong>Syntax errors</strong> — Reported with source line and column locations</li>
        <li><strong>Type errors</strong> — Non-fatal; all errors collected and shown with source locations</li>
        <li><strong>Runtime errors</strong> — Division by zero, index out of bounds, <code>None</code> attribute access — shown with source locations in the console</li>
        <li><strong>Infinite loop protection</strong> — The interpreter enforces a 1,000,000 operation limit</li>
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
          <span>Switch output tabs</span>
        </div>
      </div>
    </section>

    <section class="docs-section">
      <h2>Links</h2>
      <ul>
        <li><a href="https://github.com/prabhask5/typed-python-compiler" target="_blank" rel="noopener">typed-python-compiler</a> — Rust compiler source</li>
        <li><a href="https://github.com/prabhask5/compiler-ui" target="_blank" rel="noopener">compiler-ui</a> — This playground's source</li>
        <li><a href="https://compiler.prabhas.io" target="_blank" rel="noopener">compiler.prabhas.io</a> — Live site</li>
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
    content: '·';
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
</style>
