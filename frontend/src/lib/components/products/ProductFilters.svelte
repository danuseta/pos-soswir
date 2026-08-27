<script lang="ts">
  import { Filter, Search, SortAsc, SortDesc } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';

  export let searchTerm = '';
  export let categoryFilter = '';
  export let stockFilter = 'all';
  export let sortField = 'name';
  export let sortDirection = 'asc';
  export let categories: any[] = [];
  export let filteredCount = 0;
  export let totalCount = 0;
  export let onReset: () => void;
  export let onSort: (field: string) => void;
</script>

<div class="bg-card rounded-lg shadow p-4 max-w-full">
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
    <div class="flex items-center gap-2 min-w-0"><IconWrapper icon={Search} className="h-5 w-5 text-muted-foreground flex-shrink-0" /><Input type="text" placeholder="Cari produk..." bind:value={searchTerm} class="min-w-0" /></div>
    <select bind:value={categoryFilter} class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-w-0"><option value="">Semua Kategori</option>{#each categories as category}<option value={category.id.toString()}>{category.name}</option>{/each}</select>
    <select bind:value={stockFilter} class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-w-0"><option value="all">Semua Stok</option><option value="low">Stok Rendah (≤10)</option><option value="out">Habis</option></select>
    <div class="flex gap-2 min-w-0"><Button variant="outline" on:click={onReset} size="sm" class="flex-shrink-0"><IconWrapper icon={Filter} className="mr-2 h-4 w-4" />Reset Filter</Button></div>
  </div>
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm text-muted-foreground">
    <span class="flex-shrink-0">Menampilkan {filteredCount} dari {totalCount} produk</span>
    <div class="flex items-center gap-2 flex-shrink-0"><span class="hidden sm:inline">Urutkan:</span><select bind:value={sortField} class="px-2 py-1 border rounded text-sm bg-background min-w-0"><option value="name">Nama</option><option value="price">Harga</option><option value="stock">Stok</option><option value="created_at">Tanggal Dibuat</option></select><Button variant="outline" size="sm" on:click={() => onSort(sortField)} class="flex-shrink-0"><IconWrapper icon={sortDirection === 'asc' ? SortAsc : SortDesc} className="h-4 w-4" /></Button></div>
  </div>
</div>
