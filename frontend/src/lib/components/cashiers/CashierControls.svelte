<script lang="ts">
  import { Clock, Filter, PlusCircle, Search, SortAsc, SortDesc } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  export let searchTerm = '';
  export let sortField = 'username';
  export let sortDirection = 'asc';
  export let filteredCount = 0;
  export let totalCount = 0;
  export let onAddCashier: () => void;
  export let onAddShift: () => void;
  export let onClear: () => void;
  export let onSort: (field: string) => void;
</script>

<div class="flex justify-end">
  <Button on:click={onAddCashier} class="w-full sm:w-auto"><IconWrapper icon={PlusCircle} className="mr-2 h-4 w-4" />Tambah Kasir</Button>
  <Button variant="outline" on:click={onAddShift} class="w-full sm:w-auto"><IconWrapper icon={Clock} className="mr-2 h-4 w-4" />Tambah Sesi</Button>
</div>

<div class="bg-card rounded-lg shadow p-4 max-w-full">
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
    <div class="flex items-center gap-2 min-w-0"><IconWrapper icon={Search} className="h-5 w-5 text-muted-foreground flex-shrink-0" /><Input type="text" placeholder="Cari kasir..." bind:value={searchTerm} class="min-w-0" /></div>
    <div class="flex gap-2 min-w-0"><Button variant="outline" on:click={onClear} size="sm" class="flex-shrink-0"><IconWrapper icon={Filter} className="mr-2 h-4 w-4" />Reset Filter</Button></div>
  </div>
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm text-muted-foreground">
    <span class="flex-shrink-0">Menampilkan {filteredCount} dari {totalCount} kasir</span>
    <div class="flex items-center gap-2 flex-shrink-0"><span class="hidden sm:inline">Urutkan:</span><select bind:value={sortField} class="px-2 py-1 border rounded text-sm bg-background min-w-0"><option value="username">Username</option><option value="created_at">Tanggal Dibuat</option><option value="last_login">Login Terakhir</option></select><Button variant="outline" size="sm" on:click={() => onSort(sortField)} class="flex-shrink-0"><IconWrapper icon={sortDirection === 'asc' ? SortAsc : SortDesc} className="h-4 w-4" /></Button></div>
  </div>
</div>
