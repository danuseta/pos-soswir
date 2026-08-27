<script lang="ts">
  import { Calendar, Package, PlusCircle } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Button } from '$lib/components/ui/button';
  export let onRefresh: () => void;
  export let onAdd: () => void;
  export let onCompleteDay: () => void;
</script>

<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
  <h2 class="text-2xl md:text-3xl font-bold tracking-tight">Stok Harian PUBJ</h2>
  <div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
    <Button variant="outline" on:click={onRefresh} title="Refresh Data" class="w-full sm:w-auto"><IconWrapper icon={Package} className="mr-2 h-4 w-4" />Refresh</Button>
    <Button on:click={onAdd} class="w-full sm:w-auto"><IconWrapper icon={PlusCircle} className="mr-2 h-4 w-4" />Tambah Entry</Button>
    <Button variant="outline" on:click={onCompleteDay} class="w-full sm:w-auto text-primary border-primary/20"><IconWrapper icon={Calendar} className="mr-2 h-4 w-4" /><span class="whitespace-nowrap">Selesaikan Hari</span></Button>
  </div>
</div>
