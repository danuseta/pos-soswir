<script lang="ts">
  import { ArrowUpDown, Coffee, Edit, Image as ImageIcon, Package, Percent, PlusCircle, Power, PowerOff, SortAsc, SortDesc, Trash2, Truck, UtensilsCrossed } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import Pagination from '$lib/components/Pagination.svelte';
  import RowActions from '$lib/components/RowActions.svelte';
  import RowActionItem from '$lib/components/RowActionItem.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
  import { formatCurrency } from '$lib/utils/format';
  import { imageSrc } from '$lib/utils/product';

  export let products: any[] = [];
  export let totalItems = 0;
  export let allProductsCount = 0;
  export let currentPage = 1;
  export let itemsPerPage = 10;
  export let sortField = 'name';
  export let sortDirection = 'asc';
  export let onSort: (field: string) => void;
  export let onPageChange: (page: number) => void;
  export let onItemsPerPageChange: (items: number) => void;
  export let onAddStock: (product: any) => void;
  export let onEdit: (product: any) => void;
  export let onToggle: (product: any) => void;
  export let onDelete: (product: any) => void;

  function categoryIcon(name = '') {
    const category = name.toLowerCase();
    if (category === 'makanan') return UtensilsCrossed;
    if (category === 'minuman') return Coffee;
    if (category === 'pubj') return Truck;
    return Package;
  }
</script>

<div class="bg-card rounded-lg shadow border border-border overflow-hidden">
  <ScrollArea class="h-[calc(100vh-400px)]" orientation="both">
    <div class="min-w-[1000px] p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-[60px] text-center">No.</TableHead>
            <TableHead class="w-[200px] text-left">Produk</TableHead>
            <TableHead class="w-[120px] text-center">Kategori</TableHead>
            <TableHead class="w-[120px] text-center">Supplier</TableHead>
            {#each [['price', 'Harga', 'w-[100px]'], ['stock', 'Stok', 'w-[80px]']] as column}
              <TableHead class={`text-center cursor-pointer ${column[2]}`} on:click={() => onSort(column[0])}>
                <div class="flex items-center justify-center">
                  {column[1]}
                  <IconWrapper
                    icon={sortField === column[0] ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown}
                    className="ml-2 h-4 w-4"
                  />
                </div>
              </TableHead>
            {/each}
            <TableHead class="text-center w-[100px]">Fee/Pajak</TableHead>
            <TableHead class="text-center w-[80px]">Status</TableHead>
            <TableHead class="text-center w-[120px]">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {#each products as product, index (product.id)}
            <TableRow>
              <TableCell class="font-medium text-center">{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
              <TableCell class="w-[200px] text-left">
                <div class="flex items-center justify-start gap-2">
                  {#if product.image_url}
                    <img src={imageSrc(product.image_url)} alt={product.name} class="w-8 h-8 object-cover rounded-lg" />
                  {:else}
                    <div class="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                      <IconWrapper icon={ImageIcon} className="h-4 w-4 text-muted-foreground" />
                    </div>
                  {/if}
                  <div class="min-w-0 flex-1 text-left">
                    <p class="font-medium truncate text-sm">{product.name}</p>
                    {#if product.description}<p class="text-xs text-muted-foreground truncate">{product.description}</p>{/if}
                  </div>
                </div>
              </TableCell>
              <TableCell class="w-[120px] text-center">
                {#if product.category}
                  <div class="flex items-center gap-2 justify-center">
                    <IconWrapper icon={categoryIcon(product.category.name)} className="h-4 w-4 text-primary" />
                    <span class="text-sm font-medium">{product.category.name}</span>
                  </div>
                {:else}<span class="text-muted-foreground">-</span>{/if}
              </TableCell>
              <TableCell class="w-[120px] text-center">
                {#if product.supplier}
                  <div class="text-sm">
                    <p class="font-medium truncate">{product.supplier.name}</p>
                    {#if product.supplier.phone}<p class="text-muted-foreground text-xs truncate">{product.supplier.phone}</p>{/if}
                  </div>
                {:else}<span class="text-muted-foreground">-</span>{/if}
              </TableCell>
              <TableCell class="text-center"><span class="font-medium text-sm">{formatCurrency(product.price)}</span></TableCell>
              <TableCell class="text-center">
                <div class="flex flex-col items-center gap-1">
                  <span class={`font-medium text-sm ${product.stock <= 0 ? 'text-destructive' : 'text-primary'}`}>{product.stock}</span>
                  {#if product.stock <= 0}
                    <Badge variant="destructive" class="text-xs">Habis</Badge>
                  {:else if product.stock <= 10}
                    <Badge variant="outline" class="text-xs text-primary border-border">Rendah</Badge>
                  {/if}
                </div>
              </TableCell>
              <TableCell class="text-center">
                {#if product.tax_percentage > 0}
                  <div class="flex flex-col items-center gap-1">
                    <Badge variant="outline" class="text-primary border-border text-xs">
                      <IconWrapper icon={Percent} className="mr-1 h-3 w-3" />{product.tax_percentage}%
                    </Badge>
                    {#if product.tax_description}<p class="text-xs text-muted-foreground text-center truncate">{product.tax_description}</p>{/if}
                  </div>
                {:else}<span class="text-muted-foreground">-</span>{/if}
              </TableCell>
              <TableCell class="text-center">
                <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${product.is_active ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                  {product.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
              </TableCell>
              <TableCell class="text-center">
                <RowActions>
                  {#if !product.category?.is_reseller}<RowActionItem icon={PlusCircle} label="Tambah Stok" on:click={() => onAddStock(product)} />{/if}
                  <RowActionItem icon={Edit} label="Edit" on:click={() => onEdit(product)} />
                  <RowActionItem icon={product.is_active ? PowerOff : Power} label={product.is_active ? 'Nonaktifkan' : 'Aktifkan'} danger={product.is_active} on:click={() => onToggle(product)} />
                  <RowActionItem icon={Trash2} label="Hapus permanen" danger on:click={() => onDelete(product)} />
                </RowActions>
              </TableCell>
            </TableRow>
          {/each}
          {#if products.length === 0}
            <TableRow><TableCell colspan={9} class="h-24 text-center">{totalItems === 0 && allProductsCount > 0 ? 'Tidak ada produk yang sesuai dengan filter.' : 'Belum ada produk yang tersedia.'}</TableCell></TableRow>
          {/if}
        </TableBody>
      </Table>
    </div>
  </ScrollArea>
  <Pagination {currentPage} {totalItems} {itemsPerPage} {onPageChange} {onItemsPerPageChange} />
</div>
