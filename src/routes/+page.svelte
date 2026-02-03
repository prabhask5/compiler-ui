<script lang="ts">
  import { onMount } from 'svelte';
  import { initWasm, onStateChange, type WasmState } from '$lib/compiler/wasm-loader';
  import { compile } from '$lib/compiler/compiler';
  import type { CompileResult, CompilerError } from '$lib/compiler/types';
  import { examples } from '$lib/examples/programs';
  import Editor from '$lib/components/Editor.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import OutputPanel from '$lib/components/OutputPanel.svelte';
  import ErrorPanel from '$lib/components/ErrorPanel.svelte';
  import Divider from '$lib/components/Divider.svelte';
  import Console from '$lib/components/Console.svelte';
  import { interpret, type InterpreterOutput } from '$lib/interpreter/interpreter';
  import { decompressFromEncodedURIComponent, compressToEncodedURIComponent } from 'lz-string';

  let wasmState: WasmState = $state('idle');
  let source = $state(examples[0].code);
  let result: CompileResult | null = $state(null);
  let activeTab: 'ast' | 'run' | 'docs' = $state('ast');
  let splitPercent = $state(50);
  let highlightLoc: [number, number, number, number] | null = $state(null);
  let errors: CompilerError[] = $state([]);
  let isCompiling = $state(false);
  let consoleOutput: InterpreterOutput[] = $state([]);
  let isRunning = $state(false);
  let runTime = $state(0);
  let waitingForInput = $state(false);
  let inputResolver: ((value: string) => void) | null = null;
  let isMobile = $state(false);
  let mobileView: 'editor' | 'output' = $state('editor');

  function checkMobile() {
    isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  }

  onMount(() => {
    checkMobile();
    window.addEventListener('resize', checkMobile);

    onStateChange((s) => (wasmState = s));
    initWasm().then(() => {
      // Check URL hash for shared code
      const hasSharedCode = loadFromHash();
      // Auto-compile on load, and auto-run if loading from shared URL
      doCompile().then(() => {
        if (hasSharedCode) doRun();
      });
    });

    // Keyboard shortcuts
    function handleKeydown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          doCompile().then(() => doRun());
        } else {
          doCompile();
        }
      }
      if (mod && e.key === 'e') {
        e.preventDefault();
      }
      if (mod && e.key >= '1' && e.key <= '3') {
        e.preventDefault();
        const tabs: (typeof activeTab)[] = ['ast', 'run', 'docs'];
        activeTab = tabs[parseInt(e.key) - 1];
      }
    }

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('keydown', handleKeydown);
    };
  });

  function loadFromHash(): boolean {
    if (typeof window === 'undefined') return false;
    const hash = window.location.hash.slice(1);
    if (hash) {
      try {
        const decoded = decompressFromEncodedURIComponent(hash);
        if (decoded) {
          source = decoded;
          return true;
        }
      } catch {
        // Ignore invalid hash
      }
    }
    return false;
  }

  function doCompile(): Promise<void> {
    return new Promise((resolve) => {
      if (wasmState !== 'ready') {
        resolve();
        return;
      }
      isCompiling = true;
      // Use setTimeout to allow UI to show compiling state
      setTimeout(() => {
        const r = compile(source);
        if (r) {
          result = r;
          errors = r.errors;
        }
        isCompiling = false;
        resolve();
      }, 10);
    });
  }

  async function doRun() {
    if (!result || result.hasErrors) return;
    activeTab = 'run';
    consoleOutput = [];
    isRunning = true;
    waitingForInput = false;
    const start = performance.now();

    try {
      await interpret(result.typedAst, {
        onOutput(text: string) {
          consoleOutput = [...consoleOutput, { kind: 'output', text }];
        },
        async onInput(): Promise<string> {
          waitingForInput = true;
          return new Promise<string>((resolve) => {
            inputResolver = resolve;
          });
        },
        onError(message: string, location?: [number, number, number, number]) {
          consoleOutput = [...consoleOutput, { kind: 'error', text: message, location }];
        }
      });
      runTime = performance.now() - start;
      consoleOutput = [
        ...consoleOutput,
        { kind: 'status', text: `Completed in ${runTime.toFixed(1)}ms` }
      ];
    } catch (e) {
      runTime = performance.now() - start;
      const msg = e instanceof Error ? e.message : String(e);
      consoleOutput = [...consoleOutput, { kind: 'error', text: msg }];
    } finally {
      isRunning = false;
      waitingForInput = false;
    }
  }

  function submitInput(value: string) {
    if (inputResolver) {
      consoleOutput = [...consoleOutput, { kind: 'input', text: value }];
      inputResolver(value);
      inputResolver = null;
      waitingForInput = false;
    }
  }

  function onSelectExample(index: number) {
    source = examples[index].code;
    result = null;
    errors = [];
    consoleOutput = [];
    highlightLoc = null;
    doCompile();
  }

  function onShare() {
    const compressed = compressToEncodedURIComponent(source);
    const url = `${window.location.origin}${window.location.pathname}#${compressed}`;
    navigator.clipboard.writeText(url).then(() => {
      // Brief feedback
      const btn = document.querySelector('.share-btn .btn');
      if (btn) {
        btn.textContent = 'Copied!';
        setTimeout(() => (btn.textContent = 'Share'), 1500);
      }
    });
  }

  function onErrorClick(loc: [number, number, number, number]) {
    highlightLoc = loc;
    if (isMobile) mobileView = 'editor';
  }

  function onNodeClick(loc: [number, number, number, number]) {
    if (
      highlightLoc &&
      highlightLoc[0] === loc[0] &&
      highlightLoc[1] === loc[1] &&
      highlightLoc[2] === loc[2] &&
      highlightLoc[3] === loc[3]
    ) {
      highlightLoc = null;
    } else {
      highlightLoc = loc;
    }
  }
</script>

<div class="playground" class:mobile={isMobile}>
  <Toolbar
    {wasmState}
    {isCompiling}
    {isRunning}
    hasErrors={result?.hasErrors ?? false}
    onCompile={doCompile}
    onRun={doRun}
    {onSelectExample}
    {onShare}
  />

  {#if isMobile}
    <div class="mobile-content">
      {#if mobileView === 'editor'}
        <div class="panel editor-panel">
          {#if wasmState === 'ready'}
            <Editor bind:source {highlightLoc} {errors} />
          {:else}
            <div class="skeleton-editor">
              <div class="skeleton" style="width: 60%; height: 14px; margin: 12px 16px"></div>
              <div class="skeleton" style="width: 80%; height: 14px; margin: 8px 16px"></div>
              <div class="skeleton" style="width: 40%; height: 14px; margin: 8px 16px"></div>
              <div class="skeleton" style="width: 70%; height: 14px; margin: 8px 16px"></div>
            </div>
          {/if}
        </div>
      {:else}
        <div class="panel output-panel">
          <OutputPanel {result} {activeTab} onTabChange={(t) => (activeTab = t)} {onNodeClick} />
          {#if activeTab === 'run'}
            <Console
              output={consoleOutput}
              {isRunning}
              {waitingForInput}
              {submitInput}
              {onErrorClick}
            />
          {/if}
        </div>
      {/if}
    </div>

    {#if errors.length > 0}
      <ErrorPanel {errors} {onErrorClick} />
    {/if}

    <div class="mobile-tabs glass">
      <button
        class="mobile-tab"
        class:active={mobileView === 'editor'}
        onclick={() => (mobileView = 'editor')}
      >
        <span class="tab-icon">{'</>'}</span>
        Editor
      </button>
      <button
        class="mobile-tab"
        class:active={mobileView === 'output'}
        onclick={() => (mobileView = 'output')}
      >
        <span class="tab-icon">◎</span>
        Output
      </button>
    </div>
  {:else}
    <div class="desktop-content">
      <div class="panel editor-panel" style="width: {splitPercent}%">
        {#if wasmState === 'ready'}
          <Editor bind:source {highlightLoc} {errors} />
        {:else if wasmState === 'loading'}
          <div class="skeleton-editor">
            <div class="skeleton" style="width: 60%; height: 14px; margin: 12px 16px"></div>
            <div class="skeleton" style="width: 80%; height: 14px; margin: 8px 16px"></div>
            <div class="skeleton" style="width: 40%; height: 14px; margin: 8px 16px"></div>
            <div class="skeleton" style="width: 70%; height: 14px; margin: 8px 16px"></div>
            <div class="skeleton" style="width: 55%; height: 14px; margin: 8px 16px"></div>
          </div>
        {:else if wasmState === 'error'}
          <div class="error-state">
            <p>Failed to load compiler</p>
            <button onclick={() => initWasm()}>Retry</button>
          </div>
        {/if}
      </div>

      <Divider bind:splitPercent />

      <div class="panel output-panel" style="width: {100 - splitPercent}%">
        <OutputPanel {result} {activeTab} onTabChange={(t) => (activeTab = t)} {onNodeClick} />
        {#if activeTab === 'run'}
          <Console
            output={consoleOutput}
            {isRunning}
            {waitingForInput}
            {submitInput}
            {onErrorClick}
          />
        {/if}
      </div>
    </div>

    {#if errors.length > 0}
      <ErrorPanel {errors} {onErrorClick} />
    {/if}
  {/if}
</div>

<style>
  .playground {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .desktop-content {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .mobile-content {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .panel {
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .editor-panel {
    background: var(--bg);
    flex: 1;
  }

  .output-panel {
    background: var(--bg);
    border-left: 1px solid var(--border);
    flex: 1;
  }

  .mobile .output-panel {
    border-left: none;
  }

  .skeleton-editor {
    padding: var(--space-xl);
  }

  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: var(--space-md);
    color: var(--text-secondary);
  }

  .error-state button {
    padding: var(--space-sm) var(--space-lg);
    background: var(--accent);
    color: white;
    border-radius: var(--radius-md);
    font-weight: 500;
  }

  /* Mobile tabs */
  .mobile-tabs {
    display: flex;
    border-top: 1px solid var(--border);
    padding: var(--space-xs) var(--space-sm);
    padding-bottom: env(safe-area-inset-bottom, var(--space-xs));
  }

  .mobile-tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: var(--space-sm);
    font-size: 11px;
    color: var(--text-muted);
    transition: color var(--duration-fast) var(--ease);
    min-height: 44px;
    justify-content: center;
  }

  .mobile-tab.active {
    color: var(--accent);
  }

  .tab-icon {
    font-size: 16px;
  }
</style>
