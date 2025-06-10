<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-svelte";
  import IconWrapper from "./IconWrapper.svelte";

  export let currentPage = 1;
  export let totalItems = 0;
  export let itemsPerPage = 10;
  export let onPageChange: (page: number) => void = () => {};
  export let onItemsPerPageChange: (items: number) => void = () => {};

  $: totalPages = Math.ceil(totalItems / itemsPerPage);
  $: startItem = (currentPage - 1) * itemsPerPage + 1;
  $: endItem = Math.min(currentPage * itemsPerPage, totalItems);

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  }

  function handleItemsPerPageChange(value: string) {
    const newItemsPerPage = value === 'all' ? totalItems : parseInt(value);
    onItemsPerPageChange(newItemsPerPage);
    onPageChange(1);
  }

  function handleSelectChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    handleItemsPerPageChange(target.value);
  }

  $: visiblePages = (() => {
    const pages = [];
    const maxVisible = (typeof window !== 'undefined' && window.innerWidth < 768) ? 3 : 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
      const end = Math.min(totalPages, start + maxVisible - 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  })();
</script>

<div class="bg-background border-t">
  <div class="block sm:hidden px-4 py-3">
    <div class="flex flex-col space-y-3">
      <div class="flex flex-col space-y-2 text-center">
        <div class="text-xs text-muted-foreground">
          {startItem} - {endItem} dari {totalItems}
        </div>
        <div class="flex items-center justify-center gap-2">
          <span class="text-xs text-muted-foreground">Tampilkan:</span>
          <select 
            class="px-2 py-1 border rounded text-xs bg-background"
            value={itemsPerPage === totalItems ? 'all' : itemsPerPage.toString()}
            on:change={(e) => handleSelectChange(e)}
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="all">Semua</option>
          </select>
        </div>
      </div>
      
      <div class="flex items-center justify-center gap-1">
        <Button 
          variant="outline" 
          size="sm" 
          on:click={() => goToPage(1)}
          disabled={currentPage === 1}
          class="px-2"
        >
          <IconWrapper icon={ChevronsLeft} className="h-3 w-3" />
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          on:click={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
          class="px-2"
        >
          <IconWrapper icon={ChevronLeft} className="h-3 w-3" />
        </Button>

        {#each visiblePages as page}
          <Button 
            variant={page === currentPage ? "default" : "outline"}
            size="sm"
            on:click={() => goToPage(page)}
            class="min-w-[32px] px-2 text-xs"
          >
            {page}
          </Button>
        {/each}

        <Button 
          variant="outline" 
          size="sm" 
          on:click={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          class="px-2"
        >
          <IconWrapper icon={ChevronRight} className="h-3 w-3" />
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          on:click={() => goToPage(totalPages)}
          disabled={currentPage === totalPages}
          class="px-2"
        >
          <IconWrapper icon={ChevronsRight} className="h-3 w-3" />
        </Button>
      </div>
    </div>
  </div>

  <div class="hidden sm:flex items-center justify-between px-4 py-3">
    <div class="flex items-center gap-4">
      <div class="text-sm text-foreground">
        Menampilkan {startItem} - {endItem} dari {totalItems} data
      </div>
      
      <div class="flex items-center gap-2">
        <span class="text-sm text-foreground">Tampilkan:</span>
        <select 
          class="px-2 py-1 border rounded text-sm bg-background"
          value={itemsPerPage === totalItems ? 'all' : itemsPerPage.toString()}
          on:change={(e) => handleSelectChange(e)}
        >
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="all">Semua</option>
        </select>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <Button 
        variant="outline" 
        size="sm" 
        on:click={() => goToPage(1)}
        disabled={currentPage === 1}
      >
        <IconWrapper icon={ChevronsLeft} className="h-4 w-4" />
      </Button>
      
      <Button 
        variant="outline" 
        size="sm" 
        on:click={() => goToPage(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <IconWrapper icon={ChevronLeft} className="h-4 w-4" />
      </Button>

      {#each visiblePages as page}
        <Button 
          variant={page === currentPage ? "default" : "outline"}
          size="sm"
          on:click={() => goToPage(page)}
          class="min-w-[40px]"
        >
          {page}
        </Button>
      {/each}

      <Button 
        variant="outline" 
        size="sm" 
        on:click={() => goToPage(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        <IconWrapper icon={ChevronRight} className="h-4 w-4" />
      </Button>
      
      <Button 
        variant="outline" 
        size="sm" 
        on:click={() => goToPage(totalPages)}
        disabled={currentPage === totalPages}
      >
        <IconWrapper icon={ChevronsRight} className="h-4 w-4" />
      </Button>
    </div>
  </div>
</div>
