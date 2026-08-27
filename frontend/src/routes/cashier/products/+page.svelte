<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Package, Search, Filter, SortAsc, SortDesc } from "lucide-svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { api, apiData } from "$lib/apiConfig";
  import { browser } from '$app/environment';
  import IconWrapper from "$lib/components/IconWrapper.svelte";
  import AlertMessage from "$lib/components/AlertMessage.svelte";
  import { useAlert } from "$lib/composables/useAlert";
  import CashierProductTable from '$lib/components/products/CashierProductTable.svelte';

  let products = [];
  let categories = [];
  let suppliers = [];
  let isLoading = true;
  let error = null;

  const { showAlertMessage } = useAlert();

  let searchTerm = "";
  let categoryFilter = "";
  let stockFilter = "all";
  let sortField = "name";
  let sortDirection = "asc";
  let currentPage = 1;
  let itemsPerPage = 10;

  onMount(async () => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_token") : null;
    const userRole = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_user_role") : null;
    
    if (!token || (userRole !== 'superadmin' && userRole !== 'cashier')) {
      goto("/login");
      return;
    }
    
    try {
      if (!browser) {
        isLoading = false;
        return;
      }
      
      
      const [productsResult, categoriesResult, suppliersResult] = await Promise.allSettled([
        apiData<any[]>(api.get('/api/products')),
        apiData<any[]>(api.get('/api/categories')),
        apiData<any[]>(api.get('/api/suppliers'))
      ]);

      categories = categoriesResult.status === 'fulfilled' ? categoriesResult.value : [];
      suppliers = suppliersResult.status === 'fulfilled' ? suppliersResult.value : [];

      if (productsResult.status === 'rejected') throw productsResult.reason;

      products = productsResult.value.map(product => ({
        ...product,
        price: parseFloat(product.price) || 0,
        stock: parseInt(product.stock) || 0,
        tax_percentage: parseFloat(product.tax_percentage) || 0,
        category: categories.find(c => c.id === product.category_id) || null,
        supplier: suppliers.find(s => s.id === product.supplier_id) || null
      }));
      
      isLoading = false;
    } catch (err) {
      console.error("Error loading data:", err);
      error = err.message;
      showAlertMessage('error', `Gagal memuat data: ${err.message}`);
      isLoading = false;
    }
  });

  $: filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.category?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.supplier?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || product.category_id?.toString() === categoryFilter;
    const matchesStock = stockFilter === "all" || 
                        (stockFilter === "in_stock" && product.stock > 0) ||
                        (stockFilter === "out_of_stock" && product.stock === 0);
    return matchesSearch && matchesCategory && matchesStock;
  });

  $: sortedProducts = [...filteredProducts].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];
    
    if (sortField === 'category_name') {
      aValue = a.category?.name || '';
      bValue = b.category?.name || '';
    }
    
    if (sortField === 'supplier_name') {
      aValue = a.supplier?.name || '';
      bValue = b.supplier?.name || '';
    }
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    const aStr = (aValue || '').toString().toLowerCase();
    const bStr = (bValue || '').toString().toLowerCase();
    
    if (sortDirection === 'asc') {
      return aStr.localeCompare(bStr);
    } else {
      return bStr.localeCompare(aStr);
    }
  });

  $: paginatedProducts = sortedProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  function toggleSort(field: string) {
    if (sortField === field) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDirection = 'asc';
    }
  }

  function clearFilters() {
    searchTerm = "";
    categoryFilter = "";
    stockFilter = "all";
    currentPage = 1;
  }

  function handlePageChange(page: number) {
    currentPage = page;
  }

  function handleItemsPerPageChange(items: number) {
    itemsPerPage = items;
    currentPage = 1;
  }
</script>

<svelte:head>
  <title>Daftar Produk - Cashier</title>
</svelte:head>

<AlertMessage />

<div class="flex-1 space-y-4 p-4 md:p-8 pt-6">
  <div class="flex items-center justify-between space-y-2">
    <h2 class="text-3xl font-bold tracking-tight">Daftar Produk</h2>
  </div>

  <div class="bg-card rounded-lg shadow p-4">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <div class="flex flex-col">
        <label for="search-filter" class="text-sm font-medium mb-2">Pencarian</label>
        <div class="relative">
          <IconWrapper icon={Search} className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            id="search-filter"
            type="text" 
            placeholder="Cari produk, kategori, supplier..." 
            bind:value={searchTerm} 
            class="pl-10"
          />
        </div>
      </div>
      
      <div class="flex flex-col">
        <label for="category-filter" class="text-sm font-medium mb-2">Kategori</label>
        <select 
          id="category-filter"
          bind:value={categoryFilter}
          class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Semua Kategori</option>
          {#each categories as category}
            <option value={category.id}>{category.name}</option>
          {/each}
        </select>
      </div>
      
      <div class="flex flex-col">
        <label for="stock-filter" class="text-sm font-medium mb-2">Status Stok</label>
        <select 
          id="stock-filter"
          bind:value={stockFilter}
          class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">Semua</option>
          <option value="in_stock">Tersedia</option>
          <option value="out_of_stock">Habis</option>
        </select>
      </div>
      
      <div class="flex flex-col justify-end">
        <Button 
          variant="outline" 
          on:click={clearFilters} 
          class="h-10 bg-primary/10 hover:bg-primary/20 border-primary/20 text-primary"
        >
          <IconWrapper icon={Filter} className="mr-2 h-4 w-4" />
          Reset Filter
        </Button>
      </div>
    </div>
    
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm text-muted-foreground">
      <span class="flex-shrink-0">Menampilkan {paginatedProducts.length} dari {filteredProducts.length} produk</span>
      <div class="flex items-center gap-2 flex-shrink-0">
        <span class="hidden sm:inline">Urutkan:</span>
        <select 
          bind:value={sortField}
          class="px-2 py-1 border rounded text-sm bg-background"
        >
          <option value="name">Nama</option>
          <option value="category_name">Kategori</option>
          <option value="supplier_name">Supplier</option>
          <option value="price">Harga</option>
          <option value="stock">Stok</option>
        </select>
        <Button 
          variant="outline" 
          size="sm"
          on:click={() => toggleSort(sortField)}
          class="bg-primary/10 hover:bg-primary/20 border-primary/20 text-primary"
        >
          <IconWrapper 
            icon={sortDirection === 'asc' ? SortAsc : SortDesc} 
            className="h-4 w-4" 
          />
        </Button>
      </div>
    </div>
  </div>

  {#if isLoading}
    <div class="bg-card p-8 rounded-lg shadow flex justify-center">
      <div class="text-center">
        <div class="inline-block animate-spin h-8 w-8 border-4 border-t-primary border-r-transparent rounded-full mb-4"></div>
        <p>Memuat data produk...</p>
      </div>
    </div>
  {:else if error}
    <div class="bg-card p-8 rounded-lg shadow">
      <div class="text-center text-destructive">
        <p class="mb-2 font-semibold">Error:</p>
        <p>{error}</p>
        <Button class="mt-4" on:click={() => { if (typeof window !== 'undefined') window.location.reload(); }}>Muat Ulang</Button>
      </div>
    </div>
  {:else}
    <CashierProductTable products={paginatedProducts} totalItems={filteredProducts.length} {currentPage} {itemsPerPage} {sortField} {sortDirection} hasFilters={Boolean(searchTerm || categoryFilter || stockFilter !== "all")} onSort={toggleSort} onPageChange={handlePageChange} onItemsPerPageChange={handleItemsPerPageChange} />
  {/if}
</div>
