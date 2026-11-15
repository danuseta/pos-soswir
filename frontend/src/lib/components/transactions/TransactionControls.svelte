<script lang="ts">
  import { FileSpreadsheet, Filter, Search, SortAsc, SortDesc } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  export let searchTerm = '';
  export let dateRange: any;
  export let sortField = 'waktu';
  export let sortDirection = 'desc';
  export let filteredCount = 0;
  export let totalCount = 0;
  export let isLoading = false;
  export let isExporting = false;
  export let onExport: () => void;
  export let onClear: () => void;
  export let onSort: (field: string) => void;
</script>

<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
  <h2 class="text-2xl md:text-3xl font-bold tracking-tight">Log Transaksi</h2>
  <Button variant="outline" on:click={onExport} disabled={isLoading || isExporting} class="w-full sm:w-auto"><IconWrapper icon={FileSpreadsheet} className="mr-2 h-4 w-4 {isExporting ? 'animate-spin' : ''}" />{isExporting ? 'Mengekspor...' : 'Export Excel'}</Button>
</div>
<div class="bg-card rounded-lg shadow p-4 max-w-full">
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
    <div class="flex items-center gap-2 min-w-0"><IconWrapper icon={Search} className="h-5 w-5 text-muted-foreground flex-shrink-0" /><Input type="text" placeholder="Cari transaksi..." bind:value={searchTerm} class="min-w-0" /></div>
    <Input type="date" bind:value={dateRange.from} class="w-full" />
    <Input type="date" bind:value={dateRange.to} class="w-full" />
    <div class="flex gap-2 min-w-0"><Button variant="outline" on:click={onClear} size="sm" class="flex-shrink-0"><IconWrapper icon={Filter} className="mr-2 h-4 w-4" />Reset</Button></div>
  </div>
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm text-muted-foreground">
    <span>Menampilkan {filteredCount} dari {totalCount} transaksi</span>
    <div class="flex items-center gap-2"><span class="hidden sm:inline">Urutkan:</span><select bind:value={sortField} class="px-2 py-1 border rounded text-sm bg-background"><option value="waktu">Waktu</option><option value="produk">Produk</option><option value="kategori">Kategori</option><option value="kasir">Kasir</option><option value="total">Total</option><option value="payment_method">Metode Pembayaran</option></select><Button variant="outline" size="sm" on:click={() => onSort(sortField)}><IconWrapper icon={sortDirection === 'asc' ? SortAsc : SortDesc} className="h-4 w-4" /></Button></div>
  </div>
</div>
