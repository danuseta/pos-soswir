<script lang="ts">
  import { Filter, Search, SortAsc, SortDesc } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';

  export let searchTerm = '';
  export let selectedDate = '';
  export let selectedSupplier = '';
  export let selectedStatus = '';
  export let sortField = 'entry_date';
  export let sortDirection = 'desc';
  export let suppliers: any[] = [];
  export let filteredCount = 0;
  export let totalCount = 0;
  export let onClear: () => void;
  export let onSort: (field: string) => void;
</script>

<div class="bg-card rounded-lg shadow p-4">
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
    <div class="flex flex-col"><Label for="search-filter" class="text-sm font-medium mb-2">Pencarian</Label><div class="flex items-center gap-2"><IconWrapper icon={Search} className="h-5 w-5 text-muted-foreground" /><Input id="search-filter" type="text" placeholder="Cari produk/supplier..." bind:value={searchTerm} /></div></div>
    <div class="flex flex-col"><Label for="date-filter" class="text-sm font-medium mb-2">Tanggal</Label><Input id="date-filter" type="date" bind:value={selectedDate} /></div>
    <div class="flex flex-col"><Label for="supplier-filter" class="text-sm font-medium mb-2">Supplier</Label><select id="supplier-filter" bind:value={selectedSupplier} class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="">Semua Supplier</option>{#each suppliers as supplier}<option value={supplier.id}>{supplier.name}</option>{/each}</select></div>
    <div class="flex flex-col"><Label for="status-filter" class="text-sm font-medium mb-2">Status</Label><select id="status-filter" bind:value={selectedStatus} class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="">Semua Status</option><option value="active">Aktif</option><option value="completed">Selesai</option></select></div>
    <div class="flex flex-col justify-end"><Button variant="outline" on:click={onClear} class="h-10"><IconWrapper icon={Filter} className="mr-2 h-4 w-4" />Reset Filter</Button></div>
  </div>
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm text-muted-foreground">
    <span class="flex-shrink-0">Menampilkan {filteredCount} dari {totalCount} entry</span>
    <div class="flex items-center gap-2 flex-shrink-0"><span class="hidden sm:inline">Urutkan:</span><select bind:value={sortField} class="px-2 py-1 border rounded text-sm bg-background"><option value="entry_date">Tanggal</option><option value="product_name">Produk</option><option value="supplier_name">Supplier</option><option value="status">Status</option></select><Button variant="outline" size="sm" on:click={() => onSort(sortField)}><IconWrapper icon={sortDirection === 'asc' ? SortAsc : SortDesc} className="h-4 w-4" /></Button></div>
  </div>
</div>
