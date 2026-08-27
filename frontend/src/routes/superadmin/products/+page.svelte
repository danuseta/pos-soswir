<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { browser } from '$app/environment';
  import AlertMessage from "$lib/components/AlertMessage.svelte";
  import { useAlert } from "$lib/composables/useAlert";
  import ProductActionsController from '$lib/components/products/ProductActionsController.svelte';
  import ProductFormDialog from '$lib/components/products/ProductFormDialog.svelte';
  import ProductManagementTable from '$lib/components/products/ProductManagementTable.svelte';
  import ProductFilters from '$lib/components/products/ProductFilters.svelte';
  import ProductPageHeader from '$lib/components/products/ProductPageHeader.svelte';
  import { loadProductPageData, loadProducts as fetchProducts, saveProduct, uploadProductImage } from '$lib/services/productService';
  import { createEditableProduct, createProductForm, createProductPayload, filterAndSortProducts, validateProduct } from '$lib/utils/product';

  let products = [];
  let categories = [];
  let suppliers = [];
  let isLoading = true;
  let error = null;

  const { showAlertMessage } = useAlert();

  let showAddEditDialog = false;
  let editingProduct = null;
  let currentProduct = createProductForm();

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

  let productActions: ProductActionsController;

  async function uploadImage() {
    if (!imageFile) return null;
    
    isUploading = true;
    showAlertMessage('info', 'Mengunggah gambar...');
    
    try {
      const data = await uploadProductImage(imageFile);
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
      
      
      const data = await loadProductPageData();
      products = data.products;
      categories = data.categories;
      suppliers = data.suppliers;
      
      isLoading = false;
      
    } catch (err) {
      console.error("Error loading data:", err);
      error = err.message;
      showAlertMessage('error', `Gagal memuat data: ${err.message}`);
      isLoading = false;
    }
  });

  function openAddDialog() {
    editingProduct = null;
    currentProduct = createProductForm(categories[0]?.id || null);
    imageFile = null;
    imagePreview = "";
    cloudinaryPublicId = null;
    showAddEditDialog = true;
  }

  function openEditDialog(product) {
    editingProduct = product;
    currentProduct = createEditableProduct(product);
    imageFile = null;
    imagePreview = product.image_url || "";
    cloudinaryPublicId = product.cloudinary_public_id || null;
    showAddEditDialog = true;
  }

  async function handleSaveProduct() {
    try {
      const validationError = validateProduct(currentProduct, isResellerCategory, suppliers);
      if (validationError) return showAlertMessage('error', validationError);

      showAlertMessage('info', editingProduct ? "Memperbarui produk..." : "Menambah produk baru...");

      let imageUrl = currentProduct.image_url;
      let publicId = cloudinaryPublicId;
      
      if (imageFile) {
        imageUrl = await uploadImage();
        publicId = cloudinaryPublicId;
        if (imageUrl === null) return;
      }
      
      const productData = createProductPayload(currentProduct, isResellerCategory, Boolean(editingProduct), imageUrl, publicId);
      await saveProduct(editingProduct?.id || null, productData);

      await loadProducts();
      showAddEditDialog = false;
      showAlertMessage('success', editingProduct ? "Produk berhasil diperbarui." : "Produk baru berhasil ditambahkan.");
    } catch (err) {
      console.error("Error saving product:", err);
      showAlertMessage('error', `Error: ${err.message}`);
    }
  }

  async function loadProducts() {
    try {
      products = await fetchProducts(categories, suppliers);
    } catch (err) {
      console.error("Error loading products:", err);
      showAlertMessage('error', `Gagal memuat produk: ${err.message}`);
    }
  }

  $: filteredProducts = filterAndSortProducts(products, searchTerm, categoryFilter, stockFilter, sortField, sortDirection);

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

</script>

<div class="flex-1 space-y-4 p-4 md:p-8 pt-6 max-w-full overflow-hidden">
  <ProductPageHeader onRefresh={loadProducts} onAdd={openAddDialog} />

  <AlertMessage />

  <ProductFilters bind:searchTerm bind:categoryFilter bind:stockFilter bind:sortField {sortDirection} {categories} filteredCount={filteredProducts.length} totalCount={products.length} onReset={clearFilters} onSort={toggleSort} />

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
    <ProductManagementTable products={paginatedProducts} totalItems={filteredProducts.length} allProductsCount={products.length} {currentPage} {itemsPerPage} {sortField} {sortDirection} onSort={toggleSort} onPageChange={handlePageChange} onItemsPerPageChange={handleItemsPerPageChange} onAddStock={(product) => productActions.openAddStock(product)} onEdit={openEditDialog} onToggle={(product) => productActions.openToggle(product)} onDelete={(product) => productActions.openDelete(product)} />
  {/if}
</div>

<ProductFormDialog open={showAddEditDialog} bind:product={currentProduct} {categories} {suppliers} isEditing={Boolean(editingProduct)} isReseller={isResellerCategory} bind:imageFile bind:imagePreview {isUploading} onClose={() => showAddEditDialog = false} onSave={handleSaveProduct} />

<ProductActionsController
  bind:this={productActions}
  onStockUpdated={(id, stock) => products = products.map((product) => product.id === id ? { ...product, stock } : product)}
  onDeleted={(id) => products = products.filter((product) => product.id !== id)}
  onToggled={(id, active) => products = products.map((product) => product.id === id ? { ...product, is_active: active } : product)}
/>
