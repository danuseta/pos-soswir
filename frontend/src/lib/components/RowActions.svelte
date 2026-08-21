<script lang="ts">
  import { setContext } from "svelte";
  import { MoreHorizontal } from "lucide-svelte";
  import IconWrapper from "./IconWrapper.svelte";

  let open = false;
  let trigger: HTMLButtonElement;
  let menu: HTMLElement;
  let menuStyle = "";

  function close() {
    open = false;
  }

  setContext("row-actions", { close });

  function toggle() {
    if (open) {
      close();
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const ruangBawah = window.innerHeight - rect.bottom;
    const kananDariTepi = window.innerWidth - rect.right;

    menuStyle =
      ruangBawah < 220
        ? `position: fixed; bottom: ${window.innerHeight - rect.top + 4}px; right: ${kananDariTepi}px;`
        : `position: fixed; top: ${rect.bottom + 4}px; right: ${kananDariTepi}px;`;

    open = true;
  }

  function handleDocumentClick(event: Event) {
    const target = event.target as Node;
    if (trigger?.contains(target) || menu?.contains(target)) return;
    close();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") close();
  }
</script>

<svelte:document on:click={handleDocumentClick} on:keydown={handleKeydown} on:scroll|capture={close} />
<svelte:window on:resize={close} />

<button
  type="button"
  bind:this={trigger}
  aria-label="Aksi"
  aria-haspopup="menu"
  aria-expanded={open}
  on:click={toggle}
  class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
>
  <IconWrapper icon={MoreHorizontal} className="h-4 w-4" />
</button>

{#if open}
  <div
    bind:this={menu}
    role="menu"
    tabindex="-1"
    style={menuStyle}
    class="z-50 w-48 rounded-md border border-border bg-popover py-1 shadow-lg"
  >
    <slot />
  </div>
{/if}
