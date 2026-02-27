<script lang="ts">
  /**
   * Execution output console with interactive input support.
   *
   * Displays a scrollable log of interpreter output lines (stdout, stdin echo,
   * errors, and status messages). When the running program calls `input()`,
   * this component shows a text field and waits for the user to press Enter
   * before resolving the interpreter's input promise. Error lines with source
   * locations are rendered as clickable buttons that highlight the
   * corresponding editor range.
   */
  import { tick } from 'svelte';
  import type { InterpreterOutput } from '$lib/interpreter/interpreter';

  let {
    output,
    isRunning,
    waitingForInput,
    submitInput,
    onErrorClick
  }: {
    /** Accumulated output lines from the interpreter. */
    output: InterpreterOutput[];
    /** True while the interpreter is executing. */
    isRunning: boolean;
    /** True when the interpreter is blocked on an input() call. */
    waitingForInput: boolean;
    /** Callback to resolve a pending input() with the user's typed value. */
    submitInput: (value: string) => void;
    /** Callback invoked when the user clicks a runtime error with a source location. */
    onErrorClick: (loc: [number, number, number, number]) => void;
  } = $props();

  /** Maximum output lines rendered; older lines are discarded from the DOM. */
  const MAX_LINES = 5000;

  /** Scrollable container element; used for auto-scrolling to latest output. */
  let scrollEl: HTMLDivElement = $state(null!);
  /** The text input element shown when the program requests user input. */
  let inputEl: HTMLInputElement = $state(null!);
  /** Current value of the input field, cleared after submission. */
  let inputValue = $state('');

  /** Number of lines truncated from the top. */
  const truncatedCount = $derived(Math.max(0, output.length - MAX_LINES));
  /** Visible output lines (last MAX_LINES). */
  const visibleOutput = $derived(output.length > MAX_LINES ? output.slice(-MAX_LINES) : output);

  // Auto-scroll to bottom whenever new output lines are appended.
  $effect(() => {
    if (output.length > 0) {
      tick().then(() => {
        if (scrollEl) {
          scrollEl.scrollTop = scrollEl.scrollHeight;
        }
      });
    }
  });

  // Automatically focus the input field when the interpreter blocks on input().
  $effect(() => {
    if (waitingForInput && inputEl) {
      tick().then(() => inputEl?.focus());
    }
  });

  /**
   * Handle keydown events on the console input field.
   * On Enter, submits the current value to the interpreter and clears the field.
   *
   * @param e - The keyboard event from the input element.
   */
  function handleInputKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitInput(inputValue);
      inputValue = '';
    }
  }
</script>

<div class="console">
  <div class="console-header">
    <span class="console-title">Console</span>
    {#if isRunning}
      <span class="status running">Running…</span>
    {/if}
  </div>

  <div class="console-output" bind:this={scrollEl}>
    {#if output.length === 0 && !isRunning}
      <div class="console-empty">Click Run to execute the program</div>
    {/if}

    {#if truncatedCount > 0}
      <div class="line line-status truncation-notice">
        {truncatedCount.toLocaleString()} earlier line{truncatedCount !== 1 ? 's' : ''} not shown
      </div>
    {/if}

    {#each visibleOutput as line, i (i)}
      {#if line.kind === 'output'}
        <div class="line line-output">{line.text}</div>
      {:else if line.kind === 'input'}
        <div class="line line-input">
          <span class="input-prefix">▸</span>
          {line.text}
        </div>
      {:else if line.kind === 'error'}
        {#if line.location}
          <button class="line line-error clickable" onclick={() => onErrorClick(line.location!)}>
            {line.text}
          </button>
        {:else}
          <div class="line line-error">{line.text}</div>
        {/if}
      {:else if line.kind === 'status'}
        <div class="line line-status">{line.text}</div>
      {/if}
    {/each}

    {#if waitingForInput}
      <div class="input-row">
        <span class="input-prefix">▸</span>
        <input
          class="console-input"
          bind:this={inputEl}
          bind:value={inputValue}
          onkeydown={handleInputKeydown}
          placeholder="Type input and press Enter…"
        />
      </div>
    {/if}
  </div>
</div>

<style>
  .console {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    border-top: 1px solid var(--border);
  }

  .console-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .console-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .status {
    font-size: 11px;
    font-weight: 500;
  }

  .status.running {
    color: var(--accent);
  }

  .console-output {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-sm) var(--space-md);
    font-family: var(--font-code);
    font-size: 13px;
    line-height: 1.6;
  }

  .console-empty {
    color: var(--text-muted);
    font-family: var(--font-ui);
    font-size: 13px;
    padding: var(--space-xl);
    text-align: center;
  }

  .line {
    padding: 1px 0;
    animation: fadeIn var(--duration-fast) var(--ease);
    text-align: left;
    width: 100%;
    display: block;
  }

  .line-output {
    color: var(--text);
    white-space: pre-wrap;
    word-break: break-all;
  }

  .line-input {
    color: var(--accent);
  }

  .line-error {
    color: var(--error);
  }

  .line-error.clickable {
    cursor: pointer;
    font-family: var(--font-code);
    font-size: 13px;
  }

  .line-error.clickable:hover {
    text-decoration: underline;
  }

  .line-status {
    color: var(--text-muted);
    font-size: 12px;
    margin-top: var(--space-sm);
  }

  .truncation-notice {
    font-style: italic;
    font-size: 11px;
    margin-top: 0;
    margin-bottom: var(--space-xs);
  }

  .input-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-top: var(--space-xs);
  }

  .input-prefix {
    color: var(--accent);
    flex-shrink: 0;
  }

  .console-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text);
    font-family: var(--font-code);
    font-size: 13px;
    caret-color: var(--accent);
  }

  .console-input::placeholder {
    color: var(--text-muted);
  }
</style>
