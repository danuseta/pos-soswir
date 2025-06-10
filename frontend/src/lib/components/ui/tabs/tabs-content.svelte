<script lang="ts">
  import { getContext } from "svelte";
  import { cn } from "$lib/utils";
  import type { Writable } from "svelte/store";

  export let value: string;
  export let className: string = '';

  const context = getContext('tabs') as { 
    activeTab: Writable<string>; 
    orientation: 'horizontal' | 'vertical' 
  } || { activeTab: null, orientation: 'horizontal' };
  
  const { activeTab } = context;

  $: isActive = $activeTab === value;
</script>

{#if isActive}
  <div
    role="tabpanel"
    data-state={isActive ? 'active' : 'inactive'}
    class={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
  >
    <slot />
  </div>
{/if} 