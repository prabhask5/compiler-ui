<script>
  import '../app.css';
  import { updated } from '$app/stores';

  let { children } = $props();

  let dismissed = $state(false);
</script>

<div class="app">
  {@render children()}
</div>

{#if $updated && !dismissed}
  <div class="update-banner glass">
    <span>A new version of this page is available.</span>
    <div class="update-actions">
      <button class="update-btn reload" onclick={() => location.reload()}>Reload</button>
      <button class="update-btn dismiss" onclick={() => (dismissed = true)}>Dismiss</button>
    </div>
  </div>
{/if}

<style>
  .app {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .update-banner {
    position: fixed;
    bottom: var(--space-lg);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-sm) var(--space-md);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    font-size: 13px;
    color: var(--text-secondary);
    z-index: 1000;
    animation: fadeIn var(--duration) var(--ease);
    white-space: nowrap;
  }

  .update-actions {
    display: flex;
    gap: var(--space-xs);
  }

  .update-btn {
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: 500;
    transition:
      background var(--duration-fast) var(--ease),
      color var(--duration-fast) var(--ease);
  }

  .update-btn.reload {
    background: var(--accent);
    color: white;
  }

  .update-btn.reload:hover {
    background: var(--accent-hover);
  }

  .update-btn.dismiss {
    color: var(--text-muted);
  }

  .update-btn.dismiss:hover {
    background: var(--bg-hover);
    color: var(--text);
  }
</style>
