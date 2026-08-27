<script lang="ts">
  import { ChevronDown, ChevronUp, Clock, CreditCard, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Button } from '$lib/components/ui/button';
  import { formatCurrency } from '$lib/utils/format';

  export let cart: any[] = [];
  export let debugProducts: any[] = [];
  export let total = 0;
  export let isProcessing = false;
  export let mobileOpen = false;
  export let onToggle: () => void;
  export let onUpdate: (productId: number, quantity: number) => void;
  export let onCheckout: () => void;
  export let onClear: () => void;
</script>

<div class="xl:w-80 2xl:w-96 xl:border-l border-border bg-card flex flex-col">
  <div class="xl:hidden border-t border-border p-3 sm:p-4">
    <Button on:click={onToggle} class="w-full flex items-center justify-between h-11 sm:h-12 xl:h-10 text-base xl:text-base" variant="outline">
      <span class="font-medium">Keranjang ({cart.length})</span><div class="flex items-center gap-3"><span class="font-bold text-primary">{formatCurrency(total)}</span><IconWrapper icon={mobileOpen ? ChevronDown : ChevronUp} className="h-4 w-4 sm:h-5 sm:w-5 xl:h-4 xl:w-4" /></div>
    </Button>
  </div>
  <div class={`flex-1 flex flex-col ${mobileOpen ? 'block' : 'hidden xl:flex'}`}>
    <div class="p-3 sm:p-4 xl:p-6 border-b border-border"><h3 class="text-lg xl:text-lg font-semibold">Keranjang Belanja</h3><p class="text-xs xl:text-xs text-muted-foreground mt-1">Total Items: {cart.length}</p><p class="text-xs xl:text-xs text-muted-foreground mt-1">Total Amount: {formatCurrency(total)}</p></div>
    <div class="flex-1 overflow-y-auto p-3 sm:p-4 xl:p-6">
      {#if cart.length === 0}
        <div class="text-center text-muted-foreground mt-8"><IconWrapper icon={ShoppingCart} className="h-12 w-12 xl:h-12 xl:w-12 mx-auto mb-4 opacity-50" /><p class="text-base xl:text-base">Keranjang kosong</p><Button on:click={() => console.log('Debug - Products:', debugProducts, 'Cart:', cart)} variant="outline" size="sm" class="mt-2 text-sm xl:text-sm h-8 xl:h-8">Debug Info</Button></div>
      {:else}
        <div class="space-y-3 sm:space-y-4 xl:space-y-4">{#each cart as item}<div class="flex items-center gap-3 sm:gap-4 xl:gap-3 p-3 sm:p-4 xl:p-3 border rounded-lg"><div class="flex-1 min-w-0"><h4 class="font-medium text-sm xl:text-sm truncate">{item.name}</h4><p class="text-sm xl:text-sm text-muted-foreground">{formatCurrency(item.price)}</p></div><div class="flex items-center gap-2 sm:gap-3 xl:gap-2"><Button size="sm" variant="outline" on:click={() => onUpdate(item.id, item.quantity - 1)} class="h-8 w-8 sm:h-9 sm:w-9 xl:h-8 xl:w-8 p-0"><IconWrapper icon={Minus} className="h-3 w-3 sm:h-4 sm:w-4 xl:h-3 xl:w-3" /></Button><span class="w-8 text-center text-sm xl:text-sm font-medium">{item.quantity}</span><Button size="sm" variant="outline" on:click={() => onUpdate(item.id, item.quantity + 1)} class="h-8 w-8 sm:h-9 sm:w-9 xl:h-8 xl:w-8 p-0"><IconWrapper icon={Plus} className="h-3 w-3 sm:h-4 sm:w-4 xl:h-3 xl:w-3" /></Button></div></div>{/each}</div>
      {/if}
    </div>
    {#if cart.length > 0}<div class="border-t border-border p-3 sm:p-4 xl:p-6 space-y-3 sm:space-y-4 xl:space-y-4"><div class="flex justify-between items-center"><span class="text-lg xl:text-lg font-semibold">Total:</span><span class="text-xl xl:text-xl font-bold text-primary">{formatCurrency(total)}</span></div><div class="space-y-2 sm:space-y-3 xl:space-y-2"><Button on:click={onCheckout} disabled={isProcessing || cart.length === 0} class="w-full h-11 sm:h-12 xl:h-10 text-base xl:text-base font-medium">{#if isProcessing}<IconWrapper icon={Clock} className="mr-2 h-4 w-4 xl:h-4 xl:w-4 animate-spin" />Memproses...{:else}<IconWrapper icon={CreditCard} className="mr-2 h-4 w-4 xl:h-4 xl:w-4" />Checkout{/if}</Button><Button on:click={onClear} variant="outline" class="w-full h-9 sm:h-10 xl:h-8 text-sm xl:text-sm"><IconWrapper icon={Trash2} className="mr-2 h-3 w-3 xl:h-3 xl:w-3" />Kosongkan Keranjang</Button></div></div>{/if}
  </div>
</div>
