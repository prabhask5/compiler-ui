<script lang="ts">
  /**
   * Assembly output panel with syntax-colored x86-64 instructions.
   *
   * Displays annotated assembly organized by function, with source line
   * annotations and bidirectional highlighting. Clicking an instruction
   * highlights the corresponding source line in the editor and AST.
   */
  import type { AssemblyOutput } from '$lib/compiler/types';

  let {
    assembly,
    sourceLines,
    highlightedSourceLine,
    onInstructionClick
  }: {
    /** The disassembled assembly output from the compiler. */
    assembly: AssemblyOutput;
    /** Source code lines for inline annotations. */
    sourceLines: string[];
    /** Currently highlighted source line (1-based), or null. */
    highlightedSourceLine: number | null;
    /** Callback when user clicks an instruction with a source mapping. */
    onInstructionClick: (sourceLine: number) => void;
  } = $props();

  /**
   * Apply syntax coloring to an assembly instruction text.
   * Returns HTML with span elements for different token types.
   */
  function colorize(text: string): string {
    // Handle comments first (everything after ;)
    const commentIdx = text.indexOf(';');
    let mainPart = text;
    let commentPart = '';
    if (commentIdx >= 0) {
      mainPart = text.slice(0, commentIdx);
      commentPart = `<span class="asm-comment">${escapeHtml(text.slice(commentIdx))}</span>`;
    }

    // Colorize the main instruction
    const colored = mainPart
      // Hex numbers
      .replace(/\b0x[0-9a-fA-F]+\b/g, '<span class="asm-number">$&</span>')
      // Decimal numbers (standalone)
      .replace(/\b(\d+)\b/g, '<span class="asm-number">$1</span>')
      // Registers
      .replace(
        /\b(r[abcd]x|r[sb]p|r[sd]i|r[89]|r1[0-5]|e[abcd]x|e[sb]p|e[sd]i|[abcd]l|[abcd]h|[abcd]x|[sb]p|[sd]i|[sb]pl|[sd]il|r[89][dwb]|r1[0-5][dwb]|rip)\b/g,
        '<span class="asm-register">$&</span>'
      )
      // Memory operands brackets
      .replace(/(\[|\])/g, '<span class="asm-bracket">$1</span>');

    // Color the mnemonic (first word)
    const mnemonicMatch = colored.match(/^(\s*)(\S+)/);
    if (mnemonicMatch) {
      const [, leading, mnemonic] = mnemonicMatch;
      const rest = colored.slice(mnemonicMatch[0].length);
      return `${leading}<span class="asm-mnemonic">${mnemonic}</span>${rest}${commentPart}`;
    }

    return colored + commentPart;
  }

  function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** Filter out artificial (compiler-generated) functions for cleaner display. */
  const userFunctions = $derived(assembly.functions.filter((f) => !f.artificial));
</script>

<div class="asm-panel">
  <div class="asm-controls">
    <span class="asm-label">x86-64 Assembly (Linux ABI)</span>
    <span class="asm-count"
      >{userFunctions.length} function{userFunctions.length !== 1 ? 's' : ''}</span
    >
  </div>
  <div class="asm-content">
    {#each userFunctions as func (func.name)}
      <div class="asm-function">
        <div class="func-header">; ===== {func.name} =====</div>

        {#each func.instructions as instr, i (i)}
          {@const isHighlighted =
            highlightedSourceLine !== null && instr.sourceLine === highlightedSourceLine}
          {@const prevLine = i > 0 ? func.instructions[i - 1].sourceLine : null}
          {@const showSourceDivider = instr.sourceLine !== null && instr.sourceLine !== prevLine}

          {#if showSourceDivider && instr.sourceLine !== null}
            <div class="source-divider">
              ; --- line {instr.sourceLine}: {sourceLines[instr.sourceLine - 1]?.trim() ?? ''} ---
            </div>
          {/if}

          <button
            class="asm-line"
            class:highlighted={isHighlighted}
            class:clickable={instr.sourceLine !== null}
            onclick={() => instr.sourceLine !== null && onInstructionClick(instr.sourceLine)}
          >
            <span class="asm-offset">{instr.offset.toString(16).padStart(4, '0')}</span>
            <span class="asm-bytes">{instr.bytes}</span>
            <!-- eslint-disable-next-line svelte/no-at-html-tags -- colorize() output is safe (escapeHtml applied) -->
            <span class="asm-text">{@html colorize(instr.text)}</span>
          </button>
        {/each}
      </div>
    {/each}
  </div>
</div>

<style>
  .asm-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .asm-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .asm-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .asm-count {
    font-size: 10px;
    color: var(--text-muted);
  }

  .asm-content {
    flex: 1;
    overflow: auto;
    padding: var(--space-sm);
    font-family: var(--font-code);
    font-size: 12px;
    line-height: 1.5;
  }

  .asm-function {
    margin-bottom: var(--space-lg);
  }

  .func-header {
    color: var(--syn-comment);
    font-weight: 600;
    padding: var(--space-xs) 0;
    margin-bottom: var(--space-xs);
  }

  .source-divider {
    color: var(--syn-comment);
    font-size: 11px;
    padding: var(--space-xs) 0;
    margin-top: var(--space-xs);
    opacity: 0.7;
  }

  .asm-line {
    display: flex;
    gap: 8px;
    padding: 1px 4px;
    border-radius: var(--radius-sm);
    width: 100%;
    text-align: left;
    transition: background var(--duration-fast) var(--ease);
  }

  .asm-line.clickable {
    cursor: pointer;
  }

  .asm-line.clickable:hover {
    background: var(--bg-hover);
  }

  .asm-line.highlighted {
    background: rgba(99, 102, 241, 0.12);
    box-shadow: inset 2px 0 0 var(--accent);
  }

  .asm-offset {
    color: var(--text-muted);
    min-width: 36px;
    flex-shrink: 0;
    font-size: 10px;
    opacity: 0.6;
  }

  .asm-bytes {
    color: var(--text-muted);
    min-width: 120px;
    flex-shrink: 0;
    font-size: 10px;
    opacity: 0.5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .asm-text {
    flex: 1;
    white-space: nowrap;
  }

  .asm-text :global(.asm-mnemonic) {
    color: var(--syn-keyword);
    font-weight: 500;
  }

  .asm-text :global(.asm-register) {
    color: var(--syn-variable);
  }

  .asm-text :global(.asm-number) {
    color: var(--syn-number);
  }

  .asm-text :global(.asm-comment) {
    color: var(--syn-comment);
  }

  .asm-text :global(.asm-bracket) {
    color: var(--text-muted);
  }
</style>
