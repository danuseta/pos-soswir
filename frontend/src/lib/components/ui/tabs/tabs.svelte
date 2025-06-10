<script lang="ts">
  import { setContext } from "svelte";
  import { writable } from "svelte/store";

  export let value: string;
  export let orientation: 'horizontal' | 'vertical' = 'horizontal';

  const activeTab = writable(value);
  
  $: activeTab.set(value);

  setContext('tabs', {
    activeTab,
    orientation
  });
</script>

<div 
  class="w-full"
  data-orientation={orientation}
>
  <slot />
</div> 