<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
  import { Badge } from "$lib/components/ui/badge";
  import { Edit, Trash2, Users, Phone, Package, Eye, SortAsc, SortDesc, ArrowUpDown } from "lucide-svelte";
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
  import { formatCurrency } from "$lib/utils/format";
  import SupplierFormDialog from '$lib/components/suppliers/SupplierFormDialog.svelte';
  import SupplierHistoryDialog from '$lib/components/suppliers/SupplierHistoryDialog.svelte';
  import SupplierPageHeader from '$lib/components/suppliers/SupplierPageHeader.svelte';
  import ListFilters from '$lib/components/ListFilters.svelte';
  import { createSupplierForm, createSupplierPayload, filterAndSortSuppliers } from '$lib/utils/managementLists';

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
  let currentSupplier = createSupplierForm();

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
      suppliers = await apiData(api.get('/api/suppliers'));
    } catch (err) {
      console.error("Error loading suppliers:", err);
      showAlertMessage('error', `Gagal memuat supplier: ${err.message}`);
    }
  }

  function openAddDialog() {
    editingSupplier = null;
    currentSupplier = createSupplierForm();
    showAddEditDialog = true;
  }

  function openEditDialog(supplier) {
    editingSupplier = supplier;
    currentSupplier = createSupplierForm(supplier);
    showAddEditDialog = true;
  }

  async function handleSaveSupplier() {
    try {
      if (!currentSupplier.name || currentSupplier.name.trim() === '') {
        showAlertMessage('error', "Nama supplier tidak boleh kosong");
        return;
      }

      showAlertMessage('info', editingSupplier ? "Memperbarui supplier..." : "Menambah supplier baru...");

      const supplierData = createSupplierPayload(currentSupplier);
      
      if (editingSupplier) {
        await apiData(api.put(`/api/suppliers/${editingSupplier.id}`, supplierData));
      } else {
        await apiData(api.post('/api/suppliers', supplierData));
      }

      await loadSuppliers();
      showAddEditDialog = false;
      showAlertMessage('success', editingSupplier ? "Supplier berhasil diperbarui." : "Supplier baru berhasil ditambahkan.");
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
      
      await apiData(api.delete(`/api/suppliers/${supplierId}`));
      await loadSuppliers();
      showAlertMessage('success', "Supplier berhasil dihapus.");
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
      supplierHistory = await apiData(api.get(`/api/suppliers/${supplier.id}/history`));
    } catch (err) {
      console.error("Error loading supplier history:", err);
      showAlertMessage('error', `Gagal memuat riwayat: ${err.message}`);
    } finally {
      historyLoading = false;
    }
  }

  $: filteredSuppliers = filterAndSortSuppliers(suppliers, searchTerm, sortField, sortDirection);

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
  <SupplierPageHeader onAdd={openAddDialog} />

  <AlertMessage />

  <ListFilters bind:searchTerm bind:sortField {sortDirection} searchPlaceholder="Cari supplier..." sortOptions={[{ value: 'name', label: 'Nama' }, { value: 'phone', label: 'Telepon' }, { value: 'created_at', label: 'Tanggal Dibuat' }]} filteredCount={filteredSuppliers.length} totalCount={suppliers.length} itemLabel="supplier" onClear={clearFilters} onSort={toggleSort} />

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
                        <IconWrapper icon={Phone} className="h-4 w-4 text-primary" />
                        <span>{supplier.phone}</span>
                      </div>
                    {:else}
                      <span class="text-muted-foreground text-sm">-</span>
                    {/if}
                  </TableCell>
                  <TableCell class="text-center">
                    <div class="flex items-center justify-center gap-1">
                      <IconWrapper icon={Package} className="h-4 w-4 text-primary" />
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
                    <RowActions>
                      <RowActionItem icon={Eye} label="Lihat Riwayat" on:click={() => openSupplierHistory(supplier)} />
                      <RowActionItem icon={Edit} label="Edit" on:click={() => openEditDialog(supplier)} />
                      <RowActionItem icon={Trash2} label="Hapus" danger on:click={() => handleDeleteSupplier(supplier.id)} />
                    </RowActions>
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

<SupplierFormDialog open={showAddEditDialog} supplier={currentSupplier} isEditing={Boolean(editingSupplier)} onClose={() => showAddEditDialog = false} onSave={handleSaveSupplier} />

<SupplierHistoryDialog open={showHistoryDialog} supplier={selectedSupplier} history={supplierHistory} isLoading={historyLoading} onClose={() => showHistoryDialog = false} />
