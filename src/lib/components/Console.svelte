<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { InterpreterOutput } from '$lib/interpreter/interpreter';

  let {
    output,
    isRunning,
    waitingForInput,
    submitInput,
    onErrorClick
  }: {
    output: InterpreterOutput[];
    isRunning: boolean;
    waitingForInput: boolean;
    submitInput: (value: string) => void;
    onErrorClick: (loc: [number, number, number, number]) => void;
  } = $props();

  let scrollEl: HTMLDivElement = $state(null!);
  let inputEl: HTMLInputElement = $state(null!);
  let inputValue = $state('');

  // Auto-scroll on new output
  $effect(() => {
    if (output.length > 0) {
      tick().then(() => {
        if (scrollEl) {
          scrollEl.scrollTop = scrollEl.scrollHeight;
        }
      });
    }
  });

  // Focus input when waiting
  $effect(() => {
    if (waitingForInput && inputEl) {
      tick().then(() => inputEl?.focus());
    }
  });

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

    {#each output as line}
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
