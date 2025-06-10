<script lang="ts">
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
  import Pagination from "$lib/components/Pagination.svelte";

  export let columns = [];
  export let data = [];
  export let currentPage = 1;
  export let totalItems = 0;
  export let itemsPerPage = 10;
  export let onPageChange = (page: number) => {};
  export let onItemsPerPageChange = (items: number) => {};
  export let minWidth = "800px";
  export let height = "calc(100vh-340px)";
  export let emptyMessage = "Tidak ada data yang tersedia.";
  export let className = "";

  $: paginatedData = (() => {
    if (itemsPerPage >= data.length) {
      return data;
    }
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return data.slice(start, end);
  })();
</script>

<div class="bg-card rounded-lg shadow border border-border overflow-hidden {className}">
  <ScrollArea class="h-[{height}]">
    <div class="overflow-x-auto">
      <div style="min-width: {minWidth};">
        <Table>
          <TableHeader>
            <TableRow>
              {#each columns as column}
                <TableHead 
                  class="{column.class || ''} {column.sortable ? 'cursor-pointer' : ''}"
                  on:click={() => column.onSort && column.onSort(column.key)}
                >
                  {#if column.sortable}
                    <div class="flex items-center">
                      {column.title}
                      {#if column.sortIcon}
                        <svelte:component this={column.sortIcon} class="ml-2 h-4 w-4" />
                      {/if}
                    </div>
                  {:else}
                    {column.title}
                  {/if}
                </TableHead>
              {/each}
            </TableRow>
          </TableHeader>
          <TableBody>
            {#each paginatedData as item, index (item.id || index)}
              <TableRow>
                {#each columns as column}
                  <TableCell class="{column.cellClass || ''}">
                    {#if column.render}
                      <svelte:component this={column.render} {item} {index} {currentPage} {itemsPerPage} />
                    {:else}
                      {item[column.key] || '-'}
                    {/if}
                  </TableCell>
                {/each}
              </TableRow>
            {/each}
            {#if paginatedData.length === 0}
              <TableRow>
                <TableCell colspan={columns.length} class="h-24 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            {/if}
          </TableBody>
        </Table>
      </div>
    </div>
  </ScrollArea>
  
  {#if totalItems > itemsPerPage}
    <div class="border-t border-border">
      <Pagination 
        {currentPage}
        {totalItems}
        {itemsPerPage}
        {onPageChange}
        {onItemsPerPageChange}
      />
    </div>
  {/if}
</div>

<style>
  :global(.data-table-container) {
    overflow: visible !important;
  }
</style> 