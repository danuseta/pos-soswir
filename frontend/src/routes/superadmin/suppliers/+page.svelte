<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "$lib/components/ui/dialog";
  import { Label } from "$lib/components/ui/label";
  import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
  import { Badge } from "$lib/components/ui/badge";
  import { PlusCircle, Edit, Trash2, Users, Search, Phone, Package, Eye, Calendar, DollarSign, TrendingUp, Filter, SortAsc, SortDesc, ArrowUpDown } from "lucide-svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { BACKEND_URL, getAuthHeaders } from "$lib/apiConfig";
  import { browser } from '$app/environment';
  import IconWrapper from "$lib/components/IconWrapper.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import AlertMessage from "$lib/components/AlertMessage.svelte";
  import { useAlert } from "$lib/composables/useAlert";

  let suppliers = [];
  let isLoading = true;
  let error = null;

  let currentPage = 1;
  let itemsPerPage = 10;
  let searchTerm = "";
  let sortField = 'name';
  let sortDirection = 'asc';

  const { showAlertMessage } = useAlert();

  let showAddEditDialog = false;
  let editingSupplier = null;
  let currentSupplier = {
    id: null,
    name: "",
    phone: ""
  };

  let showHistoryDialog = false;
  let selectedSupplier = null;
  let supplierHistory = [];
  let historyLoading = false;



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
      
      await loadSuppliers();
      isLoading = false;
    } catch (err) {
      console.error("Error loading suppliers:", err);
      error = err.message;
      showAlertMessage('error', `Gagal memuat data: ${err.message}`);
      isLoading = false;
    }
  });

  async function loadSuppliers() {
    try {
      showAlertMessage('info', 'Memuat data supplier...');
      
      const response = await fetch(`${BACKEND_URL}/api/suppliers`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        suppliers = await response.json();
        showAlertMessage('success', `Berhasil memuat ${suppliers.length} supplier`);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal memuat data supplier");
      }
    } catch (err) {
      console.error("Error loading suppliers:", err);
      showAlertMessage('error', `Gagal memuat supplier: ${err.message}`);
    }
  }

  function openAddDialog() {
    editingSupplier = null;
    currentSupplier = { 
      id: null, 
      name: "", 
      phone: ""
    };
    showAddEditDialog = true;
  }

  function openEditDialog(supplier) {
    editingSupplier = supplier;
    currentSupplier = { ...supplier };
    showAddEditDialog = true;
  }

  async function handleSaveSupplier() {
    try {
      if (!currentSupplier.name || currentSupplier.name.trim() === '') {
        showAlertMessage('error', "Nama supplier tidak boleh kosong");
        return;
      }

      showAlertMessage('info', editingSupplier ? "Memperbarui supplier..." : "Menambah supplier baru...");

      const supplierData = {
        name: currentSupplier.name.trim(),
        phone: currentSupplier.phone || null
      };
      
      let response;
      
      if (editingSupplier) {
        response = await fetch(`${BACKEND_URL}/api/suppliers/${editingSupplier.id}`, {
          method: 'PUT',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(supplierData)
        });
      } else {
        response = await fetch(`${BACKEND_URL}/api/suppliers`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(supplierData)
        });
      }
      
      if (response.ok) {
        await loadSuppliers();
        showAddEditDialog = false;
        showAlertMessage('success', editingSupplier ? "Supplier berhasil diperbarui." : "Supplier baru berhasil ditambahkan.");
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal menyimpan supplier.");
      }
    } catch (err) {
      console.error("Error saving supplier:", err);
      showAlertMessage('error', `Error: ${err.message}`);
    }
  }

  async function handleDeleteSupplier(supplierId) {
    try {
      if (!confirm("Yakin ingin menghapus supplier ini? Data yang terkait akan dinonaktifkan.")) {
        return;
      }

      showAlertMessage('info', "Menghapus supplier...");
      
      const response = await fetch(`${BACKEND_URL}/api/suppliers/${supplierId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        await loadSuppliers();
        showAlertMessage('success', "Supplier berhasil dihapus.");
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal menghapus supplier.");
      }
    } catch (err) {
      console.error("Error deleting supplier:", err);
      showAlertMessage('error', `Error: ${err.message}`);
    }
  }

  async function openSupplierHistory(supplier) {
    selectedSupplier = supplier;
    showHistoryDialog = true;
    historyLoading = true;
    supplierHistory = [];

    try {
      const response = await fetch(`${BACKEND_URL}/api/suppliers/${supplier.id}/history`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        supplierHistory = await response.json();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal memuat riwayat supplier");
      }
    } catch (err) {
      console.error("Error loading supplier history:", err);
      showAlertMessage('error', `Gagal memuat riwayat: ${err.message}`);
    } finally {
      historyLoading = false;
    }
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  }

  function calculateSupplierEstimatedRevenue() {
    if (!supplierHistory || supplierHistory.length === 0) return 0;
    
    return supplierHistory.reduce((total, history) => {
      const supplierEarning = parseFloat(history.supplier_earning || 0);
      return total + (isNaN(supplierEarning) ? 0 : supplierEarning);
    }, 0);
  }

  function calculateStoreEstimatedFee() {
    if (!supplierHistory || supplierHistory.length === 0) return 0;
    
    return supplierHistory.reduce((total, history) => {
      const storeFee = parseFloat(history.store_fee || 0);
      return total + (isNaN(storeFee) ? 0 : storeFee);
    }, 0);
  }

  $: filteredSuppliers = suppliers
    .filter(s => {
      const searchLower = searchTerm.toLowerCase();
      return s.name.toLowerCase().includes(searchLower) ||
             (s.phone && s.phone.includes(searchTerm));
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

  $: paginatedSuppliers = (() => {
    if (itemsPerPage >= filteredSuppliers.length) {
      return filteredSuppliers;
    }
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredSuppliers.slice(start, end);
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
    sortField = 'name';
    sortDirection = 'asc';
    currentPage = 1;
  }
</script>

<div class="flex-1 space-y-4 p-4 md:p-8 pt-6">
  <div class="flex items-center justify-between space-y-2">
    <h2 class="text-3xl font-bold tracking-tight">Manajemen Supplier PUBJ</h2>
    <Button 
      on:click={openAddDialog}
    >
      <IconWrapper icon={PlusCircle} className="mr-2 h-4 w-4" />
      Tambah Supplier
    </Button>
  </div>

  <AlertMessage />

  <div class="bg-card rounded-lg shadow p-4">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <div class="flex items-center gap-2">
        <IconWrapper icon={Search} className="h-5 w-5 text-muted-foreground" />
        <Input 
          type="text" 
          placeholder="Cari supplier..." 
          bind:value={searchTerm} 
        />
      </div>
      
      <div class="flex gap-2">
        <Button 
          variant="outline" 
          on:click={clearFilters} 
          size="sm"
        >
          <IconWrapper icon={Filter} className="mr-2 h-4 w-4" />
          Reset Filter
        </Button>
      </div>
    </div>
    
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm text-muted-foreground">
      <span class="flex-shrink-0">Menampilkan {filteredSuppliers.length} dari {suppliers.length} supplier</span>
      <div class="flex items-center gap-2 flex-shrink-0">
        <span class="hidden sm:inline">Urutkan:</span>
        <select 
          bind:value={sortField}
          class="px-2 py-1 border rounded text-sm bg-background"
        >
          <option value="name">Nama</option>
          <option value="phone">Telepon</option>
          <option value="created_at">Tanggal Dibuat</option>
        </select>
        <Button 
          variant="outline" 
          size="sm"
          on:click={() => toggleSort(sortField)}
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
        <p>Memuat data supplier...</p>
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
      <ScrollArea class="h-[calc(100vh-340px)]" orientation="both">
        <div class="min-w-[800px] p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-[80px] text-center">No.</TableHead>
                <TableHead class="cursor-pointer text-center" on:click={() => toggleSort('name')}>
                  <div class="flex items-center justify-center">
                    Nama Supplier
                    <IconWrapper 
                      icon={sortField === 'name' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                    />
                  </div>
                </TableHead>
                <TableHead class="text-center">No. Telepon</TableHead>
                <TableHead class="text-center">Produk</TableHead>
                <TableHead class="text-center">Total Pendapatan</TableHead>
                <TableHead class="text-center">Status</TableHead>
                <TableHead class="text-center w-[120px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {#each paginatedSuppliers as supplier, index (supplier.id)}
                <TableRow>
                  <TableCell class="font-medium text-center">{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
                  <TableCell class="text-center">
                    <div class="flex items-center gap-2 justify-center">
                      <IconWrapper icon={Users} className="h-5 w-5 text-primary" />
                      <span class="font-medium">{supplier.name}</span>
                    </div>
                  </TableCell>
                  <TableCell class="text-center">
                    {#if supplier.phone}
                      <div class="flex items-center gap-2 justify-center">
                        <IconWrapper icon={Phone} className="h-4 w-4 text-success" />
                        <span>{supplier.phone}</span>
                      </div>
                    {:else}
                      <span class="text-muted-foreground text-sm">-</span>
                    {/if}
                  </TableCell>
                  <TableCell class="text-center">
                    <div class="flex items-center justify-center gap-1">
                      <IconWrapper icon={Package} className="h-4 w-4 text-orange-600" />
                      <span class="font-medium">{supplier.product_count || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell class="text-center font-mono">
                    {formatCurrency(supplier.total_earnings || 0)}
                  </TableCell>
                  <TableCell class="text-center">
                    <Badge variant={supplier.is_active ? 'default' : 'secondary'}>
                      {supplier.is_active ? 'Aktif' : 'Non-aktif'}
                    </Badge>
                  </TableCell>
                  <TableCell class="text-center">
                    <div class="flex justify-center space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        on:click={() => openSupplierHistory(supplier)} 
                        title="Lihat Riwayat"
                        class=""
                      >
                        <IconWrapper icon={Eye} className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" on:click={() => openEditDialog(supplier)} title="Edit">
                        <IconWrapper icon={Edit} className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="sm" on:click={() => handleDeleteSupplier(supplier.id)} title="Hapus">
                        <IconWrapper icon={Trash2} className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              {/each}
              {#if paginatedSuppliers.length === 0}
                <TableRow>
                  <TableCell colspan={7} class="h-24 text-center">
                    {filteredSuppliers.length === 0 && suppliers.length > 0 ? 'Tidak ada supplier yang sesuai dengan filter.' : 'Belum ada supplier yang tersedia.'}
                  </TableCell>
                </TableRow>
              {/if}
            </TableBody>
          </Table>
        </div>
      </ScrollArea>
      
      <Pagination 
        {currentPage}
        totalItems={filteredSuppliers.length}
        {itemsPerPage}
        onPageChange={handlePageChange}
        onItemsPerPageChange={handleItemsPerPageChange}
      />
    </div>
  {/if}
</div>

{#if showAddEditDialog}
  <Dialog open={showAddEditDialog} onOpenChange={(open) => { if (!open) showAddEditDialog = false; }}>
    <DialogContent class="w-full max-w-[95vw] sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>{editingSupplier ? "Edit Supplier" : "Tambah Supplier Baru"}</DialogTitle>
        <DialogDescription>
          {editingSupplier ? "Ubah informasi supplier di bawah ini." : "Isi informasi untuk supplier baru."}
        </DialogDescription>
      </DialogHeader>
      
      <div class="space-y-4 py-4">
        <div>
          <Label for="name" class="text-sm font-medium">Nama Supplier *</Label>
          <Input 
            id="name" 
            bind:value={currentSupplier.name} 
            placeholder="Masukkan nama supplier" 
            class="mt-1"
          />
        </div>
        
        <div>
          <Label for="phone" class="text-sm font-medium">No. Telepon</Label>
          <Input 
            id="phone" 
            bind:value={currentSupplier.phone} 
            placeholder="081234567890"
            class="mt-1"
          />
          <p class="text-xs text-muted-foreground mt-1">
            Nomor telepon untuk kontak supplier (opsional)
          </p>
        </div>
      </div>
      
      <DialogFooter class="flex flex-col sm:flex-row gap-2">
        <Button 
          variant="outline" 
          on:click={() => showAddEditDialog = false} 
          class="w-full sm:w-auto"
        >
          Batal
        </Button>
        <Button 
          on:click={handleSaveSupplier} 
          class="w-full sm:w-auto"
        >
          <IconWrapper icon={editingSupplier ? Edit : PlusCircle} className="mr-2 h-4 w-4" />
          {editingSupplier ? "Update Supplier" : "Tambah Supplier"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/if}

{#if showHistoryDialog && selectedSupplier}
  <Dialog open={showHistoryDialog} onOpenChange={(open) => { if (!open) showHistoryDialog = false; }}>
    <DialogContent class="w-full max-w-[95vw] lg:max-w-[900px] max-h-[90vh] overflow-hidden">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
                                  <IconWrapper icon={Eye} className="h-5 w-5 text-primary" />
          Riwayat Stok - {selectedSupplier.name}
        </DialogTitle>
        <DialogDescription>
          Riwayat stok masuk dan transaksi supplier beserta detail pendapatan
        </DialogDescription>
      </DialogHeader>
      
      <div class="space-y-4 py-4 overflow-y-auto max-h-[60vh]">
        {#if historyLoading}
          <div class="flex items-center justify-center py-8">
            <div class="text-center">
              <div class="inline-block animate-spin h-8 w-8 border-4 border-t-blue-500 border-r-transparent rounded-full mb-4"></div>
              <p class="text-sm text-muted-foreground">Memuat riwayat supplier...</p>
            </div>
          </div>
        {:else if supplierHistory.length === 0}
          <div class="text-center py-8">
            <IconWrapper icon={Package} className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p class="text-muted-foreground">Belum ada riwayat stok untuk supplier ini</p>
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <h4 class="font-medium text-primary mb-2 flex items-center gap-2">
                <IconWrapper icon={Calendar} className="h-4 w-4" />
                Rangkuman Historis
              </h4>
              <div class="text-sm text-primary">
                <p>Total produk berbeda: <strong>{new Set(supplierHistory.map(h => h.product_id)).size}</strong></p>
                <p>Total stok masuk: <strong>{supplierHistory.reduce((sum, h) => sum + (h.quantity_in || 0), 0)} unit</strong></p>
              </div>
            </div>
            
            <div class="bg-success/10 border border-success/20 rounded-lg p-4">
              <h4 class="font-medium text-success mb-2 flex items-center gap-2">
                <IconWrapper icon={DollarSign} className="h-4 w-4" />
                Estimasi Total Pendapatan Supplier
              </h4>
              <div class="text-sm text-success">
                <p>Jika semua produk terjual habis: <strong>{formatCurrency(calculateSupplierEstimatedRevenue())}</strong></p>
                <p class="text-xs mt-1 text-success">*Berdasarkan harga jual dikurangi fee toko</p>
              </div>
            </div>
            
            <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <h4 class="font-medium text-yellow-900 dark:text-yellow-100 mb-2 flex items-center gap-2">
                <IconWrapper icon={TrendingUp} className="h-4 w-4" />
                Estimasi Fee Toko
              </h4>
              <div class="text-sm text-yellow-800 dark:text-yellow-200">
                <p>Jika semua produk terjual habis: <strong>{formatCurrency(calculateStoreEstimatedFee())}</strong></p>
                <p class="text-xs mt-1 text-yellow-600 dark:text-yellow-400">*Total fee yang akan diterima toko</p>
              </div>
            </div>
          </div>

          <div class="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Produk</TableHead>
                  <TableHead class="text-center">Stok Masuk</TableHead>
                  <TableHead class="text-center">Terjual</TableHead>
                  <TableHead class="text-center">Sisa</TableHead>
                  <TableHead class="text-right">Pendapatan Supplier</TableHead>
                  <TableHead class="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {#each supplierHistory as history (history.id)}
                  <TableRow>
                    <TableCell>
                      <div class="flex items-center gap-2">
                        <IconWrapper icon={Calendar} className="h-4 w-4 text-primary" />
                        {new Date(history.entry_date).toLocaleDateString('id-ID')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div class="flex items-center gap-2">
                        <div class="w-8 h-8 bg-muted rounded flex items-center justify-center">
                          <IconWrapper icon={Package} className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span class="font-medium">{history.product_name}</span>
                      </div>
                    </TableCell>
                    <TableCell class="text-center font-medium">{history.quantity_in}</TableCell>
                    <TableCell class="text-center">
                                              <span class="font-medium text-success">{history.quantity_sold}</span>
                    </TableCell>
                    <TableCell class="text-center">
                      <span class="font-medium text-orange-600">{history.quantity_returned}</span>
                    </TableCell>
                    <TableCell class="text-right font-mono">
                      {formatCurrency(history.supplier_earning || 0)}
                    </TableCell>
                    <TableCell class="text-center">
                      <Badge variant={history.status === 'active' ? 'default' : history.status === 'completed' ? 'secondary' : 'outline'}>
                        {history.status === 'active' ? 'Aktif' : history.status === 'completed' ? 'Selesai' : 'Dikembalikan'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                {/each}
              </TableBody>
            </Table>
          </div>
        {/if}
      </div>
      
      <DialogFooter>
        <Button variant="outline" on:click={() => showHistoryDialog = false}>
          Tutup
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/if}
