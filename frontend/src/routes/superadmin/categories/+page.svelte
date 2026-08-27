<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
  import { PlusCircle, Edit, Trash2, Package, Store, Users, SortAsc, SortDesc, ArrowUpDown, UtensilsCrossed, Coffee, Truck } from "lucide-svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { api, apiData } from "$lib/apiConfig";
  import { browser } from '$app/environment';
  import IconWrapper from "$lib/components/IconWrapper.svelte";
  import RowActions from "$lib/components/RowActions.svelte";
  import RowActionItem from "$lib/components/RowActionItem.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import AlertMessage from "$lib/components/AlertMessage.svelte";
  import { useAlert } from "$lib/composables/useAlert";
  import CategoryFormDialog from '$lib/components/categories/CategoryFormDialog.svelte';
  import ListFilters from '$lib/components/ListFilters.svelte';
  import { filterAndSortCategories } from '$lib/utils/managementLists';

  let categories = [];
  let isLoading = true;
  let error = null;

  let currentPage = 1;
  let itemsPerPage = 10;
  let searchTerm = "";
  let sortField = 'name';
  let sortDirection = 'asc';
  let typeFilter = "";

  const { showAlertMessage } = useAlert();

  let showAddEditDialog = false;
  let editingCategory = null;
  let currentCategory = {
    id: null,
    name: "",
    description: "",
    is_reseller: false
  };



  onMount(async () => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_token") : null;
    const userRole = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_user_role") : null;
    
    if (!token || userRole !== 'superadmin') {
      goto("/login");
      return;
    }
    
    await loadCategories();
  });

  async function loadCategories() {
    try {
      if (!browser) {
        isLoading = false;
        return;
      }
      
      
      categories = await apiData(api.get('/api/categories'));
    } catch (err) {
      console.error("Error loading categories:", err);
      error = err.message;
      showAlertMessage('error', `Gagal memuat data: ${err.message}`);
    } finally {
      isLoading = false;
    }
  }

  function openAddDialog() {
    editingCategory = null;
    currentCategory = {
      id: null,
      name: "",
      description: "",
      is_reseller: false
    };
    showAddEditDialog = true;
  }

  function openEditDialog(category) {
    editingCategory = category;
    currentCategory = { ...category };
    showAddEditDialog = true;
  }

  async function handleSaveCategory() {
    try {
      if (!currentCategory.name.trim()) {
        showAlertMessage('error', "Nama kategori tidak boleh kosong");
        return;
      }

      showAlertMessage('info', editingCategory ? "Memperbarui kategori..." : "Menambah kategori baru...");

      const categoryData = {
        name: currentCategory.name.trim(),
        description: currentCategory.description.trim(),
        is_reseller: currentCategory.is_reseller
      };
      
      if (editingCategory) {
        await apiData(api.put(`/api/categories/${editingCategory.id}`, categoryData));
      } else {
        await apiData(api.post('/api/categories', categoryData));
      }

      await loadCategories();
      showAddEditDialog = false;
      showAlertMessage('success', editingCategory ? "Kategori berhasil diperbarui." : "Kategori baru berhasil ditambahkan.");
    } catch (err) {
      console.error("Error saving category:", err);
      showAlertMessage('error', `Error: ${err.message}`);
    }
  }

  async function handleDeleteCategory(categoryId) {
    try {
      showAlertMessage('info', "Menghapus kategori...");
      
      await apiData(api.delete(`/api/categories/${categoryId}`));
      await loadCategories();
      showAlertMessage('success', "Kategori berhasil dihapus.");
    } catch (err) {
      console.error("Error deleting category:", err);
      showAlertMessage('error', `Error: ${err.message}`);
    }
  }

  $: filteredCategories = filterAndSortCategories(categories, searchTerm, typeFilter, sortField, sortDirection);

  $: paginatedCategories = (() => {
    if (itemsPerPage >= filteredCategories.length) {
      return filteredCategories;
    }
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredCategories.slice(start, end);
  })();

  function handlePageChange(page: number) {
    currentPage = page;
  }

  function handleItemsPerPageChange(items: number) {
    itemsPerPage = items;
    currentPage = 1;
  }

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
    typeFilter = '';
    sortField = 'name';
    sortDirection = 'asc';
    currentPage = 1;
  }
</script>

<div class="flex-1 space-y-4 p-4 md:p-8 pt-6 max-w-full overflow-hidden">
  <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
    <h2 class="text-2xl md:text-3xl font-bold tracking-tight">Manajemen Kategori</h2>
    <Button 
      on:click={openAddDialog} 
        class="w-full sm:w-auto"
    >
      <IconWrapper icon={PlusCircle} className="mr-2 h-4 w-4" />
      Tambah Kategori
    </Button>
  </div>

  <AlertMessage />

  <ListFilters bind:searchTerm bind:secondaryValue={typeFilter} bind:sortField {sortDirection} searchPlaceholder="Cari kategori..." secondaryOptions={[{ value: '', label: 'Semua Tipe' }, { value: 'toko', label: 'Toko' }, { value: 'pubj', label: 'PUBJ (Penitipan)' }]} sortOptions={[{ value: 'name', label: 'Nama' }, { value: 'is_reseller', label: 'Tipe' }, { value: 'created_at', label: 'Tanggal Dibuat' }]} filteredCount={filteredCategories.length} totalCount={categories.length} itemLabel="kategori" onClear={clearFilters} onSort={toggleSort} />

  {#if isLoading}
    <div class="bg-card p-8 rounded-lg shadow flex justify-center">
      <div class="text-center">
        <div class="inline-block animate-spin h-8 w-8 border-4 border-t-primary border-r-transparent border-b-primary border-l-transparent rounded-full mb-4"></div>
        <p>Memuat data kategori...</p>
      </div>
    </div>
  {:else if error}
    <div class="bg-card p-8 rounded-lg shadow">
      <div class="text-center text-destructive">
        <p class="mb-2 font-semibold">Error:</p>
        <p>{error}</p>
        <Button class="mt-4" on:click={loadCategories}>Muat Ulang</Button>
      </div>
    </div>
  {:else}
    <div class="bg-card rounded-lg shadow border border-border overflow-hidden">
      <ScrollArea class="h-[calc(100vh-400px)]" orientation="both">
        <div class="min-w-[800px] p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-[60px] text-center">No.</TableHead>
                <TableHead class="cursor-pointer w-[200px] text-center" on:click={() => toggleSort('name')}>
                  <div class="flex items-center justify-center">
                    Nama Kategori
                    <IconWrapper 
                      icon={sortField === 'name' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                    />
                  </div>
                </TableHead>
                <TableHead class="text-center w-[120px]">Tipe</TableHead>
                <TableHead class="text-center w-[100px]">Produk</TableHead>
                <TableHead class="text-center w-[120px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {#each paginatedCategories as category, index (category.id)}
                <TableRow>
                  <TableCell class="font-medium text-center">{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
                  <TableCell class="w-[200px] text-center">
                    <div class="flex items-center gap-2 justify-center">
                      {#if category.name.toLowerCase() === 'makanan'}
                        <IconWrapper icon={UtensilsCrossed} className="h-5 w-5 text-primary" />
                      {:else if category.name.toLowerCase() === 'minuman'}
                        <IconWrapper icon={Coffee} className="h-5 w-5 text-primary" />
                      {:else if category.name.toLowerCase() === 'pubj'}
                        <IconWrapper icon={Truck} className="h-5 w-5 text-primary" />
                      {:else}
                        <IconWrapper icon={category.is_reseller ? Users : Store} className="h-5 w-5 {category.is_reseller ? 'text-primary' : 'text-primary'}" />
                      {/if}
                      <span class="font-medium truncate">{category.name}</span>
                    </div>
                  </TableCell>
                  <TableCell class="text-center">
                    <span class="text-sm font-medium text-foreground">
                      {category.is_reseller ? 'PUBJ' : 'Toko'}
                    </span>
                  </TableCell>
                  <TableCell class="text-center">
                    <div class="flex items-center justify-center gap-1">
                      <IconWrapper icon={Package} className="h-4 w-4 text-primary" />
                      <span class="font-medium">{category.product_count || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell class="text-center">
                    <RowActions>
                      <RowActionItem icon={Edit} label="Edit" on:click={() => openEditDialog(category)} />
                      <RowActionItem icon={Trash2} label="Hapus" danger on:click={() => handleDeleteCategory(category.id)} />
                    </RowActions>
                  </TableCell>
                </TableRow>
              {/each}
              {#if paginatedCategories.length === 0}
                <TableRow>
                  <TableCell colspan={5} class="h-24 text-center">
                    {filteredCategories.length === 0 && categories.length > 0 ? 'Tidak ada kategori yang sesuai dengan filter.' : 'Belum ada kategori yang tersedia.'}
                  </TableCell>
                </TableRow>
              {/if}
            </TableBody>
          </Table>
        </div>
      </ScrollArea>
      
      <Pagination 
        {currentPage}
        totalItems={filteredCategories.length}
        {itemsPerPage}
        onPageChange={handlePageChange}
        onItemsPerPageChange={handleItemsPerPageChange}
      />
    </div>
  {/if}
</div>

<CategoryFormDialog open={showAddEditDialog} category={currentCategory} isEditing={Boolean(editingCategory)} onClose={() => showAddEditDialog = false} onSave={handleSaveCategory} />
