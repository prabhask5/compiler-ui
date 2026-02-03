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
      <span class="logo-icon">C</span>
      <span class="logo-text">ChocoPy</span>
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
    <button class="btn btn-ghost share-btn" onclick={onShare}> Share </button>

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
    background: var(--accent);
    color: white;
    border-radius: var(--radius-sm);
    font-family: var(--font-code);
    font-size: 13px;
    font-weight: 700;
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
