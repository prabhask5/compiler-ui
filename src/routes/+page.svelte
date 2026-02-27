<script lang="ts">
  /**
   * Main playground page -- orchestrates the entire compiler UI.
   *
   * All application state is managed here via Svelte 5 runes and passed down
   * to child components as props. The page lifecycle is:
   *
   * 1. On mount, initialize the WASM compiler module.
   * 2. Once ready, auto-compile the default example (or a shared snippet from
   *    the URL hash).
   * 3. The user edits code in the Editor, clicks Compile (Cmd+Enter), and
   *    views the typed AST in the OutputPanel.
   * 4. Clicking Run (Cmd+Shift+Enter) executes the AST via the tree-walking
   *    interpreter, streaming output to the Console component.
   * 5. Errors are displayed in the ErrorPanel with optional enriched commentary.
   * 6. Clicking an error or AST node highlights the corresponding source range
   *    in the editor.
   *
   * Keyboard shortcuts:
   * - Cmd/Ctrl+Enter       -- Compile
   * - Cmd/Ctrl+Shift+Enter -- Compile then Run
   * - Cmd/Ctrl+1/2/3/4     -- Switch output tab (AST / ASM / Run / Docs)
   * - F10                   -- Step forward (or start stepping if not already)
   * - Escape                -- Stop stepping
   */
  import { onMount } from 'svelte';
  import { initWasm, onStateChange, type WasmState } from '$lib/compiler/wasm-loader';
  import { compile, generateAssembly } from '$lib/compiler/compiler';
  import type { CompileResult, CompilerError, AssemblyOutput } from '$lib/compiler/types';
  import { examples } from '$lib/examples/programs';
  import Editor from '$lib/components/Editor.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import OutputPanel from '$lib/components/OutputPanel.svelte';
  import ErrorPanel from '$lib/components/ErrorPanel.svelte';
  import Divider from '$lib/components/Divider.svelte';
  import Console from '$lib/components/Console.svelte';
  import {
    interpret,
    StopExecution,
    type InterpreterOutput,
    type StepEvent
  } from '$lib/interpreter/interpreter';
  import StepControls from '$lib/components/StepControls.svelte';
  import VariablesPanel from '$lib/components/VariablesPanel.svelte';
  import { enrichErrors, type EnrichedError } from '$lib/utils/error-commentary';
  import { decompressFromEncodedURIComponent, compressToEncodedURIComponent } from 'lz-string';

  // --- Core application state (Svelte 5 runes) ---

  /** Lifecycle state of the WASM compiler: 'idle' | 'loading' | 'ready' | 'error'. */
  let wasmState: WasmState = $state('idle');
  /** Python source code currently in the editor. */
  let source = $state(examples[0].code);
  /** Result object from the most recent compilation, or null. */
  let result: CompileResult | null = $state(null);
  /** Currently active output panel tab. */
  let activeTab: 'ast' | 'asm' | 'run' | 'docs' = $state('ast');
  /** Assembly output from the most recent successful compile. */
  let assembly: AssemblyOutput | null = $state(null);
  /** Horizontal split position as a percentage (editor width). */
  let splitPercent = $state(50);
  /** Source location to highlight in the editor, or null. */
  let highlightLoc: [number, number, number, number] | null = $state(null);
  /** Compiler errors from the last compilation. */
  let errors: CompilerError[] = $state([]);
  /** True while a compilation is in progress. */
  let isCompiling = $state(false);
  /** Accumulated interpreter output lines. */
  let consoleOutput: InterpreterOutput[] = $state([]);
  /** True while the interpreter is executing. */
  let isRunning = $state(false);
  /** Wall-clock time of the last run in milliseconds. */
  let runTime = $state(0);
  /** True when the interpreter is blocked waiting for user input. */
  let waitingForInput = $state(false);
  /** Resolve function for the pending input() promise; null when not waiting. */
  let inputResolver: ((value: string) => void) | null = null;
  /** True when viewport width is below the mobile breakpoint (768px). */
  let isMobile = $state(false);
  /** Which panel is visible on mobile (editor or output). */
  let mobileView: 'editor' | 'output' = $state('editor');

  // --- Step-through execution state ---
  /** True while step-through execution is active. */
  let isStepping = $state(false);
  /** True while auto-play is advancing steps. */
  let isPlaying = $state(false);
  /** Playback speed multiplier. */
  let stepSpeed = $state(1);
  /** Current step event data from the interpreter. */
  let stepInfo: StepEvent | null = $state(null);
  /** Resolve function for the current step pause. */
  let stepResolver: (() => void) | null = null;
  /** Reject function for the current step pause (used for StopExecution). */
  let stepRejecter: ((e: Error) => void) | null = null;
  /** Timeout ID for auto-play scheduling. */
  let playTimeoutId: ReturnType<typeof setTimeout> | null = null;

  /** Errors enriched with human-readable commentary for the ErrorPanel. */
  let enrichedErrorList: EnrichedError[] = $state([]);

  /** Source code split into lines for assembly annotations. */
  const sourceLines = $derived(source.split('\n'));
  /** The source line (1-based) currently highlighted, derived from highlightLoc. */
  const highlightedSourceLine = $derived(highlightLoc ? highlightLoc[0] : null);
  /** Execution cursor location for the editor (green highlight, separate from blue). */
  const executionLoc = $derived.by(() => {
    if (isStepping && stepInfo) return stepInfo.location;
    return null;
  });

  function checkMobile() {
    isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  }

  onMount(() => {
    checkMobile();
    window.addEventListener('resize', checkMobile);

    onStateChange((s) => (wasmState = s));
    initWasm().then(() => {
      const hasSharedCode = loadFromHash();
      doCompile().then(() => {
        if (hasSharedCode) doRun();
      });
    });

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
      if (mod && e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        const tabs: (typeof activeTab)[] = ['ast', 'asm', 'run', 'docs'];
        activeTab = tabs[parseInt(e.key) - 1];
      }
      if (e.key === 'F10') {
        e.preventDefault();
        if (isStepping) {
          stepForward();
        } else {
          doStep();
        }
      }
      if (e.key === 'Escape' && isStepping) {
        e.preventDefault();
        stopStepping();
      }
    }

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('keydown', handleKeydown);
    };
  });

  /**
   * Attempt to load shared source code from the URL hash fragment.
   * The hash contains an lz-string compressed/encoded Python source string.
   *
   * @returns True if shared code was successfully decoded and loaded.
   */
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

  /** Minimum visual duration for compile feedback (avoids jarring flash). */
  const MIN_COMPILE_MS = 400;

  /**
   * Compile the current source code using the WASM compiler.
   * Enforces a minimum visual duration so the "Compiling..." state is perceptible.
   * Updates `result`, `errors`, and `enrichedErrorList` on completion.
   *
   * @returns A promise that resolves when compilation (and the minimum delay) finishes.
   */
  function doCompile(): Promise<void> {
    return new Promise((resolve) => {
      if (wasmState !== 'ready') {
        resolve();
        return;
      }
      isCompiling = true;
      const start = performance.now();
      setTimeout(async () => {
        const r = compile(source);
        if (r) {
          result = r;
          errors = r.errors;
          enrichedErrorList = enrichErrors(r.errors, source);
          assembly = r.hasErrors ? null : generateAssembly(source);
        }
        const elapsed = performance.now() - start;
        if (elapsed < MIN_COMPILE_MS) {
          await new Promise((r) => setTimeout(r, MIN_COMPILE_MS - elapsed));
        }
        isCompiling = false;
        resolve();
      }, 10);
    });
  }

  /** Minimum visual duration for run feedback. */
  const MIN_RUN_MS = 300;

  /**
   * Execute the compiled AST via the tree-walking interpreter.
   * Switches to the Run tab, clears previous output, and streams stdout/stderr
   * lines into `consoleOutput`. Supports interactive `input()` calls by setting
   * `waitingForInput` and awaiting `inputResolver`. Appends a status line with
   * elapsed time on completion.
   */
  async function doRun() {
    if (!result || result.hasErrors) return;
    activeTab = 'run';
    if (isMobile) mobileView = 'output';
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
      const elapsed = performance.now() - start;
      if (elapsed < MIN_RUN_MS) {
        await new Promise((r) => setTimeout(r, MIN_RUN_MS - elapsed));
      }
      isRunning = false;
      waitingForInput = false;
    }
  }

  /**
   * Start step-through execution. Similar to doRun() but passes stepMode
   * option to the interpreter, pausing at each statement.
   */
  async function doStep() {
    if (isStepping) return;
    if (!result || result.hasErrors) return;
    activeTab = 'run';
    if (isMobile) mobileView = 'output';
    consoleOutput = [];
    isRunning = true;
    isStepping = true;
    isPlaying = false;
    stepInfo = null;
    waitingForInput = false;
    const start = performance.now();

    try {
      await interpret(
        result.typedAst,
        {
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
        },
        {
          async onStep(event: StepEvent): Promise<void> {
            stepInfo = event;
            highlightLoc = event.location;
            return new Promise<void>((resolve, reject) => {
              stepResolver = resolve;
              stepRejecter = reject;
              // If auto-play is active, schedule the next step
              if (isPlaying) {
                scheduleNextStep();
              }
            });
          }
        }
      );
      runTime = performance.now() - start;
      consoleOutput = [
        ...consoleOutput,
        { kind: 'status', text: `Completed in ${runTime.toFixed(1)}ms` }
      ];
    } catch (e) {
      if (!(e instanceof StopExecution)) {
        runTime = performance.now() - start;
        const msg = e instanceof Error ? e.message : String(e);
        consoleOutput = [...consoleOutput, { kind: 'error', text: msg }];
      }
    } finally {
      isRunning = false;
      isStepping = false;
      isPlaying = false;
      stepInfo = null;
      stepResolver = null;
      stepRejecter = null;
      waitingForInput = false;
      if (playTimeoutId !== null) {
        clearTimeout(playTimeoutId);
        playTimeoutId = null;
      }
    }
  }

  /** Advance one step in step-through execution. */
  function stepForward() {
    if (stepResolver) {
      const resolve = stepResolver;
      stepResolver = null;
      stepRejecter = null;
      resolve();
    }
  }

  /** Stop step-through execution by rejecting with StopExecution. */
  function stopStepping() {
    if (playTimeoutId !== null) {
      clearTimeout(playTimeoutId);
      playTimeoutId = null;
    }
    isPlaying = false;
    if (stepRejecter) {
      const reject = stepRejecter;
      stepResolver = null;
      stepRejecter = null;
      reject(new StopExecution());
    }
  }

  /** Start auto-play: automatically advance steps at the current speed. */
  function startPlaying() {
    isPlaying = true;
    scheduleNextStep();
  }

  /** Pause auto-play. */
  function pausePlaying() {
    isPlaying = false;
    if (playTimeoutId !== null) {
      clearTimeout(playTimeoutId);
      playTimeoutId = null;
    }
  }

  /** Schedule the next auto-play step after the speed-dependent delay. */
  function scheduleNextStep() {
    if (playTimeoutId !== null) {
      clearTimeout(playTimeoutId);
    }
    playTimeoutId = setTimeout(() => {
      playTimeoutId = null;
      if (isPlaying && stepResolver) {
        const resolve = stepResolver;
        stepResolver = null;
        stepRejecter = null;
        resolve();
      }
    }, 500 / stepSpeed);
  }

  // Re-schedule on speed change during playback
  $effect(() => {
    if (isPlaying && stepResolver) {
      // Accessing stepSpeed to create the dependency
      const _speed = stepSpeed;
      if (playTimeoutId !== null) {
        clearTimeout(playTimeoutId);
      }
      playTimeoutId = setTimeout(() => {
        playTimeoutId = null;
        if (isPlaying && stepResolver) {
          const resolve = stepResolver;
          stepResolver = null;
          stepRejecter = null;
          resolve();
        }
      }, 500 / _speed);
    }
  });

  /**
   * Resolve a pending interpreter `input()` call with the user's typed value.
   * Appends the input as an echo line in the console output.
   *
   * @param value - The string entered by the user.
   */
  function submitInput(value: string) {
    if (inputResolver) {
      consoleOutput = [...consoleOutput, { kind: 'input', text: value }];
      inputResolver(value);
      inputResolver = null;
      waitingForInput = false;
    }
  }

  /**
   * Load a predefined example program by index. Resets all compilation and
   * execution state, then triggers a fresh compile.
   *
   * @param index - Index into the `examples` array.
   */
  function onSelectExample(index: number) {
    if (isStepping) stopStepping();
    source = examples[index].code;
    result = null;
    assembly = null;
    errors = [];
    consoleOutput = [];
    highlightLoc = null;
    enrichedErrorList = [];
    isStepping = false;
    stepInfo = null;
    doCompile();
  }

  /**
   * Generate a shareable URL by compressing the current source into the URL
   * hash fragment and copying the full URL to the clipboard. Briefly changes
   * the Share button text to "Copied!" for user feedback.
   */
  function onShare() {
    const compressed = compressToEncodedURIComponent(source);
    const url = `${window.location.origin}${window.location.pathname}#${compressed}`;
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.querySelector('.share-btn .btn');
      if (btn) {
        btn.textContent = 'Copied!';
        setTimeout(() => (btn.textContent = 'Share'), 1500);
      }
    });
  }

  /**
   * Handle a click on a compiler error. Highlights the error's source location
   * in the editor and switches to the editor view on mobile.
   *
   * @param loc - The [startRow, startCol, endRow, endCol] source location tuple.
   */
  function onErrorClick(loc: [number, number, number, number]) {
    highlightLoc = loc;
    if (isMobile) mobileView = 'editor';
  }

  /**
   * Handle a click on an AST node. Toggles the editor highlight: if the same
   * location is already highlighted, clears it; otherwise highlights the new
   * location.
   *
   * @param loc - The [startRow, startCol, endRow, endCol] source location tuple.
   */
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

  /**
   * Handle a click on an assembly instruction. Sets the highlight to cover
   * the entire source line so the editor, AST, and other ASM instructions
   * on the same line all highlight together.
   *
   * @param sourceLine - The 1-based source line number.
   */
  function onInstructionClick(sourceLine: number) {
    const lineText = sourceLines[sourceLine - 1] ?? '';
    const endCol = lineText.length;
    highlightLoc = [sourceLine, 1, sourceLine, endCol];
  }
</script>

<div class="playground" class:mobile={isMobile}>
  <Toolbar
    {wasmState}
    {isCompiling}
    {isRunning}
    hasErrors={result?.hasErrors ?? false}
    {isStepping}
    onCompile={doCompile}
    onRun={doRun}
    onStep={doStep}
    {onSelectExample}
    {onShare}
  />

  {#if isMobile}
    <div class="mobile-content">
      {#if mobileView === 'editor'}
        <div class="panel editor-panel">
          {#if wasmState === 'ready'}
            <Editor bind:source {highlightLoc} scrollToHighlight={true} {errors} {executionLoc} />
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
          <OutputPanel
            {result}
            {assembly}
            {sourceLines}
            {highlightedSourceLine}
            {highlightLoc}
            {activeTab}
            onTabChange={(t) => (activeTab = t)}
            {onNodeClick}
            {onInstructionClick}
            isExecuting={isStepping}
          />
          {#if activeTab === 'run'}
            {#if isStepping && stepInfo}
              <StepControls
                {isPlaying}
                stepNumber={stepInfo.stepNumber}
                callDepth={stepInfo.callDepth}
                currentFunction={stepInfo.currentFunction}
                bind:speed={stepSpeed}
                onPlay={startPlaying}
                onPause={pausePlaying}
                onStepForward={stepForward}
                onStop={stopStepping}
              />
              <VariablesPanel
                variables={stepInfo.variables}
                callDepth={stepInfo.callDepth}
                currentFunction={stepInfo.currentFunction}
              />
            {/if}
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
      <ErrorPanel {errors} enrichedErrors={enrichedErrorList} {onErrorClick} />
    {/if}

    <div class="mobile-tabs glass">
      <button
        class="mobile-tab"
        class:active={mobileView === 'editor'}
        onclick={() => (mobileView = 'editor')}
      >
        <span class="tab-icon">&lt;/&gt;</span>
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
          <Editor bind:source {highlightLoc} scrollToHighlight={true} {errors} {executionLoc} />
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
        <OutputPanel
          {result}
          {assembly}
          {sourceLines}
          {highlightedSourceLine}
          {highlightLoc}
          {activeTab}
          onTabChange={(t) => (activeTab = t)}
          {onNodeClick}
          {onInstructionClick}
          isExecuting={isStepping}
        />
        {#if activeTab === 'run'}
          {#if isStepping && stepInfo}
            <StepControls
              {isPlaying}
              stepNumber={stepInfo.stepNumber}
              callDepth={stepInfo.callDepth}
              currentFunction={stepInfo.currentFunction}
              bind:speed={stepSpeed}
              onPlay={startPlaying}
              onPause={pausePlaying}
              onStepForward={stepForward}
              onStop={stopStepping}
            />
            <VariablesPanel
              variables={stepInfo.variables}
              callDepth={stepInfo.callDepth}
              currentFunction={stepInfo.currentFunction}
            />
          {/if}
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
      <ErrorPanel {errors} enrichedErrors={enrichedErrorList} {onErrorClick} />
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
