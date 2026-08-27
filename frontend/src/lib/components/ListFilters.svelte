<script lang="ts">
  import { Filter, Search, SortAsc, SortDesc } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  export let searchTerm = '';
  export let searchPlaceholder = 'Cari...';
  export let secondaryValue = '';
  export let secondaryOptions: Array<{ value: string; label: string }> = [];
  export let sortField = '';
  export let sortDirection = 'asc';
  export let sortOptions: Array<{ value: string; label: string }> = [];
  export let filteredCount = 0;
  export let totalCount = 0;
  export let itemLabel = 'data';
  export let onClear: () => void;
  export let onSort: (field: string) => void;
</script>

<div class="bg-card rounded-lg shadow p-4 max-w-full">
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
    <div class="flex items-center gap-2 min-w-0"><IconWrapper icon={Search} className="h-5 w-5 text-muted-foreground flex-shrink-0" /><Input type="text" placeholder={searchPlaceholder} bind:value={searchTerm} class="min-w-0" /></div>
    {#if secondaryOptions.length}<select bind:value={secondaryValue} class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-w-0">{#each secondaryOptions as option}<option value={option.value}>{option.label}</option>{/each}</select>{/if}
    <div class="flex gap-2 min-w-0"><Button variant="outline" on:click={onClear} size="sm" class="flex-shrink-0"><IconWrapper icon={Filter} className="mr-2 h-4 w-4" />Reset Filter</Button></div>
  </div>
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm text-muted-foreground">
    <span>Menampilkan {filteredCount} dari {totalCount} {itemLabel}</span>
    <div class="flex items-center gap-2"><span class="hidden sm:inline">Urutkan:</span><select bind:value={sortField} class="px-2 py-1 border rounded text-sm bg-background min-w-0">{#each sortOptions as option}<option value={option.value}>{option.label}</option>{/each}</select><Button variant="outline" size="sm" on:click={() => onSort(sortField)}><IconWrapper icon={sortDirection === 'asc' ? SortAsc : SortDesc} className="h-4 w-4" /></Button></div>
  </div>
</div>
