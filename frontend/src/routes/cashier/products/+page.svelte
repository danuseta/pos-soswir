<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
  import { Badge } from "$lib/components/ui/badge";
  import { Package, Users, Percent, Search, Filter, SortAsc, SortDesc, ArrowUpDown, Power, PowerOff, UtensilsCrossed, Coffee, Truck } from "lucide-svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { BACKEND_URL, getAuthHeaders } from "$lib/apiConfig";
  import { browser } from '$app/environment';
  import IconWrapper from "$lib/components/IconWrapper.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import AlertMessage from "$lib/components/AlertMessage.svelte";
  import { useAlert } from "$lib/composables/useAlert";

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

  function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  }

  function getCategoryIcon(categoryName: string) {
    if (categoryName.toLowerCase().includes('makanan')) {
      return UtensilsCrossed;
    } else if (categoryName.toLowerCase().includes('minuman')) {
      return Coffee;
    } else if (categoryName.toLowerCase().includes('pubj')) {
      return Truck;
    }
    return Package;
  }

  function getCategoryColor(categoryName: string) {
    if (categoryName.toLowerCase().includes('makanan')) {
      return 'text-orange-600';
    } else if (categoryName.toLowerCase().includes('minuman')) {
      return 'text-primary';
    } else if (categoryName.toLowerCase().includes('pubj')) {
      return 'text-purple-600';
    }
    return 'text-muted-foreground';
  }

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
      
      showAlertMessage('info', 'Memuat data produk, kategori, dan supplier...');
      
      const [productsResponse, categoriesResponse, suppliersResponse] = await Promise.all([
        fetch(`${BACKEND_URL}/api/products`, { headers: getAuthHeaders() }),
        fetch(`${BACKEND_URL}/api/categories`, { headers: getAuthHeaders() }),
        fetch(`${BACKEND_URL}/api/suppliers`, { headers: getAuthHeaders() })
      ]);
      
      if (categoriesResponse.ok) {
        categories = await categoriesResponse.json();
        console.log('Categories loaded:', categories.length);
      } else {
        console.warn("Categories failed to load, but continuing...");
        categories = [];
      }

      if (suppliersResponse.ok) {
        suppliers = await suppliersResponse.json();
        console.log('Suppliers loaded:', suppliers.length);
      } else {
        console.warn("Suppliers failed to load, but continuing...");
        suppliers = [];
      }
      
      if (productsResponse.ok) {
        const rawProducts = await productsResponse.json();
        products = rawProducts.map(product => ({
          ...product,
          price: parseFloat(product.price) || 0,
          stock: parseInt(product.stock) || 0,
          tax_percentage: parseFloat(product.tax_percentage) || 0,
          category: categories.find(c => c.id === product.category_id) || null,
          supplier: suppliers.find(s => s.id === product.supplier_id) || null
        }));
        console.log('Products loaded and processed:', products.length);
        showAlertMessage('success', `${products.length} produk berhasil dimuat`);
      } else {
        const errorData = await productsResponse.json();
        throw new Error(errorData.message || "Gagal memuat data produk");
      }
      
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

  $: totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
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
    <div class="bg-card rounded-lg shadow border border-border overflow-hidden">
      <ScrollArea class="h-[calc(100vh-350px)]" orientation="both">
        <div class="min-w-[1100px] p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="cursor-pointer w-[200px] text-center" on:click={() => toggleSort('name')}>
                  <div class="flex items-center justify-center">
                    Produk
                    <IconWrapper 
                      icon={sortField === 'name' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                    />
                  </div>
                </TableHead>
                <TableHead class="cursor-pointer w-[140px] text-center" on:click={() => toggleSort('category_name')}>
                  <div class="flex items-center justify-center">
                    Kategori
                    <IconWrapper 
                      icon={sortField === 'category_name' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                    />
                  </div>
                </TableHead>
                <TableHead class="cursor-pointer w-[120px] text-center" on:click={() => toggleSort('supplier_name')}>
                  <div class="flex items-center justify-center">
                    Supplier
                    <IconWrapper 
                      icon={sortField === 'supplier_name' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                    />
                  </div>
                </TableHead>
                <TableHead class="cursor-pointer w-[120px] text-center" on:click={() => toggleSort('price')}>
                  <div class="flex items-center justify-center">
                    Harga
                    <IconWrapper 
                      icon={sortField === 'price' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                    />
                  </div>
                </TableHead>
                <TableHead class="cursor-pointer w-[100px] text-center" on:click={() => toggleSort('stock')}>
                  <div class="flex items-center justify-center">
                    Stok
                    <IconWrapper 
                      icon={sortField === 'stock' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                    />
                  </div>
                </TableHead>
                <TableHead class="w-[100px] text-center">Pajak</TableHead>
                <TableHead class="w-[100px] text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {#each paginatedProducts as product (product.id)}
                <TableRow>
                  <TableCell class="w-[200px] text-center">
                    <div class="flex items-center justify-center">
                      {#if product.image_url}
                        <img src={product.image_url} alt={product.name} class="w-10 h-10 object-cover rounded mr-2" />
                      {:else}
                        <div class="w-10 h-10 bg-muted rounded mr-2 flex items-center justify-center">
                          <IconWrapper icon={Package} className="h-5 w-5 text-muted-foreground" />
                        </div>
                      {/if}
                      <div class="min-w-0">
                        <div class="font-medium truncate text-sm">{product.name}</div>
                        {#if product.description}
                          <div class="text-xs text-muted-foreground truncate">{product.description}</div>
                        {/if}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell class="w-[140px] text-center">
                    {#if product.category}
                      <span class="flex items-center justify-center">
                        <IconWrapper 
                          icon={getCategoryIcon(product.category.name)} 
                          className="h-4 w-4 mr-1 {getCategoryColor(product.category.name)}" 
                        />
                        {product.category.name}
                      </span>
                    {:else}
                      <span class="text-gray-400">-</span>
                    {/if}
                  </TableCell>
                  <TableCell class="w-[120px] text-center">
                    {#if product.supplier}
                      <div class="flex items-center justify-center">
                        <IconWrapper icon={Users} className="h-4 w-4 mr-1 text-primary" />
                        <span class="text-sm">{product.supplier.name}</span>
                      </div>
                    {:else}
                      <span class="text-muted-foreground">-</span>
                    {/if}
                  </TableCell>
                  <TableCell class="w-[120px] text-center">
                    <span class="font-semibold text-primary">{formatCurrency(product.price)}</span>
                  </TableCell>
                  <TableCell class="w-[100px] text-center">
                    <Badge variant={product.stock > 0 ? "default" : "destructive"} class="text-center">
                      {product.stock}
                    </Badge>
                  </TableCell>
                  <TableCell class="w-[100px] text-center">
                    {#if product.tax_percentage > 0}
                      <div class="flex items-center justify-center text-primary">
                        <IconWrapper icon={Percent} className="h-4 w-4 mr-1" />
                        <span class="text-sm">{product.tax_percentage}%</span>
                      </div>
                    {:else}
                      <span class="text-muted-foreground">-</span>
                    {/if}
                  </TableCell>
                  <TableCell class="w-[100px] text-center">
                    <div class="flex items-center justify-center">
                      <IconWrapper 
                        icon={product.is_active ? Power : PowerOff} 
                        className="h-4 w-4 mr-1 {product.is_active ? 'text-primary' : 'text-destructive'}" 
                      />
                      <span class="text-sm {product.is_active ? 'text-primary' : 'text-destructive'}">
                        {product.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              {/each}
            </TableBody>
          </Table>

          {#if filteredProducts.length === 0}
            <div class="text-center py-12">
              <IconWrapper icon={Package} className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 class="text-lg font-medium mb-2">Tidak ada produk</h3>
              <p class="text-muted-foreground">
                {searchTerm || categoryFilter || stockFilter !== "all" 
                  ? "Tidak ada produk yang sesuai dengan filter Anda" 
                  : "Belum ada produk yang ditambahkan"}
              </p>
            </div>
          {/if}
        </div>
      </ScrollArea>
      
      <Pagination 
        {currentPage}
        totalItems={filteredProducts.length}
        {itemsPerPage}
        onPageChange={handlePageChange}
        onItemsPerPageChange={handleItemsPerPageChange}
      />
    </div>
  {/if}
</div>

