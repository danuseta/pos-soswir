<script lang="ts">
  import { Package, PlusCircle } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Button } from '$lib/components/ui/button';
  export let onRefresh: () => void;
  export let onAdd: () => void;
</script>

<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
  <h2 class="text-2xl md:text-3xl font-bold tracking-tight">Manajemen Produk</h2>
  <div class="flex gap-2 w-full sm:w-auto">
    <Button variant="outline" on:click={onRefresh} title="Refresh Data" class="flex-1 sm:flex-none"><IconWrapper icon={Package} className="mr-2 h-4 w-4" />Refresh</Button>
    <Button on:click={onAdd} class="flex-1 sm:flex-none"><IconWrapper icon={PlusCircle} className="mr-2 h-4 w-4" />Tambah Produk</Button>
  </div>
</div>
