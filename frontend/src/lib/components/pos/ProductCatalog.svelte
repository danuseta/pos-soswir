<script lang="ts">
  import { Package } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Card, CardContent } from '$lib/components/ui/card';
  import { formatCurrency } from '$lib/utils/format';

  export let products: any[] = [];
  export let isLoading = false;
  export let onAdd: (product: any) => void;

  function addFromButton(event: MouseEvent, product: any) {
    event.stopPropagation();
    onAdd(product);
  }
</script>

{#if isLoading}
  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 xl:gap-4">
    {#each Array(10) as _}<Card class="overflow-hidden"><div class="animate-pulse"><div class="h-32 sm:h-36 md:h-38 xl:h-40 bg-muted"></div><CardContent class="p-2 sm:p-3 xl:p-4"><div class="h-4 bg-muted rounded mb-2"></div><div class="h-3 bg-muted rounded w-2/3"></div></CardContent></div></Card>{/each}
  </div>
{:else}
  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 xl:gap-4">
    {#each products as product}
      <Card class={`overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] ${product.stock <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`} on:click={() => onAdd(product)}>
        <div class="relative">
          {#if product.image_url}<img src={product.image_url} alt={product.name} class="w-full h-32 sm:h-36 md:h-38 xl:h-40 object-cover" />{:else}<div class="w-full h-32 sm:h-36 md:h-38 xl:h-40 bg-muted flex items-center justify-center"><IconWrapper icon={Package} className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 xl:h-12 xl:w-12 text-muted-foreground" /></div>{/if}
          {#if product.stock <= 0}<div class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center"><span class="text-white font-medium text-xs sm:text-sm xl:text-sm">Stok Habis</span></div>{:else if product.stock <= 5}<div class="absolute top-2 right-2 bg-primary text-white text-xs px-2 py-1 rounded">Stok: {product.stock}</div>{/if}
        </div>
        <CardContent class="p-2 sm:p-3 xl:p-4">
          <h3 class="font-medium text-sm sm:text-sm md:text-base xl:text-base line-clamp-2 mb-1 sm:mb-2 xl:mb-2">{product.name}</h3>
          <p class="text-primary font-bold text-sm sm:text-base md:text-lg xl:text-lg">{formatCurrency(product.price)}</p>
          <p class="text-xs sm:text-xs md:text-sm xl:text-sm text-muted-foreground mb-2">Stok: {product.stock}</p>
          <button class="w-full mt-2 text-xs sm:text-sm md:text-sm xl:text-sm px-3 py-2 sm:py-3 md:py-3 xl:py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed transition-colors font-medium" disabled={product.stock <= 0} on:click={(event) => addFromButton(event, product)}>{product.stock <= 0 ? 'Stok Habis' : 'Tambah ke Keranjang'}</button>
        </CardContent>
      </Card>
    {/each}
  </div>
  {#if products.length === 0}<div class="text-center py-12"><IconWrapper icon={Package} className="h-16 w-16 xl:h-16 xl:w-16 mx-auto mb-4 text-muted-foreground" /><p class="text-muted-foreground text-lg xl:text-lg">Tidak ada produk ditemukan</p></div>{/if}
{/if}

<style>
  .line-clamp-2 { display: -webkit-box; line-clamp: 2; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
</style>
