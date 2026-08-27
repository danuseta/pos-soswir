<script lang="ts">
  import { ArrowUpDown, Coffee, Package, SortAsc, SortDesc, Truck, User, UtensilsCrossed } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import Pagination from '$lib/components/Pagination.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
  import { formatCurrency, formatDateTime } from '$lib/utils/format';

  export let transactions: any[] = [];
  export let totalItems = 0;
  export let allTransactionsCount = 0;
  export let currentPage = 1;
  export let itemsPerPage = 10;
  export let sortField = 'waktu';
  export let sortDirection = 'desc';
  export let showProfit = false;
  export let onSort: (field: string) => void;
  export let onPageChange: (page: number) => void;
  export let onItemsPerPageChange: (items: number) => void;

  const sortableColumns = [
    ['waktu', 'Waktu', 'w-[160px]'],
    ['produk', 'Produk', 'w-[140px]'],
    ['kategori', 'Kategori', 'w-[120px]']
  ];
  const trailingColumns = [
    ['total', 'Total', 'w-[120px]'],
    ['kasir', 'Kasir', 'w-[100px]'],
    ['payment_method', 'Metode Pembayaran', 'w-[100px]']
  ];

  function categoryIcon(name = '') {
    const category = name.toLowerCase();
    if (category === 'makanan') return UtensilsCrossed;
    if (category === 'minuman') return Coffee;
    if (category === 'pubj') return Truck;
    return Package;
  }
</script>

<div class="bg-card rounded-lg shadow border border-border overflow-hidden">
  <ScrollArea class="h-[calc(100vh-370px)]" orientation="both">
    <div class={showProfit ? 'min-w-[1400px]' : 'min-w-[1100px]'}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-[60px] text-center">No.</TableHead>
            {#each sortableColumns as column}
              <TableHead class={`cursor-pointer ${column[2]} ${column[0] === 'produk' ? 'text-left' : 'text-center'}`} on:click={() => onSort(column[0])}>
                <div class={`flex items-center ${column[0] === 'produk' ? 'justify-start' : 'justify-center'}`}>
                  {column[1]}
                  <IconWrapper
                    icon={sortField === column[0] ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown}
                    className="ml-2 h-4 w-4"
                  />
                </div>
              </TableHead>
            {/each}
            <TableHead class="w-[80px] text-center">Jumlah</TableHead>
            <TableHead class="w-[110px] text-center">Harga</TableHead>
            {#each trailingColumns as column}
              <TableHead class={`cursor-pointer ${column[2]} text-center`} on:click={() => onSort(column[0])}>
                <div class="flex items-center justify-center">
                  {column[1]}
                  <IconWrapper
                    icon={sortField === column[0] ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown}
                    className="ml-2 h-4 w-4"
                  />
                </div>
              </TableHead>
            {/each}
            {#if showProfit}
              <TableHead class="w-[110px] text-center">Keuntungan Toko</TableHead>
              <TableHead class="w-[120px] text-center">Keuntungan Supplier</TableHead>
            {/if}
          </TableRow>
        </TableHeader>
        <TableBody>
          {#each transactions as transaction, index (transaction.id)}
            <TableRow>
              <TableCell class="text-center font-medium">
                {(currentPage - 1) * itemsPerPage + index + 1}
              </TableCell>
              <TableCell class="w-[160px] text-center text-xs font-medium">
                {formatDateTime(transaction.waktu)}
              </TableCell>
              <TableCell class="w-[140px] text-left font-medium truncate" title={transaction.produk}>
                {transaction.produk}
              </TableCell>
              <TableCell class="w-[120px] text-center">
                <div class="flex items-center gap-2 justify-center">
                  <IconWrapper icon={categoryIcon(transaction.kategori)} className="h-4 w-4 text-primary" />
                  <span class="text-sm font-medium">{transaction.kategori}</span>
                </div>
              </TableCell>
              <TableCell class="w-[80px] text-center font-medium">{transaction.jumlah}</TableCell>
              <TableCell class="w-[110px] text-center font-mono text-sm">{formatCurrency(transaction.harga)}</TableCell>
              <TableCell class="w-[120px] text-center font-mono text-sm font-semibold">{formatCurrency(transaction.total)}</TableCell>
              <TableCell class="w-[100px] text-center">
                <div class="flex items-center justify-center gap-1">
                  <div class="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                    <IconWrapper icon={User} className="h-3 w-3 text-primary" />
                  </div>
                  <span class="text-sm font-medium truncate">{transaction.kasir}</span>
                </div>
              </TableCell>
              <TableCell class="w-[100px] text-center">
                <Badge variant="outline" class="text-xs">{transaction.payment_method || 'Cash'}</Badge>
              </TableCell>
              {#if showProfit}
                <TableCell class="w-[110px] text-center font-mono text-sm text-primary">
                  {formatCurrency(transaction.keuntungan_toko || 0)}
                </TableCell>
                <TableCell class="w-[120px] text-center font-mono text-sm">
                  {transaction.is_reseller && transaction.keuntungan_supplier > 0
                    ? formatCurrency(transaction.keuntungan_supplier)
                    : '-'}
                </TableCell>
              {/if}
            </TableRow>
          {/each}
          {#if transactions.length === 0}
            <TableRow>
              <TableCell colspan={showProfit ? 11 : 9} class="h-24 text-center">
                {allTransactionsCount > 0
                  ? 'Tidak ada transaksi yang sesuai dengan filter.'
                  : 'Belum ada transaksi yang tersedia.'}
              </TableCell>
            </TableRow>
          {/if}
        </TableBody>
      </Table>
    </div>
  </ScrollArea>
  <Pagination {currentPage} {totalItems} {itemsPerPage} {onPageChange} {onItemsPerPageChange} />
</div>
