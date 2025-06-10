<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import IconWrapper from "$lib/components/IconWrapper.svelte";
  import { Edit, Trash2 } from "lucide-svelte";

  export let item;
  export const index = 0;
  export const currentPage = 1;
  export const itemsPerPage = 10;
  export let onEdit = (category) => {};
  export let onDelete = (categoryId) => {};
</script>

<div class="flex justify-center space-x-1">
  <Button variant="outline" size="sm" on:click={() => onEdit(item)} title="Edit">
    <IconWrapper icon={Edit} className="h-4 w-4" />
  </Button>
  <Button variant="destructive" size="sm" on:click={() => onDelete(item.id)} title="Hapus">
    <IconWrapper icon={Trash2} className="h-4 w-4" />
  </Button>
</div> 