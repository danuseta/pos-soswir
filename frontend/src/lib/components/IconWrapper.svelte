<script lang="ts">
  import { browser } from '$app/environment';
  
  export let icon: any;
  export let className = ""; 
  export let size = 18;
</script>

{#if browser}
  <svelte:component this={icon} class={className} />
{:else}
  <div class={className} style={`width: ${size}px; height: ${size}px;`}></div>
{/if} 