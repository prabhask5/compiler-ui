<script lang="ts">
  /**
   * Compact control bar for step-through execution mode.
   *
   * Rendered above the Console when step mode is active, providing
   * Stop, Step Forward, Play/Pause controls, a speed slider, and
   * step info display.
   */
  let {
    isPlaying,
    stepNumber,
    callDepth,
    currentFunction,
    speed = $bindable(1),
    onPlay,
    onPause,
    onStepForward,
    onStop
  }: {
    /** Whether auto-play is currently active. */
    isPlaying: boolean;
    /** Current step number. */
    stepNumber: number;
    /** Current function call nesting depth. */
    callDepth: number;
    /** Name of the currently executing function, or null for top-level. */
    currentFunction: string | null;
    /** Playback speed multiplier (bindable). */
    speed: number;
    onPlay: () => void;
    onPause: () => void;
    onStepForward: () => void;
    onStop: () => void;
  } = $props();
</script>

<div class="step-controls">
  <div class="controls-left">
    <button class="ctrl-btn stop" onclick={onStop} title="Stop (Escape)">
      <span class="ctrl-icon">&#9632;</span> Stop
    </button>
    <button
      class="ctrl-btn step-fwd"
      onclick={onStepForward}
      disabled={isPlaying}
      title="Step Forward (F10)"
    >
      <span class="ctrl-icon">&#9654;</span> Step
    </button>
    {#if isPlaying}
      <button class="ctrl-btn pause" onclick={onPause} title="Pause">
        <span class="ctrl-icon">&#9646;&#9646;</span> Pause
      </button>
    {:else}
      <button class="ctrl-btn play" onclick={onPlay} title="Auto-play">
        <span class="ctrl-icon">&#9654;&#9654;</span> Play
      </button>
    {/if}
  </div>

  <div class="controls-center">
    <label class="speed-label">
      <span class="speed-text">{speed < 1 ? speed.toFixed(2) : speed.toFixed(1)}x</span>
      <input type="range" min="0.25" max="4" step="0.25" bind:value={speed} class="speed-slider" />
    </label>
  </div>

  <div class="controls-right">
    <span class="step-info">
      Step {stepNumber}
      {#if currentFunction}
        &middot; {currentFunction}()
      {/if}
      {#if callDepth > 0}
        &middot; depth {callDepth}
      {/if}
    </span>
  </div>
</div>

<style>
  .step-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 36px;
    padding: 0 var(--space-md);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    gap: var(--space-sm);
    font-family: var(--font-code);
    font-size: 11px;
  }

  .controls-left {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .controls-center {
    display: flex;
    align-items: center;
  }

  .controls-right {
    display: flex;
    align-items: center;
  }

  .ctrl-btn {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 3px 8px;
    border-radius: var(--radius-sm);
    font-size: 11px;
    font-family: var(--font-code);
    color: var(--text-secondary);
    transition:
      background var(--duration-fast) var(--ease),
      color var(--duration-fast) var(--ease);
  }

  .ctrl-btn:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text);
  }

  .ctrl-btn.stop:hover:not(:disabled) {
    color: var(--error);
  }

  .ctrl-btn.play:hover:not(:disabled),
  .ctrl-btn.step-fwd:hover:not(:disabled) {
    color: var(--success);
  }

  .ctrl-btn.pause:hover:not(:disabled) {
    color: var(--warning);
  }

  .ctrl-icon {
    font-size: 9px;
  }

  .speed-label {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    color: var(--text-muted);
  }

  .speed-text {
    min-width: 30px;
    text-align: right;
  }

  .speed-slider {
    width: 80px;
    height: 4px;
    appearance: none;
    -webkit-appearance: none;
    background: var(--bg-hover);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }

  .speed-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--text-secondary);
    cursor: pointer;
  }

  .speed-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--text-secondary);
    border: none;
    cursor: pointer;
  }

  .step-info {
    color: var(--text-muted);
    white-space: nowrap;
  }

  @media (max-width: 767px) {
    .step-controls {
      height: auto;
      min-height: 36px;
      flex-wrap: wrap;
      padding: var(--space-xs) var(--space-sm);
      gap: var(--space-xs);
    }

    .controls-center {
      display: none;
    }

    .controls-right {
      flex: 1;
      justify-content: flex-end;
      min-width: 0;
    }

    .step-info {
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 10px;
    }

    .ctrl-btn {
      padding: 3px 6px;
      font-size: 10px;
    }
  }
</style>
