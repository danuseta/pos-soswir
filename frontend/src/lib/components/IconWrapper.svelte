<script lang="ts">
  import { onMount } from 'svelte';

  export let icon: any;
  export let className = "";
  export let size = 18;

  let mounted = false;

  onMount(() => {
    mounted = true;
  });
</script>

{#if mounted && icon}
  <svelte:component this={icon} class={className} {size} />
{:else}
  <span
    aria-hidden="true"
    class={className}
    style={`display: inline-block; width: ${size}px; height: ${size}px;`}
  ></span>
{/if}
