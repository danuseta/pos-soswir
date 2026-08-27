<script lang="ts">
  import { PlusCircle } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Button } from '$lib/components/ui/button';
  export let onAdd: () => void;
</script>

<div class="flex items-center justify-between space-y-2">
  <h2 class="text-3xl font-bold tracking-tight">Manajemen Supplier PUBJ</h2>
  <Button on:click={onAdd}><IconWrapper icon={PlusCircle} className="mr-2 h-4 w-4" />Tambah Supplier</Button>
</div>
