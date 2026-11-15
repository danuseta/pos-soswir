<script lang="ts">
  import { ArrowUpDown, Package, Percent, Power, PowerOff, SortAsc, SortDesc, Users, UtensilsCrossed, Coffee, Truck } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import Pagination from '$lib/components/Pagination.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
  import { formatCurrency } from '$lib/utils/format';
  import { imageSrc } from '$lib/utils/product';

  export let products: any[] = [];
  export let totalItems = 0;
  export let currentPage = 1;
  export let itemsPerPage = 10;
  export let sortField = 'name';
  export let sortDirection = 'asc';
  export let hasFilters = false;
  export let onSort: (field: string) => void;
  export let onPageChange: (page: number) => void;
  export let onItemsPerPageChange: (items: number) => void;

  const columns = [
    ['name', 'Produk', '200px'],
    ['category_name', 'Kategori', '140px'],
    ['supplier_name', 'Supplier', '120px'],
    ['price', 'Harga', '120px'],
    ['stock', 'Stok', '100px']
  ];

  function categoryIcon(name = '') {
    const category = name.toLowerCase();
    if (category.includes('makanan')) return UtensilsCrossed;
    if (category.includes('minuman')) return Coffee;
    if (category.includes('pubj')) return Truck;
    return Package;
  }
</script>

<div class="bg-card rounded-lg shadow border border-border overflow-hidden">
  <ScrollArea class="h-[calc(100vh-350px)]" orientation="both">
    <div class="min-w-[1100px] p-0">
      <Table>
        <TableHeader>
          <TableRow>
            {#each columns as column}
              <TableHead
                class={`cursor-pointer ${column[0] === 'name' ? 'text-left' : 'text-center'}`}
                style={`width: ${column[2]}`}
                on:click={() => onSort(column[0])}
              >
                <div class={`flex items-center ${column[0] === 'name' ? 'justify-start' : 'justify-center'}`}>
                  {column[1]}
                  <IconWrapper
                    icon={sortField === column[0] ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown}
                    className="ml-2 h-4 w-4"
                  />
                </div>
              </TableHead>
            {/each}
            <TableHead class="w-[100px] text-center">Pajak</TableHead>
            <TableHead class="w-[100px] text-center">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {#each products as product (product.id)}
            <TableRow>
              <TableCell class="w-[200px] text-left">
                <div class="flex items-center justify-start">
                  {#if product.image_url}
                    <img src={imageSrc(product.image_url)} alt={product.name} class="w-10 h-10 object-cover rounded mr-2" />
                  {:else}
                    <div class="w-10 h-10 bg-muted rounded mr-2 flex items-center justify-center">
                      <IconWrapper icon={Package} className="h-5 w-5 text-muted-foreground" />
                    </div>
                  {/if}
                  <div class="min-w-0 text-left">
                    <div class="font-medium truncate text-sm">{product.name}</div>
                    {#if product.description}
                      <div class="text-xs text-muted-foreground truncate">{product.description}</div>
                    {/if}
                  </div>
                </div>
              </TableCell>
              <TableCell class="w-[140px] text-center">
                {#if product.category}
                  <span class="flex items-center justify-center">
                    <IconWrapper icon={categoryIcon(product.category.name)} className="h-4 w-4 mr-1 text-primary" />
                    {product.category.name}
                  </span>
                {:else}
                  <span class="text-gray-400">-</span>
                {/if}
              </TableCell>
              <TableCell class="w-[120px] text-center">
                {#if product.supplier}
                  <span class="flex items-center justify-center">
                    <IconWrapper icon={Users} className="h-4 w-4 mr-1 text-primary" />
                    {product.supplier.name}
                  </span>
                {:else}
                  <span class="text-muted-foreground">-</span>
                {/if}
              </TableCell>
              <TableCell class="w-[120px] text-center font-semibold text-primary">{formatCurrency(product.price)}</TableCell>
              <TableCell class="w-[100px] text-center">
                <Badge variant={product.stock > 0 ? 'default' : 'destructive'}>{product.stock}</Badge>
              </TableCell>
              <TableCell class="w-[100px] text-center">
                {#if product.tax_percentage > 0}
                  <span class="flex items-center justify-center text-primary">
                    <IconWrapper icon={Percent} className="h-4 w-4 mr-1" />
                    {product.tax_percentage}%
                  </span>
                {:else}
                  <span class="text-muted-foreground">-</span>
                {/if}
              </TableCell>
              <TableCell class="w-[100px] text-center">
                <div class="flex items-center justify-center">
                  <IconWrapper
                    icon={product.is_active ? Power : PowerOff}
                    className={`h-4 w-4 mr-1 ${product.is_active ? 'text-primary' : 'text-destructive'}`}
                  />
                  <span class={product.is_active ? 'text-primary' : 'text-destructive'}>
                    {product.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              </TableCell>
            </TableRow>
          {/each}
        </TableBody>
      </Table>
      {#if products.length === 0}
        <div class="text-center py-12">
          <IconWrapper icon={Package} className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 class="text-lg font-medium mb-2">Tidak ada produk</h3>
          <p class="text-muted-foreground">
            {hasFilters ? 'Tidak ada produk yang sesuai dengan filter Anda' : 'Belum ada produk yang ditambahkan'}
          </p>
        </div>
      {/if}
    </div>
  </ScrollArea>
  <Pagination {currentPage} {totalItems} {itemsPerPage} {onPageChange} {onItemsPerPageChange} />
</div>
