<script lang="ts">
  import { getContext } from "svelte";
  import { cn } from "$lib/utils";
  import type { Writable } from "svelte/store";

  export let className: string = '';

  const context = getContext('tabs') as { 
    activeTab: Writable<string>; 
    orientation: 'horizontal' | 'vertical' 
  } || { activeTab: null, orientation: 'horizontal' };
  
  const { orientation } = context;
</script>

<div 
  class={cn(
    "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
    orientation === 'vertical' ? 'flex-col h-auto' : '',
    className
  )}
  role="tablist"
  aria-orientation={orientation}
>
  <slot />
</div> 