<script lang="ts">
  import { ArrowUpDown, Calendar, CheckCircle, DollarSign, Edit, Package, SortAsc, SortDesc, Users, XCircle } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import Pagination from '$lib/components/Pagination.svelte';
  import RowActions from '$lib/components/RowActions.svelte';
  import RowActionItem from '$lib/components/RowActionItem.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
  import { formatCurrency } from '$lib/utils/format';

  export let entries: any[] = [];
  export let totalItems = 0;
  export let allEntriesCount = 0;
  export let currentPage = 1;
  export let itemsPerPage = 10;
  export let sortField = 'entry_date';
  export let sortDirection = 'desc';
  export let userRole = '';
  export let onSort: (field: string) => void;
  export let onPageChange: (page: number) => void;
  export let onItemsPerPageChange: (items: number) => void;
  export let onEdit: (entry: any) => void;
  export let onComplete: (entry: any) => void;
  export let onMarkPaid: (entry: any) => void;

  const sortableColumns = [
    ['entry_date', 'Tanggal', 'w-[110px]'],
    ['product_name', 'Produk', 'w-[180px]'],
    ['supplier_name', 'Supplier', 'w-[140px]']
  ];
</script>

<div class="bg-card rounded-lg shadow border border-border overflow-hidden">
  <ScrollArea class="h-[calc(100vh-400px)]" orientation="both">
    <div class="min-w-[1200px] p-0">
      <Table>
        <TableHeader>
          <TableRow>
            {#each sortableColumns as column}
              <TableHead class={`cursor-pointer ${column[2]} ${column[0] === 'product_name' ? 'text-left' : 'text-center'}`} on:click={() => onSort(column[0])}>
                <div class={`flex items-center ${column[0] === 'product_name' ? 'justify-start' : 'justify-center'}`}>{column[1]}<IconWrapper icon={sortField === column[0] ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} className="ml-2 h-4 w-4" /></div>
              </TableHead>
            {/each}
            <TableHead class="text-center w-[100px]">Stok Masuk</TableHead><TableHead class="text-center w-[80px]">Terjual</TableHead><TableHead class="text-center w-[80px]">Sisa</TableHead><TableHead class="text-center w-[120px]">Harga</TableHead><TableHead class="text-center w-[120px]">Pendapatan</TableHead>
            <TableHead class="text-center cursor-pointer w-[100px]" on:click={() => onSort('status')}><div class="flex items-center justify-center">Status<IconWrapper icon={sortField === 'status' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} className="ml-2 h-4 w-4" /></div></TableHead>
            <TableHead class="text-center w-[120px]">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {#each entries as entry (entry.id)}
            <TableRow>
              <TableCell class="w-[110px] text-center"><div class="flex items-center gap-1 justify-center"><IconWrapper icon={Calendar} className="h-4 w-4 text-primary" /><span class="text-sm">{new Date(entry.entry_date).toLocaleDateString('id-ID')}</span></div></TableCell>
              <TableCell class="w-[180px] text-left"><div class="flex items-center gap-2 justify-start">{#if entry.product_image}<img src={entry.product_image} alt={entry.product_name} class="w-8 h-8 object-cover rounded" />{:else}<div class="w-8 h-8 bg-muted rounded flex items-center justify-center"><IconWrapper icon={Package} className="h-4 w-4 text-muted-foreground" /></div>{/if}<span class="font-medium truncate text-sm">{entry.product_name}</span></div></TableCell>
              <TableCell class="w-[140px] text-center"><div class="flex items-center gap-1 justify-center"><IconWrapper icon={Users} className="h-4 w-4 text-primary" /><div class="min-w-0"><div class="font-medium truncate text-sm">{entry.supplier_name}</div>{#if entry.supplier_phone}<div class="text-xs text-muted-foreground truncate">{entry.supplier_phone}</div>{/if}</div></div></TableCell>
              <TableCell class="text-center font-medium">{entry.quantity_in}</TableCell><TableCell class="text-center"><span class="font-medium text-primary">{entry.quantity_sold}</span></TableCell><TableCell class="text-center"><span class="font-medium text-primary">{entry.quantity_returned}</span></TableCell>
              <TableCell class="text-center font-mono text-sm">{formatCurrency(entry.product_price || entry.price_per_unit)}</TableCell>
              <TableCell class="text-center"><div class="font-mono font-medium text-sm">{formatCurrency(entry.total_revenue)}</div><div class="text-xs text-muted-foreground">Supplier: {formatCurrency(entry.supplier_earning)}</div></TableCell>
              <TableCell class="text-center"><div class="flex flex-col items-center gap-1"><Badge variant={entry.status === 'active' ? 'default' : entry.status === 'completed' ? 'secondary' : 'outline'} class="text-xs">{entry.status === 'active' ? 'Aktif' : entry.status === 'completed' ? 'Selesai' : 'Dikembalikan'}</Badge>{#if entry.status === 'completed'}<Badge variant={entry.is_paid ? 'default' : 'destructive'} class="text-xs"><IconWrapper icon={entry.is_paid ? CheckCircle : XCircle} className="mr-1 h-3 w-3" />{entry.is_paid ? 'Dibayar' : 'Belum Bayar'}</Badge>{/if}</div></TableCell>
              <TableCell class="text-center"><RowActions>{#if entry.status === 'active'}<RowActionItem icon={Edit} label="Edit" on:click={() => onEdit(entry)} />{#if userRole === 'superadmin'}<RowActionItem icon={Calendar} label="Selesaikan" on:click={() => onComplete(entry)} />{/if}{/if}{#if entry.status === 'completed' && !entry.is_paid && userRole === 'superadmin'}<RowActionItem icon={DollarSign} label="Tandai Dibayar" on:click={() => onMarkPaid(entry)} />{/if}</RowActions></TableCell>
            </TableRow>
          {/each}
          {#if entries.length === 0}<TableRow><TableCell colspan={10} class="h-24 text-center">{totalItems === 0 && allEntriesCount > 0 ? 'Tidak ada data yang sesuai dengan filter.' : 'Belum ada data stok harian hari ini.'}</TableCell></TableRow>{/if}
        </TableBody>
      </Table>
    </div>
  </ScrollArea>
  <Pagination {currentPage} {totalItems} {itemsPerPage} {onPageChange} {onItemsPerPageChange} />
</div>
