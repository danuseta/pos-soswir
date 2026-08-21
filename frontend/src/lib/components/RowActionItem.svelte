<script lang="ts">
  import { getContext, createEventDispatcher } from "svelte";
  import IconWrapper from "./IconWrapper.svelte";

  export let icon = null;
  export let label = "";
  export let danger = false;

  const { close } = getContext<{ close: () => void }>("row-actions");
  const dispatch = createEventDispatcher();

  function handleClick() {
    close();
    dispatch("click");
  }
</script>

<button
  type="button"
  role="menuitem"
  on:click={handleClick}
  class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent {danger
    ? 'text-destructive'
    : 'text-popover-foreground'}"
>
  {#if icon}
    <IconWrapper {icon} className="h-4 w-4" />
  {/if}
  {label}
</button>
