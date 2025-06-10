<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { theme, toggleTheme } from "$lib/themeStore";
  import { browser } from "$app/environment";

  let currentTheme = "light";
  
  if (browser) {
    theme.subscribe(value => {
      currentTheme = value;
    });
  }
  
  function handleToggle() {
    toggleTheme();
  }
</script>

<Button variant="ghost" size="icon" on:click={handleToggle} class="rounded-full hover:bg-accent transition-colors">
  {#if currentTheme === 'dark'}
    <span class="sr-only">Switch to light mode</span>
    <span class="text-lg" aria-hidden="true">🌙</span>
  {:else}
    <span class="sr-only">Switch to dark mode</span>
    <span class="text-lg" aria-hidden="true">☀️</span>  
  {/if}
</Button>
