<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "$lib/components/ui/dialog";
  import { Label } from "$lib/components/ui/label";
  import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
  import { Badge } from "$lib/components/ui/badge";
  import { PlusCircle, Edit, Trash2, Package, Upload, Image as ImageIcon, Users, Percent, Search, Filter, SortAsc, SortDesc, Camera, ArrowUpDown, Power, PowerOff, AlertTriangle, Clock, UtensilsCrossed, Coffee, Truck } from "lucide-svelte";
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

  let showAddEditDialog = false;
  let editingProduct = null;
  let currentProduct = {
    id: null,
    name: "",
    price: 0,
    stock: 0,
    category_id: null,
    supplier_id: null,
    description: "",
    image_url: "",
    tax_percentage: 0,
    tax_description: ""
  };

  let imageFile = null;
  let imagePreview = "";
  let isUploading = false;
  let cloudinaryPublicId = null;

  let searchTerm = "";
  let categoryFilter = "";
  let stockFilter = "all";
  let sortField = "name";
  let sortDirection = "asc";
  let currentPage = 1;
  let itemsPerPage = 10;

  $: isResellerCategory = categories.find(c => c.id === currentProduct.category_id)?.is_reseller || false;

  let showHardDeleteDialog = false;
  let deleteTargetProduct = null;
  let deletePassword = "";
  let isDeleting = false;

  let showToggleActiveDialog = false;
  let toggleTargetProduct = null;
  let isTogglingActive = false;
  let confirmToggleText = "";

  function handleImageSelect(event) {
    const file = event.target.files[0];
    if (file) {
      imageFile = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview = e.target?.result as string || "";
      };
      reader.readAsDataURL(file);
    }
  }

  async function uploadImage() {
    if (!imageFile) return null;
    
    isUploading = true;
    showAlertMessage('info', 'Mengunggah gambar...');
    
    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('pos_token') : null;
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      const response = await fetch(`${BACKEND_URL}/api/products/upload-image`, {
        method: 'POST',
        headers: headers,
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload response text:', errorText);
        let errorMessage;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || 'Gagal mengunggah gambar';
        } catch (parseError) {
          errorMessage = `Gagal mengunggah gambar: ${errorText.substring(0, 100)}...`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      cloudinaryPublicId = data.publicId;
      showAlertMessage('success', 'Gambar berhasil diunggah');
      return data.imageUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      if (error.message.includes('413') || error.message.includes('Payload Too Large')) {
        showAlertMessage('error', 'Ukuran gambar terlalu besar. Maksimal 25MB');
      } else {
        showAlertMessage('error', `Gagal mengunggah gambar: ${error.message}`);
      }
      return null;
    } finally {
      isUploading = false;
    }
  }

  onMount(async () => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_token") : null;
    const userRole = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_user_role") : null;
    
    if (!token || userRole !== 'superadmin') {
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
      } else {
        const errorData = await productsResponse.json();
        throw new Error(errorData.message || "Gagal memuat data produk");
      }
      
      showAlertMessage('success', `Berhasil memuat ${products.length} produk, ${categories.length} kategori, dan ${suppliers.length} supplier`);
      isLoading = false;
      
    } catch (err) {
      console.error("Error loading data:", err);
      error = err.message;
      showAlertMessage('error', `Gagal memuat data: ${err.message}`);
      isLoading = false;
    }
  });

  function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  }

  function openAddDialog() {
    editingProduct = null;
    currentProduct = { 
      id: null, 
      name: "", 
      price: 0, 
      stock: 0, 
      category_id: categories.length > 0 ? categories[0].id : null, 
      supplier_id: null,
      description: "",
      image_url: "",
      tax_percentage: 0,
      tax_description: ""
    };
    imageFile = null;
    imagePreview = "";
    cloudinaryPublicId = null;
    showAddEditDialog = true;
  }

  function openEditDialog(product) {
    editingProduct = product;
    currentProduct = { 
      ...product, 
      category_id: product.category?.id || null,
      supplier_id: product.supplier?.id || null,
      tax_percentage: product.tax_percentage || 0,
      tax_description: product.tax_description || ""
    };
    imageFile = null;
    imagePreview = product.image_url || "";
    cloudinaryPublicId = product.cloudinary_public_id || null;
    showAddEditDialog = true;
  }

  async function handleSaveProduct() {
    try {
      if (!currentProduct.name) {
        showAlertMessage('error', "Nama produk tidak boleh kosong");
        return;
      }
      
      if (isNaN(currentProduct.price) || currentProduct.price < 0) {
        showAlertMessage('error', "Harga harus berupa angka positif");
        return;
      }
      
      if (isNaN(currentProduct.stock) || currentProduct.stock < 0) {
        showAlertMessage('error', "Stok harus berupa angka positif");
        return;
      }
      
      if (!currentProduct.category_id) {
        showAlertMessage('error', "Kategori harus dipilih");
        return;
      }

      if (isResellerCategory) {
        if (!currentProduct.supplier_id) {
          showAlertMessage('error', "Produk PUBJ harus memiliki supplier");
          return;
        }
        
        if (!currentProduct.tax_percentage || currentProduct.tax_percentage <= 0 || currentProduct.tax_percentage > 100) {
          showAlertMessage('error', "Produk PUBJ harus memiliki persentase fee antara 1-100%");
          return;
        }
        
        const supplierExists = suppliers.find(s => s.id === parseInt(currentProduct.supplier_id));
        if (!supplierExists) {
          showAlertMessage('error', "Supplier yang dipilih tidak valid");
          return;
        }
      }

      showAlertMessage('info', editingProduct ? "Memperbarui produk..." : "Menambah produk baru...");

      let imageUrl = currentProduct.image_url;
      let publicId = cloudinaryPublicId;
      
      if (imageFile) {
        imageUrl = await uploadImage();
        publicId = cloudinaryPublicId;
        if (imageUrl === null) return;
      }
      
      const productData = {
        name: currentProduct.name,
        price: parseFloat(String(currentProduct.price)),
        stock: parseInt(String(currentProduct.stock)),
        category_id: currentProduct.category_id,
        supplier_id: isResellerCategory ? currentProduct.supplier_id : null,
        description: currentProduct.description || "",
        image_url: imageUrl,
        public_id: publicId,
        tax_percentage: isResellerCategory ? parseFloat(String(currentProduct.tax_percentage)) : 0,
        tax_description: isResellerCategory ? currentProduct.tax_description : ""
      };
      
      let response;
      
      if (editingProduct) {
        response = await fetch(`${BACKEND_URL}/api/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(productData)
        });
      } else {
        response = await fetch(`${BACKEND_URL}/api/products`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(productData)
        });
      }
      
      if (response.ok) {
        await loadProducts();
        showAddEditDialog = false;
        showAlertMessage('success', editingProduct ? "Produk berhasil diperbarui." : "Produk baru berhasil ditambahkan.");
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal menyimpan produk.");
      }
    } catch (err) {
      console.error("Error saving product:", err);
      showAlertMessage('error', `Error: ${err.message}`);
    }
  }

  async function toggleActiveProduct(productId, currentStatus) {
    toggleTargetProduct = products.find(p => p.id === productId);
    if (!toggleTargetProduct) return;
    
    showToggleActiveDialog = true;
  }

  async function confirmToggleActive() {
    if (!toggleTargetProduct) return;

    try {
      isTogglingActive = true;
      const currentStatus = toggleTargetProduct.is_active;
      const action = currentStatus ? 'menonaktifkan' : 'mengaktifkan';
      
      showAlertMessage('info', `${action.charAt(0).toUpperCase() + action.slice(1)} produk...`);
      
      const response = await fetch(`${BACKEND_URL}/api/products/${toggleTargetProduct.id}/toggle-active`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        products = products.map(p => 
          p.id === toggleTargetProduct.id 
            ? { ...p, is_active: !currentStatus }
            : p
        );
        const statusText = currentStatus ? 'dinonaktifkan' : 'diaktifkan';
        showAlertMessage('success', `Produk berhasil ${statusText}.`);
        showToggleActiveDialog = false;
        toggleTargetProduct = null;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || `Gagal ${action} produk.`);
      }
    } catch (err) {
      console.error("Error toggling product status:", err);
      showAlertMessage('error', `Error: ${err.message}`);
    } finally {
      isTogglingActive = false;
    }
  }

  async function loadProducts() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/products`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        products = await response.json();
        products = products.map(product => ({
          ...product,
          price: parseFloat(product.price) || 0,
          stock: parseInt(product.stock) || 0,
          tax_percentage: parseFloat(product.tax_percentage) || 0,
          category: categories.find(c => c.id === product.category_id) || null,
          supplier: suppliers.find(s => s.id === product.supplier_id) || null
        }));
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal memuat data produk");
      }
    } catch (err) {
      console.error("Error loading products:", err);
      showAlertMessage('error', `Gagal memuat produk: ${err.message}`);
    }
  }

  $: filteredProducts = products.filter(p => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      p.name.toLowerCase().includes(searchLower) ||
      (p.description && p.description.toLowerCase().includes(searchLower));
    
    const matchesCategory = !categoryFilter || p.category_id?.toString() === categoryFilter;
    
    let matchesStock = true;
    if (stockFilter === 'low') {
      matchesStock = p.stock <= 10 && p.stock > 0;
    } else if (stockFilter === 'out') {
      matchesStock = p.stock === 0;
    }
    
    return matchesSearch && matchesCategory && matchesStock;
  }).sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];
    
    if (sortField === 'price' || sortField === 'stock') {
      aValue = Number(aValue) || 0;
      bValue = Number(bValue) || 0;
    }
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }
    
    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  $: paginatedProducts = (() => {
    if (itemsPerPage >= filteredProducts.length) {
      return filteredProducts;
    }
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredProducts.slice(start, end);
  })();

  function toggleSort(field: string) {
    if (sortField === field) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDirection = 'asc';
    }
  }

  function clearFilters() {
    searchTerm = '';
    categoryFilter = '';
    stockFilter = 'all';
    sortField = 'name';
    sortDirection = 'asc';
    currentPage = 1;
  }

  function handlePageChange(page: number) {
    currentPage = page;
  }

  function handleItemsPerPageChange(items: number) {
    itemsPerPage = items;
    currentPage = 1;
  }

  function openHardDeleteDialog(product) {
    deleteTargetProduct = product;
    deletePassword = "";
    showHardDeleteDialog = true;
  }

  async function handleHardDelete() {
    if (!deletePassword.trim()) {
      showAlertMessage('error', "Password wajib diisi untuk menghapus produk secara permanen");
      return;
    }

    if (!deleteTargetProduct) return;

    try {
      isDeleting = true;
      showAlertMessage('info', "Memverifikasi password dan menghapus produk...");

      const response = await fetch(`${BACKEND_URL}/api/products/${deleteTargetProduct.id}/hard-delete`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: deletePassword,
          confirmation: `DELETE_${deleteTargetProduct.name.toUpperCase()}`
        })
      });

      if (response.ok) {
        products = products.filter(p => p.id !== deleteTargetProduct.id);
        showHardDeleteDialog = false;
        showAlertMessage('success', `Produk "${deleteTargetProduct.name}" berhasil dihapus secara permanen.`);
        
        deleteTargetProduct = null;
        deletePassword = "";
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal menghapus produk secara permanen.");
      }
    } catch (err) {
      console.error("Error hard deleting product:", err);
      showAlertMessage('error', `Error: ${err.message}`);
    } finally {
      isDeleting = false;
    }
  }
</script>

<div class="flex-1 space-y-4 p-4 md:p-8 pt-6 max-w-full overflow-hidden">
  <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
    <h2 class="text-2xl md:text-3xl font-bold tracking-tight">Manajemen Produk</h2>
    <div class="flex gap-2 w-full sm:w-auto">
      <Button 
        variant="outline" 
        on:click={loadProducts} 
        title="Refresh Data" 
        class="flex-1 sm:flex-none"
      >
        <IconWrapper icon={Package} className="mr-2 h-4 w-4" />
        Refresh
      </Button>
      <Button 
        on:click={openAddDialog} 
        class="flex-1 sm:flex-none"
      >
        <IconWrapper icon={PlusCircle} className="mr-2 h-4 w-4" />
        Tambah Produk
      </Button>
    </div>
  </div>

  <AlertMessage />

  <div class="bg-card rounded-lg shadow p-4 max-w-full">
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
      <div class="flex items-center gap-2 min-w-0">
        <IconWrapper icon={Search} className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <Input 
          type="text" 
          placeholder="Cari produk..." 
          bind:value={searchTerm} 
          class="min-w-0"
        />
      </div>
      
      <select 
        bind:value={categoryFilter}
        class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-w-0"
      >
        <option value="">Semua Kategori</option>
        {#each categories as category}
          <option value={category.id.toString()}>{category.name}</option>
        {/each}
      </select>
      
      <select 
        bind:value={stockFilter}
        class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-w-0"
      >
        <option value="all">Semua Stok</option>
        <option value="low">Stok Rendah (≤10)</option>
        <option value="out">Habis</option>
      </select>
      
      <div class="flex gap-2 min-w-0">
        <Button 
          variant="outline" 
          on:click={clearFilters} 
          size="sm" 
          class="flex-shrink-0"
        >
          <IconWrapper icon={Filter} className="mr-2 h-4 w-4" />
          Reset Filter
        </Button>
      </div>
    </div>
    
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm text-muted-foreground">
      <span class="flex-shrink-0">Menampilkan {filteredProducts.length} dari {products.length} produk</span>
      <div class="flex items-center gap-2 flex-shrink-0">
        <span class="hidden sm:inline">Urutkan:</span>
        <select 
          bind:value={sortField}
          class="px-2 py-1 border rounded text-sm bg-background min-w-0"
        >
          <option value="name">Nama</option>
          <option value="price">Harga</option>
          <option value="stock">Stok</option>
          <option value="created_at">Tanggal Dibuat</option>
        </select>
        <Button 
          variant="outline" 
          size="sm"
          on:click={() => toggleSort(sortField)}
          class="flex-shrink-0"
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
        <div class="inline-block animate-spin h-8 w-8 border-4 border-t-primary border-r-transparent border-b-primary border-l-transparent rounded-full mb-4"></div>
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
      <ScrollArea class="h-[calc(100vh-400px)]" orientation="both">
        <div class="min-w-[1000px] p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-[60px] text-center">No.</TableHead>
                <TableHead class="w-[200px] text-center">Produk</TableHead>
                <TableHead class="w-[120px] text-center">Kategori</TableHead>
                <TableHead class="w-[120px] text-center">Supplier</TableHead>
                <TableHead class="text-center cursor-pointer w-[100px]" on:click={() => toggleSort('price')}>
                  <div class="flex items-center justify-center">
                    Harga
                    <IconWrapper 
                      icon={sortField === 'price' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                    />
                  </div>
                </TableHead>
                <TableHead class="text-center cursor-pointer w-[80px]" on:click={() => toggleSort('stock')}>
                  <div class="flex items-center justify-center">
                    Stok
                    <IconWrapper 
                      icon={sortField === 'stock' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                    />
                  </div>
                </TableHead>
                <TableHead class="text-center w-[100px]">Fee/Pajak</TableHead>
                <TableHead class="text-center w-[80px]">Status</TableHead>
                <TableHead class="text-center w-[120px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {#each paginatedProducts as product, index (product.id)}
                <TableRow>
                  <TableCell class="font-medium text-center">{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
                  <TableCell class="w-[200px] text-center">
                    <div class="flex items-center justify-center">
                      <div class="flex-shrink-0">
                        {#if product.image_url}
                          <img src={product.image_url} alt={product.name} class="w-8 h-8 object-cover rounded-lg" />
                        {:else}
                          <div class="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                            <IconWrapper icon={Image} className="h-4 w-4 text-muted-foreground" />
                          </div>
                        {/if}
                      </div>
                      <div class="min-w-0 flex-1 text-center">
                        <p class="font-medium truncate text-sm">{product.name}</p>
                        {#if product.description}
                          <p class="text-xs text-muted-foreground truncate">{product.description}</p>
                        {/if}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell class="w-[120px] text-center">
                    {#if product.category}
                      <div class="flex items-center gap-2 justify-center">
                        {#if product.category.name.toLowerCase() === 'makanan'}
                          <IconWrapper icon={UtensilsCrossed} className="h-4 w-4 text-orange-600" />
                        {:else if product.category.name.toLowerCase() === 'minuman'}
                          <IconWrapper icon={Coffee} className="h-4 w-4 text-primary" />
                        {:else if product.category.name.toLowerCase() === 'pubj'}
                          <IconWrapper icon={Truck} className="h-4 w-4 text-purple-600" />
                        {:else}
                          <IconWrapper icon={Package} className="h-4 w-4 text-muted-foreground" />
                        {/if}
                        <span class="text-sm font-medium">
                          {product.category.name}
                        </span>
                      </div>
                    {:else}
                      <span class="text-muted-foreground">-</span>
                    {/if}
                  </TableCell>
                  <TableCell class="w-[120px] text-center">
                    {#if product.supplier}
                      <div class="text-sm">
                        <p class="font-medium truncate">{product.supplier.name}</p>
                        {#if product.supplier.phone}
                          <p class="text-muted-foreground text-xs truncate">{product.supplier.phone}</p>
                        {/if}
                      </div>
                    {:else}
                      <span class="text-muted-foreground">-</span>
                    {/if}
                  </TableCell>
                  <TableCell class="text-center">
                    <span class="font-medium text-sm">{formatCurrency(product.price)}</span>
                  </TableCell>
                  <TableCell class="text-center">
                    <div class="flex flex-col items-center gap-1">
                      <span class="font-medium text-sm {product.stock <= 0 ? 'text-destructive' : product.stock <= 10 ? 'text-orange-600' : 'text-success'}">
                        {product.stock}
                      </span>
                      {#if product.stock <= 0}
                        <Badge variant="destructive" class="text-xs">Habis</Badge>
                      {:else if product.stock <= 10}
                        <Badge variant="outline" class="text-xs text-orange-600 border-orange-300">Rendah</Badge>
                      {/if}
                    </div>
                  </TableCell>
                  <TableCell class="text-center">
                    {#if product.tax_percentage > 0}
                      <div class="flex flex-col items-center gap-1">
                        <Badge variant="outline" class="text-orange-600 border-orange-300 text-xs">
                          <IconWrapper icon={Percent} className="mr-1 h-3 w-3" />
                          {product.tax_percentage}%
                        </Badge>
                        {#if product.tax_description}
                          <p class="text-xs text-muted-foreground text-center truncate">{product.tax_description}</p>
                        {/if}
                      </div>
                    {:else}
                      <span class="text-muted-foreground">-</span>
                    {/if}
                  </TableCell>
                  <TableCell class="text-center">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {product.is_active ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}">
                      {product.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </TableCell>
                  <TableCell class="text-center">
                    <div class="flex justify-center space-x-1">
                      <Button variant="outline" size="sm" on:click={() => openEditDialog(product)} title="Edit">
                        <IconWrapper icon={Edit} className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant={product.is_active ? "destructive" : "default"} 
                        size="sm" 
                        on:click={() => toggleActiveProduct(product.id, product.is_active)} 
                        title={product.is_active ? "Nonaktifkan" : "Aktifkan"}
                      >
                        <IconWrapper icon={product.is_active ? PowerOff : Power} className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        on:click={() => openHardDeleteDialog(product)} 
                        title="Hapus Permanen (Password Required)"
                      >
                        <IconWrapper icon={Trash2} className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              {/each}
              {#if paginatedProducts.length === 0}
                <TableRow>
                  <TableCell colspan={9} class="h-24 text-center">
                    {filteredProducts.length === 0 && products.length > 0 ? 'Tidak ada produk yang sesuai dengan filter.' : 'Belum ada produk yang tersedia.'}
                  </TableCell>
                </TableRow>
              {/if}
            </TableBody>
          </Table>
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

{#if showAddEditDialog}
  <Dialog open={showAddEditDialog} onOpenChange={(open) => { if (!open) showAddEditDialog = false; }}>
    <DialogContent class="w-full max-w-[95vw] sm:max-w-[700px] max-h-[95vh] overflow-y-auto mx-4">
      <DialogHeader>
        <DialogTitle class="text-lg sm:text-xl">{editingProduct ? "Edit Produk" : "Tambah Produk Baru"}</DialogTitle>
        <DialogDescription class="text-sm">
          {editingProduct ? "Ubah detail produk di bawah ini." : "Isi detail untuk produk baru."}
        </DialogDescription>
      </DialogHeader>
      
      <div class="space-y-6 py-4">
        <div class="space-y-4">
          <h4 class="font-medium text-base">Informasi Dasar</h4>
          
          <div class="space-y-3">
            <div>
              <Label for="name" class="text-sm font-medium">Nama Produk *</Label>
              <Input 
                id="name" 
                bind:value={currentProduct.name} 
                placeholder="Masukkan nama produk" 
                class="mt-1"
              />
            </div>
            
            <div>
              <Label for="category" class="text-sm font-medium">Kategori *</Label>
              <select 
                id="category" 
                bind:value={currentProduct.category_id} 
                class="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value={null} disabled>Pilih kategori...</option>
                {#each categories as category (category.id)}
                  <option value={category.id}>
                    {category.name}
                  </option>
                {/each}
              </select>
            </div>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label for="price" class="text-sm font-medium">Harga (Rp) *</Label>
                <Input 
                  id="price" 
                  type="number" 
                  min="0" 
                  step="100" 
                  bind:value={currentProduct.price} 
                  placeholder="0"
                  class="mt-1"
                />
              </div>
              
              <div>
                <Label for="stock" class="text-sm font-medium flex items-center gap-2">
                  Stok {isResellerCategory ? '(PUBJ)' : ''} *
                  {#if isResellerCategory}
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                      Auto dari Stok Harian
                    </span>
                  {/if}
                </Label>
                <Input 
                  id="stock" 
                  type="number" 
                  min="0" 
                  bind:value={currentProduct.stock} 
                  placeholder="0"
                  class="mt-1"
                  disabled={isResellerCategory}
                />
                {#if isResellerCategory}
                  <p class="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    ⚠️ Stok PUBJ dikelola otomatis melalui <strong>Stok Harian PUBJ</strong>
                  </p>
                {/if}
              </div>
            </div>
            
            <div>
              <Label for="description" class="text-sm font-medium">Deskripsi</Label>
              <textarea 
                id="description" 
                bind:value={currentProduct.description} 
                class="mt-1 min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" 
                placeholder="Deskripsi produk (opsional)..."
              ></textarea>
            </div>
          </div>
        </div>

        {#if isResellerCategory}
          <div class="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
            <div class="flex items-center gap-2 mb-4">
              <IconWrapper icon={Users} className="h-5 w-5 text-orange-600" />
              <h4 class="font-medium text-orange-700 dark:text-orange-300">Pengaturan PUBJ (Penitipan)</h4>
            </div>
            
            <div class="space-y-4">
              <div>
                <Label for="supplier" class="text-sm font-medium text-orange-700 dark:text-orange-300">Supplier *</Label>
                <select 
                  id="supplier" 
                  bind:value={currentProduct.supplier_id} 
                  class="mt-1 h-10 w-full rounded-md border border-orange-300 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value={null} disabled>Pilih supplier...</option>
                  {#each suppliers as supplier (supplier.id)}
                    <option value={supplier.id}>
                      {supplier.name} {supplier.phone ? `(${supplier.phone})` : ''}
                    </option>
                  {/each}
                </select>
                <p class="text-xs text-orange-600 dark:text-orange-400 mt-1">
                  Pilih supplier/pemilik barang yang dititipkan
                </p>
              </div>
              
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label for="tax_percentage" class="text-sm font-medium text-orange-700 dark:text-orange-300">Persentase Fee Toko (%) *</Label>
                  <Input 
                    id="tax_percentage" 
                    type="number" 
                    min="0.01" 
                    max="100"
                    step="0.01"
                    bind:value={currentProduct.tax_percentage}
                    placeholder="10.00" 
                    class="mt-1 border-orange-300 focus:border-orange-500 focus:ring-orange-500"
                  />
                  <p class="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    Fee yang diambil toko (1-100%)
                  </p>
                </div>
                
                <div>
                  <Label for="tax_description" class="text-sm font-medium text-orange-700 dark:text-orange-300">Keterangan Fee</Label>
                  <Input 
                    id="tax_description" 
                    bind:value={currentProduct.tax_description} 
                    placeholder="Contoh: Fee toko 10%"
                    class="mt-1 border-orange-300 focus:border-orange-500 focus:ring-orange-500" 
                  />
                </div>
              </div>
              
              {#if currentProduct.price > 0 && currentProduct.tax_percentage > 0}
                <div class="bg-orange-100 dark:bg-orange-900/40 p-3 rounded text-sm">
                  <div class="font-medium mb-2">Simulasi Bagi Hasil:</div>
                  <div class="space-y-1 text-xs">
                    <div class="flex justify-between">
                      <span>Harga Jual:</span>
                      <span class="font-medium">{formatCurrency(currentProduct.price)}</span>
                    </div>
                    <div class="flex justify-between text-success">
                      <span>Fee Toko ({currentProduct.tax_percentage}%):</span>
                      <span class="font-medium">{formatCurrency(currentProduct.price * (currentProduct.tax_percentage / 100))}</span>
                    </div>
                    <div class="flex justify-between text-primary">
                      <span>Untuk Supplier:</span>
                      <span class="font-medium">{formatCurrency(currentProduct.price - (currentProduct.price * (currentProduct.tax_percentage / 100)))}</span>
                    </div>
                    <hr class="my-2 border-orange-200">
                    <div class="text-xs text-orange-600 dark:text-orange-400">
                      <p class="mb-1"><strong>Contoh:</strong> Jika terjual 1 unit:</p>
                      <p>• Total penjualan: {formatCurrency(currentProduct.price)}</p>
                      <p>• Toko mendapat: {formatCurrency(currentProduct.price * (currentProduct.tax_percentage / 100))} (sebagai fee)</p>
                      <p>• Supplier mendapat: {formatCurrency(currentProduct.price - (currentProduct.price * (currentProduct.tax_percentage / 100)))}</p>
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/if}

        <div class="space-y-4">
          <h4 class="font-medium text-base">Gambar Produk</h4>
          
          <div class="space-y-3">
            {#if imagePreview}
              <div class="flex justify-center">
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  class="w-32 h-32 sm:w-40 sm:h-40 object-cover rounded-lg border border-border"
                />
              </div>
            {/if}
            
            <div>
              <Label for="image" class="text-sm font-medium">Pilih Gambar</Label>
              <input
                id="image"
                type="file"
                accept="image/*"
                on:change={handleImageSelect}
                class="mt-1 w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-muted file:text-foreground hover:file:bg-accent"
              />
              <p class="text-xs text-muted-foreground mt-1">
                Format: JPG, PNG, WebP. Maksimal 25MB
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <DialogFooter class="flex flex-col sm:flex-row gap-2 sm:gap-0 pt-4">
        <Button 
          variant="outline" 
          on:click={() => showAddEditDialog = false} 
          class="w-full sm:w-auto order-2 sm:order-1"
        >
          Batal
        </Button>
        <Button 
          on:click={handleSaveProduct} 
          disabled={isUploading} 
          class="w-full sm:w-auto order-1 sm:order-2"
        >
          {#if isUploading}
            <IconWrapper icon={Upload} className="mr-2 h-4 w-4 animate-spin" />
            Mengupload...
          {:else}
            <IconWrapper icon={editingProduct ? Edit : PlusCircle} className="mr-2 h-4 w-4" />
            {editingProduct ? "Update Produk" : "Tambah Produk"}
          {/if}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/if}

{#if showHardDeleteDialog && deleteTargetProduct}
  <Dialog open={showHardDeleteDialog} onOpenChange={(open) => { if (!open) showHardDeleteDialog = false; }}>
    <DialogContent class="w-full max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-destructive">
          <IconWrapper icon={AlertTriangle} className="h-5 w-5" />
          Hapus Produk Secara Permanen
        </DialogTitle>
        <DialogDescription class="text-left">
          <div class="space-y-3">
            <div class="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p class="text-destructive font-medium mb-2">⚠️ PERINGATAN KERAS ⚠️</p>
              <p class="text-destructive text-sm">
                Anda akan menghapus produk secara PERMANEN dari database.
                Tindakan ini TIDAK DAPAT dibatalkan!
              </p>
            </div>
            
            <div class="bg-muted border border-border rounded-lg p-3">
              <p class="font-medium text-foreground mb-1">Produk yang akan dihapus:</p>
              <p class="text-lg font-bold text-foreground">"{deleteTargetProduct.name}"</p>
              <p class="text-sm text-muted-foreground mt-1">ID: {deleteTargetProduct.id}</p>
            </div>

            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p class="text-yellow-800 text-sm">
                <strong>Catatan:</strong> Riwayat transaksi akan tetap tersimpan untuk keperluan audit,
                tetapi data produk akan dihapus dari sistem.
              </p>
            </div>
          </div>
        </DialogDescription>
      </DialogHeader>
      
      <div class="space-y-4 py-4">
        <div>
          <Label for="delete-password" class="text-sm font-medium text-destructive">
            Masukkan Password Anda untuk Konfirmasi *
          </Label>
          <Input 
            id="delete-password"
            type="password" 
            bind:value={deletePassword}
            placeholder="Password superadmin Anda..."
            class="mt-1 border-destructive/30 focus:border-destructive focus:ring-destructive"
            disabled={isDeleting}
          />
          <p class="text-xs text-destructive mt-1">
            Password diperlukan untuk verifikasi identitas superadmin
          </p>
        </div>
        
        <div class="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          <p class="text-destructive text-sm font-medium mb-2">Konsekuensi penghapusan:</p>
          <ul class="text-destructive text-xs space-y-1">
            <li>• Produk hilang dari database secara permanen</li>
            <li>• Tidak bisa melakukan restore/undo</li>
            <li>• Gambar produk di Cloudinary akan ikut terhapus</li>
            <li>• Riwayat transaksi tetap ada untuk audit</li>
          </ul>
        </div>
      </div>
      
      <DialogFooter class="flex flex-col sm:flex-row gap-2">
        <Button 
          variant="outline" 
          on:click={() => showHardDeleteDialog = false}
          disabled={isDeleting}
          class="w-full sm:w-auto"
        >
          Batal
        </Button>
        <Button 
          variant="destructive" 
          on:click={handleHardDelete}
          disabled={isDeleting || !deletePassword.trim()}
          class="w-full sm:w-auto"
        >
          {#if isDeleting}
            <IconWrapper icon={Clock} className="mr-2 h-4 w-4 animate-spin" />
            Menghapus...
          {:else}
            <IconWrapper icon={Trash2} className="mr-2 h-4 w-4" />
            Hapus Permanen
          {/if}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/if}

{#if showToggleActiveDialog && toggleTargetProduct}
  <Dialog open={showToggleActiveDialog} onOpenChange={(open) => { if (!open) showToggleActiveDialog = false; }}>
    <DialogContent class="w-full max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-orange-600">
          <IconWrapper icon={AlertTriangle} className="h-5 w-5" />
          Konfirmasi Perubahan Status
        </DialogTitle>
        <DialogDescription class="text-left">
          <div class="space-y-3">
            <div class="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p class="text-orange-800 font-medium mb-2">
                {toggleTargetProduct.is_active ? 'Nonaktifkan produk ini?' : 'Aktifkan produk ini?'}
              </p>
              <p class="text-orange-700 text-sm">
                {toggleTargetProduct.is_active 
                  ? 'Produk tidak akan muncul di kasir' 
                  : 'Produk akan muncul kembali di kasir'}
              </p>
            </div>
            
            <div class="bg-muted border border-border rounded-lg p-3">
              <p class="font-medium text-foreground mb-1">Produk:</p>
              <p class="text-lg font-bold text-foreground">"{toggleTargetProduct.name}"</p>
              <p class="text-sm text-muted-foreground">Status saat ini: {toggleTargetProduct.is_active ? 'Aktif' : 'Nonaktif'}</p>
            </div>
          </div>
        </DialogDescription>
      </DialogHeader>
      
      <DialogFooter class="flex flex-col sm:flex-row gap-2">
        <Button 
          variant="outline" 
          on:click={() => { showToggleActiveDialog = false; toggleTargetProduct = null; }}
          disabled={isTogglingActive}
          class="w-full sm:w-auto"
        >
          Batal
        </Button>
        <Button 
          variant={toggleTargetProduct.is_active ? "destructive" : "default"}
          on:click={confirmToggleActive}
          disabled={isTogglingActive}
          class="w-full sm:w-auto"
        >
          {#if isTogglingActive}
            <IconWrapper icon={Clock} className="mr-2 h-4 w-4 animate-spin" />
            Memproses...
          {:else}
            <IconWrapper icon={toggleTargetProduct.is_active ? PowerOff : Power} className="mr-2 h-4 w-4" />
            {toggleTargetProduct.is_active ? 'Nonaktifkan' : 'Aktifkan'}
          {/if}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/if}

