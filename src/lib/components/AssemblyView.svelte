<script lang="ts">
  // Assembly view — placeholder until codegen is wired through WASM
</script>

<div class="assembly-view">
  <div class="assembly-placeholder">
    <div class="placeholder-icon">⚙</div>
    <p class="placeholder-title">Assembly generation requires native compilation</p>
    <p class="placeholder-desc">
      The ChocoPy compiler generates x86-64 machine code, which cannot be produced in the browser.
      Use the AST views to explore the program structure, or the Run tab to execute programs.
    </p>
  </div>
</div>

<style>
  .assembly-view {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: var(--space-2xl);
  }

  .assembly-placeholder {
    text-align: center;
    max-width: 400px;
  }

  .placeholder-icon {
    font-size: 32px;
    margin-bottom: var(--space-md);
    opacity: 0.4;
  }

  .placeholder-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: var(--space-sm);
  }

  .placeholder-desc {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.6;
  }
</style>
