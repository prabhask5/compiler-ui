<script lang="ts">
  import type { WasmState } from '$lib/compiler/wasm-loader';
  import { examples } from '$lib/examples/programs';

  let {
    wasmState,
    isCompiling,
    isRunning,
    hasErrors,
    onCompile,
    onRun,
    onSelectExample,
    onShare
  }: {
    wasmState: WasmState;
    isCompiling: boolean;
    isRunning: boolean;
    hasErrors: boolean;
    onCompile: () => void;
    onRun: () => void;
    onSelectExample: (index: number) => void;
    onShare: () => void;
  } = $props();

  let showExamples = $state(false);
</script>

<header class="toolbar glass">
  <div class="toolbar-left">
    <h1 class="logo">
      <span class="logo-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="24" height="24">
          <defs>
            <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#0f0f13"/>
              <stop offset="100%" stop-color="#09090b"/>
            </linearGradient>
            <linearGradient id="logo-accent" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#818cf8"/>
              <stop offset="100%" stop-color="#6366f1"/>
            </linearGradient>
          </defs>
          <rect width="32" height="32" rx="7" fill="url(#logo-bg)"/>
          <path d="M13 9.5 L6.5 16 L13 22.5" fill="none" stroke="url(#logo-accent)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M19 9.5 L25.5 16 L19 22.5" fill="none" stroke="url(#logo-accent)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M18 8 L14 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
        </svg>
      </span>
      <span class="logo-text">Typed Python Compiler UI</span>
    </h1>

    <div class="divider-v"></div>

    <div class="examples-wrapper">
      <button class="btn btn-ghost" onclick={() => (showExamples = !showExamples)}>
        Examples
        <span class="caret" class:open={showExamples}>▾</span>
      </button>

      {#if showExamples}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="dropdown-backdrop" onclick={() => (showExamples = false)}></div>
        <div class="dropdown">
          {#each examples as example, i}
            <button
              class="dropdown-item"
              onclick={() => {
                onSelectExample(i);
                showExamples = false;
              }}
            >
              <span class="dropdown-name">{example.name}</span>
              <span class="dropdown-desc">{example.description}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <div class="toolbar-right">
    <a
      class="btn btn-ghost github-btn"
      href="https://github.com/prabhask5/compiler-ui"
      target="_blank"
      rel="noopener"
      aria-label="View source on GitHub"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="18" height="18" fill="currentColor">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
      </svg>
    </a>

    <div class="tooltip-wrapper share-btn">
      <button class="btn btn-ghost" onclick={onShare}> Share </button>
      <span class="tooltip-text">Compresses your code into a shareable URL. Anyone with the link sees your code, compilation result, and program output.</span>
    </div>

    <button
      class="btn btn-compile"
      class:compiling={isCompiling}
      disabled={wasmState !== 'ready' || isCompiling}
      onclick={onCompile}
    >
      {#if isCompiling}
        Compiling…
      {:else}
        Compile
      {/if}
      <kbd>⌘↵</kbd>
    </button>

    <button
      class="btn btn-run"
      disabled={wasmState !== 'ready' || isRunning || hasErrors}
      onclick={onRun}
    >
      {#if isRunning}
        Running…
      {:else}
        Run
      {/if}
      <kbd>⌘⇧↵</kbd>
    </button>
  </div>
</header>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--header-height);
    padding: 0 var(--space-lg);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    z-index: 100;
  }

  .toolbar-left,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .logo {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.025em;
  }

  .logo-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
  }

  .logo-text {
    color: var(--text);
  }

  .divider-v {
    width: 1px;
    height: 20px;
    background: var(--border);
    margin: 0 var(--space-xs);
  }

  /* Buttons */
  .btn {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 500;
    transition:
      background var(--duration-fast) var(--ease),
      transform var(--duration-fast) var(--ease),
      box-shadow var(--duration-fast) var(--ease);
  }

  .btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .btn-ghost {
    color: var(--text-secondary);
  }

  .btn-ghost:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  .btn-compile {
    background: var(--accent);
    color: white;
  }

  .btn-compile:hover:not(:disabled) {
    background: var(--accent-hover);
    box-shadow: 0 0 16px var(--accent-glow);
  }

  .btn-compile.compiling {
    box-shadow: 0 0 20px var(--accent-glow-strong);
  }

  .btn-run {
    background: var(--bg-hover);
    color: var(--text);
  }

  .btn-run:hover:not(:disabled) {
    background: var(--bg-card);
  }

  kbd {
    font-family: var(--font-ui);
    font-size: 10px;
    padding: 1px 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    color: var(--text-secondary);
  }

  .caret {
    font-size: 10px;
    transition: transform var(--duration-fast) var(--ease);
  }

  .caret.open {
    transform: rotate(180deg);
  }

  /* Dropdown */
  .examples-wrapper {
    position: relative;
  }

  .dropdown-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .dropdown {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    min-width: 260px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 100;
    padding: var(--space-xs);
    animation: fadeIn var(--duration) var(--ease);
    max-height: 400px;
    overflow-y: auto;
  }

  .dropdown-item {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-sm);
    text-align: left;
    transition: background var(--duration-fast) var(--ease);
  }

  .dropdown-item:hover {
    background: var(--bg-hover);
  }

  .dropdown-name {
    font-weight: 500;
    color: var(--text);
    font-size: 13px;
  }

  .dropdown-desc {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 1px;
  }

  /* GitHub button */
  .github-btn {
    padding: 6px;
    color: var(--text-secondary);
    text-decoration: none;
  }

  .github-btn:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  /* Share tooltip */
  .tooltip-wrapper {
    position: relative;
  }

  .tooltip-text {
    visibility: hidden;
    opacity: 0;
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 260px;
    padding: var(--space-sm) var(--space-md);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-lg);
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-secondary);
    z-index: 200;
    pointer-events: none;
    transition:
      opacity var(--duration-fast) var(--ease),
      visibility var(--duration-fast) var(--ease);
  }

  .tooltip-wrapper:hover .tooltip-text {
    visibility: visible;
    opacity: 1;
  }

  @media (max-width: 767px) {
    .logo-text {
      display: none;
    }

    kbd {
      display: none;
    }

    .toolbar-left,
    .toolbar-right {
      gap: var(--space-xs);
    }

    .btn {
      padding: 6px 8px;
      font-size: 12px;
    }

    .share-btn {
      display: none;
    }
  }
</style>
