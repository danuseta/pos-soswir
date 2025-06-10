<script lang="ts">
  import { getContext } from "svelte";
  import { cn } from "$lib/utils";
  import type { Writable } from "svelte/store";

  export let value: string;
  export let className: string = '';
  export let disabled: boolean = false;

  const context = getContext('tabs') as { 
    activeTab: Writable<string>; 
    orientation: 'horizontal' | 'vertical' 
  } || { activeTab: null, orientation: 'horizontal' };
  
  const { activeTab, orientation } = context;

  function handleClick() {
    if (!disabled && activeTab) {
      activeTab.set(value);
    }
  }

  $: isActive = $activeTab === value;
</script>

<button
  type="button"
  role="tab"
  aria-selected={isActive}
  data-state={isActive ? 'active' : 'inactive'}
  {disabled}
  class={cn(
    "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    isActive ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
    orientation === 'vertical' ? 'w-full justify-start' : '',
    className
  )}
  on:click={handleClick}
>
  <slot />
</button> 