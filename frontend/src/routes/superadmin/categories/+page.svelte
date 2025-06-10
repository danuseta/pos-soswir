<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "$lib/components/ui/dialog";
  import { Label } from "$lib/components/ui/label";
  import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
  import { Badge } from "$lib/components/ui/badge";
  import { Switch } from "$lib/components/ui/switch";
  import { PlusCircle, Edit, Trash2, Package, Store, Users, Search, Filter, SortAsc, SortDesc, ArrowUpDown, UtensilsCrossed, Coffee, Truck } from "lucide-svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { BACKEND_URL, getAuthHeaders } from "$lib/apiConfig";
  import { browser } from '$app/environment';
  import IconWrapper from "$lib/components/IconWrapper.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import AlertMessage from "$lib/components/AlertMessage.svelte";
  import { useAlert } from "$lib/composables/useAlert";

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
      
      showAlertMessage('info', 'Memuat data kategori...');
      
      const response = await fetch(`${BACKEND_URL}/api/categories`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        categories = await response.json();
        showAlertMessage('success', `Berhasil memuat ${categories.length} kategori`);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal memuat data kategori");
      }
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
      
      let response;
      
      if (editingCategory) {
        response = await fetch(`${BACKEND_URL}/api/categories/${editingCategory.id}`, {
          method: 'PUT',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(categoryData)
        });
      } else {
        response = await fetch(`${BACKEND_URL}/api/categories`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(categoryData)
        });
      }
      
      if (response.ok) {
        await loadCategories();
        showAddEditDialog = false;
        showAlertMessage('success', editingCategory ? "Kategori berhasil diperbarui." : "Kategori baru berhasil ditambahkan.");
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal menyimpan kategori.");
      }
    } catch (err) {
      console.error("Error saving category:", err);
      showAlertMessage('error', `Error: ${err.message}`);
    }
  }

  async function handleDeleteCategory(categoryId) {
    try {
      showAlertMessage('info', "Menghapus kategori...");
      
      const response = await fetch(`${BACKEND_URL}/api/categories/${categoryId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        await loadCategories();
        showAlertMessage('success', "Kategori berhasil dihapus.");
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal menghapus kategori.");
      }
    } catch (err) {
      console.error("Error deleting category:", err);
      showAlertMessage('error', `Error: ${err.message}`);
    }
  }

  $: filteredCategories = categories
    .filter(c => {
      const matchesSearch = 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesType = !typeFilter || 
        (typeFilter === "toko" && !c.is_reseller) ||
        (typeFilter === "pubj" && c.is_reseller);
      
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      let aValue = a[sortField] || '';
      let bValue = b[sortField] || '';
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

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

  <div class="bg-card rounded-lg shadow p-4 max-w-full">
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <div class="flex items-center gap-2 min-w-0">
        <IconWrapper icon={Search} className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <Input 
          type="text" 
          placeholder="Cari kategori..." 
          bind:value={searchTerm}
          class="min-w-0"
        />
      </div>
      
      <div>
        <select 
          bind:value={typeFilter}
          class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-w-0"
        >
          <option value="">Semua Tipe</option>
          <option value="toko">Toko</option>
          <option value="pubj">PUBJ (Penitipan)</option>
        </select>
      </div>
      
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
      <span class="flex-shrink-0">Menampilkan {filteredCategories.length} dari {categories.length} kategori</span>
      <div class="flex items-center gap-2 flex-shrink-0">
        <span class="hidden sm:inline">Urutkan:</span>
        <select 
          bind:value={sortField}
          class="px-2 py-1 border rounded text-sm bg-background min-w-0"
        >
          <option value="name">Nama</option>
          <option value="is_reseller">Tipe</option>
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
                        <IconWrapper icon={UtensilsCrossed} className="h-5 w-5 text-orange-600" />
                      {:else if category.name.toLowerCase() === 'minuman'}
                        <IconWrapper icon={Coffee} className="h-5 w-5 text-primary" />
                      {:else if category.name.toLowerCase() === 'pubj'}
                        <IconWrapper icon={Truck} className="h-5 w-5 text-purple-600" />
                      {:else}
                        <IconWrapper icon={category.is_reseller ? Users : Store} className="h-5 w-5 {category.is_reseller ? 'text-orange-600' : 'text-primary'}" />
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
                      <IconWrapper icon={Package} className="h-4 w-4 text-success" />
                      <span class="font-medium">{category.product_count || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell class="text-center">
                    <div class="flex justify-center space-x-1">
                      <Button variant="outline" size="sm" on:click={() => openEditDialog(category)} title="Edit">
                        <IconWrapper icon={Edit} className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="sm" on:click={() => handleDeleteCategory(category.id)} title="Hapus">
                        <IconWrapper icon={Trash2} className="h-4 w-4" />
                      </Button>
                    </div>
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

{#if showAddEditDialog}
  <Dialog open={showAddEditDialog} onOpenChange={(open) => { if (!open) showAddEditDialog = false; }}>
    <DialogContent class="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>{editingCategory ? "Edit Kategori" : "Tambah Kategori Baru"}</DialogTitle>
        <DialogDescription>
          {editingCategory ? "Ubah detail kategori di bawah ini." : "Isi detail untuk kategori baru."}
        </DialogDescription>
      </DialogHeader>
      <div class="grid gap-4 py-4">
        <div class="grid grid-cols-4 items-center gap-4">
          <Label for="name" class="text-right">Nama</Label>
          <Input id="name" bind:value={currentCategory.name} class="col-span-3" placeholder="Nama kategori" />
        </div>
        
        <div class="grid grid-cols-4 items-center gap-4">
          <Label for="description" class="text-right">Deskripsi</Label>
          <textarea 
            id="description" 
            bind:value={currentCategory.description} 
            class="col-span-3 flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
            placeholder="Deskripsi kategori (opsional)..."
          ></textarea>
        </div>
        
        <div class="grid grid-cols-4 items-center gap-4">
          <Label for="is_reseller" class="text-right">Jenis Kategori</Label>
          <div class="col-span-3 flex items-center space-x-2">
            <Switch id="is_reseller" bind:checked={currentCategory.is_reseller} />
            <Label for="is_reseller" class="text-sm">
              {currentCategory.is_reseller ? 'Penitipan/Reseller (PUBJ)' : 'Produk Toko'}
            </Label>
          </div>
        </div>
        
        {#if currentCategory.is_reseller}
          <div class="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
            <p class="text-sm text-orange-700 dark:text-orange-300 mb-2">
              <strong>Info PUBJ:</strong> Pajak akan ditentukan per produk saat menambah/edit produk dalam kategori ini.
            </p>
            <p class="text-xs text-orange-600 dark:text-orange-400">
              Contoh: Risol 10%, Tahu Isi 15%, Martabak 12%
            </p>
          </div>
        {/if}
      </div>
      <DialogFooter>
        <Button variant="outline" on:click={() => showAddEditDialog = false}>Batal</Button>
        <Button on:click={handleSaveCategory}>Simpan</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/if}

