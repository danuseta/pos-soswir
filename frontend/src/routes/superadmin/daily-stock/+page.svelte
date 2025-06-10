<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "$lib/components/ui/dialog";
  import { Label } from "$lib/components/ui/label";
  import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
  import { Badge } from "$lib/components/ui/badge";
  import { PlusCircle, Edit, Package, Users, Calendar, Clock, DollarSign, CheckCircle, XCircle, CheckCircle2, Search, Filter, SortAsc, SortDesc, ArrowUpDown } from "lucide-svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { BACKEND_URL, getAuthHeaders } from "$lib/apiConfig";
  import { browser } from '$app/environment';
  import IconWrapper from "$lib/components/IconWrapper.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import AlertMessage from "$lib/components/AlertMessage.svelte";
  import { useAlert } from "$lib/composables/useAlert";

  let dailyEntries = [];
  let products = [];
  let suppliers = [];
  let isLoading = true;
  let error = null;
  let userRole = '';

  let currentPage = 1;
  let itemsPerPage = 10;
  let searchTerm = "";
  let sortField = 'entry_date';
  let sortDirection = 'desc';

  const { showAlertMessage } = useAlert();

  let showAddEditDialog = false;
  let editingEntry = null;
  let currentEntry = {
    id: null,
    product_id: null,
    supplier_id: null,
    entry_date: new Date().toISOString().split('T')[0],
    quantity_in: 0,
    notes: ""
  };

  let showCompletionDialog = false;
  let completionEntry = null;

  let showGlobalCompletionDialog = false;
  let isGlobalCompleting = false;
  let globalCompletionData = {
    totalEntries: 0,
    totalProducts: 0,
    totalStock: 0
  };

  let showMarkPaidDialog = false;
  let markPaidEntry = null;

  let autoCompletionInterval = null;

  let selectedDate = "";
  let selectedSupplier = "";
  let selectedStatus = "";

  let filterTimeout;

  $: if (selectedDate !== undefined || selectedSupplier !== undefined || selectedStatus !== undefined) {
    if (browser && !isLoading) {
      if (filterTimeout) {
        clearTimeout(filterTimeout);
      }
      filterTimeout = setTimeout(() => {
        loadDailyEntries();
      }, 300);
    }
  }

  $: {
    if (browser && !isLoading) {
      if (filterTimeout) {
        clearTimeout(filterTimeout);
      }
      filterTimeout = setTimeout(() => {
        console.log('Filter changed - Date:', selectedDate, 'Supplier:', selectedSupplier, 'Status:', selectedStatus);
        loadDailyEntries();
      }, 300);
    }
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  }

  function formatDate(dateString) {
    if (!dateString) return 'Tanggal tidak valid';
    try {
      return new Date(dateString).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (e) {
      return 'Tanggal tidak valid';
    }
  }

  onMount(async () => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_token") : null;
    userRole = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_user_role") : null;
    
    if (!token || (userRole !== 'superadmin' && userRole !== 'cashier')) {
      goto("/login");
      return;
    }
    
    try {
      if (!browser) {
        isLoading = false;
        return;
      }
      
      await Promise.all([
        loadDailyEntries(),
        loadProducts(),
        loadSuppliers()
      ]);
      
      if (userRole === 'superadmin') {
        setupAutoCompletion();
      }
      
      isLoading = false;
    } catch (err) {
      console.error("Error loading data:", err);
      error = err.message;
      showAlertMessage('error', `Gagal memuat data: ${err.message}`);
      isLoading = false;
    }
  });

  function setupAutoCompletion() {
    autoCompletionInterval = setInterval(() => {
      const now = new Date();
      const nowWIB = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
      const hour = nowWIB.getHours();
      const minute = nowWIB.getMinutes();
      
      if (hour === 18 && minute === 0) {
        autoCompleteActiveEntries();
      }
    }, 60000);
    
    return () => {
      if (autoCompletionInterval) {
        clearInterval(autoCompletionInterval);
      }
    };
  }

  async function autoCompleteActiveEntries() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`${BACKEND_URL}/api/daily-stock/auto-complete`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ date: today })
      });

      if (response.ok) {
        const result = await response.json();
        showAlertMessage('info', `Auto-completion: ${result.completed_count} entry diselesaikan otomatis pada pukul 18:00`);
        await loadDailyEntries();
      }
    } catch (err) {
      console.error('Auto-completion error:', err);
    }
  }

  async function loadDailyEntries() {
    try {
      const params = new URLSearchParams();
      if (selectedDate) params.append('date', selectedDate);
      if (selectedSupplier) params.append('supplier_id', selectedSupplier);
      if (selectedStatus) params.append('status', selectedStatus);

      console.log('Loading daily entries with params:', params.toString());
      console.log('Selected date:', selectedDate, 'Type:', typeof selectedDate);
      
      const response = await fetch(`${BACKEND_URL}/api/daily-stock?${params}`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        dailyEntries = await response.json();
        console.log('Daily entries loaded:', dailyEntries.length, 'entries');
        if (selectedDate) {
          console.log('Entries with matching date:', dailyEntries.filter(e => e.entry_date === selectedDate).length);
          console.log('Sample entry dates:', dailyEntries.slice(0, 5).map(e => ({ id: e.id, entry_date: e.entry_date, product_name: e.product_name })));
        }
      } else {
        console.warn("Failed to load daily stock entries");
        dailyEntries = [];
      }
    } catch (err) {
      console.error("Error loading daily entries:", err);
      dailyEntries = [];
      if (typeof window !== 'undefined' && !isLoading) {
        showAlertMessage('error', `Gagal memuat data stok harian: ${err.message}`);
      }
    }
  }

  async function loadProducts() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/products`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const allProducts = await response.json();
        products = allProducts.filter(p => p.category_is_reseller);
      } else {
        console.warn("Failed to load products");
        products = [];
      }
    } catch (err) {
      console.warn("Error loading products:", err);
      products = [];
    }
  }

  async function loadSuppliers() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/suppliers`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        suppliers = await response.json();
      } else {
        console.warn("Failed to load suppliers");
        suppliers = [];
      }
    } catch (err) {
      console.warn("Error loading suppliers:", err);
      suppliers = [];
    }
  }

  function openAddDialog() {
    editingEntry = null;
    
    const now = new Date();
    const wibOffset = 7 * 60;
    const wibTime = new Date(now.getTime() + (wibOffset * 60 * 1000));
    const todayWIB = wibTime.toISOString().split('T')[0];
    
    currentEntry = {
      id: null,
      product_id: null,
      supplier_id: null,
      entry_date: selectedDate || todayWIB,
      quantity_in: 0,
      notes: ""
    };
    showAddEditDialog = true;
  }

  function openEditDialog(entry) {
    editingEntry = entry;
    currentEntry = {
      id: entry.id,
      product_id: entry.product_id,
      supplier_id: entry.supplier_id,
      entry_date: entry.entry_date,
      quantity_in: entry.quantity_in,
      notes: entry.notes || ""
    };
    showAddEditDialog = true;
  }

  async function handleSaveEntry() {
    try {
      if (!currentEntry.product_id || !currentEntry.supplier_id || !currentEntry.quantity_in) {
        showAlertMessage('error', "Semua field wajib harus diisi");
        return;
      }

      if (currentEntry.quantity_in <= 0) {
        showAlertMessage('error', "Jumlah stok harus lebih dari 0");
        return;
      }

      showAlertMessage('info', editingEntry ? "Memperbarui entry..." : "Menambah entry baru...");

      const entryData = {
        product_id: currentEntry.product_id,
        supplier_id: currentEntry.supplier_id,
        entry_date: currentEntry.entry_date,
        quantity_in: parseInt(String(currentEntry.quantity_in)),
        notes: currentEntry.notes || null
      };
      
      let response;
      
      if (editingEntry) {
        response = await fetch(`${BACKEND_URL}/api/daily-stock/${editingEntry.id}`, {
          method: 'PUT',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(entryData)
        });
      } else {
        response = await fetch(`${BACKEND_URL}/api/daily-stock`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(entryData)
        });
      }
      
      if (response.ok) {
        await loadDailyEntries();
        showAddEditDialog = false;
        showAlertMessage('success', editingEntry ? "Entry berhasil diperbarui." : "Entry baru berhasil ditambahkan.");
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal menyimpan entry.");
      }
    } catch (err) {
      console.error("Error saving entry:", err);
      showAlertMessage('error', `Error: ${err.message}`);
    }
  }

  function openMarkPaidDialog(entry) {
    markPaidEntry = entry;
    showMarkPaidDialog = true;
  }

  async function confirmMarkAsPaid() {
    try {
      if (!markPaidEntry) return;

      const response = await fetch(`${BACKEND_URL}/api/daily-stock/${markPaidEntry.id}/paid`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        showMarkPaidDialog = false;
        markPaidEntry = null;
        await loadDailyEntries();
        showAlertMessage('success', "Entry ditandai sudah dibayar.");
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal mengupdate status pembayaran.");
      }
    } catch (err) {
      console.error("Error marking as paid:", err);
      showAlertMessage('error', `Error: ${err.message}`);
    }
  }

  $: {
    if (browser && !isLoading) {
      clearTimeout(filterTimeout);
      filterTimeout = setTimeout(() => {
        loadDailyEntries().catch(err => {
          console.error("Error in reactive loadDailyEntries:", err);
          showAlertMessage('error', `Error memuat data: ${err.message}`);
        });
      }, 300);
    }
  }

  $: availableProducts = currentEntry.supplier_id ? 
    products.filter(p => p.supplier_id === parseInt(currentEntry.supplier_id)) : 
    products;

  function openCompletionDialog(entry) {
    completionEntry = entry;
    showCompletionDialog = true;
  }

  async function completeEntry() {
    if (!completionEntry) return;

    try {
      showAlertMessage('info', 'Menyelesaikan stok harian...');

      const response = await fetch(`${BACKEND_URL}/api/daily-stock/${completionEntry.id}/complete`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        showCompletionDialog = false;
        showAlertMessage('success', `Stok harian "${completionEntry.product_name}" berhasil diselesaikan. Sisa ${result.quantity_returned} unit dikembalikan ke supplier.`);
        await loadDailyEntries();
        
        completionEntry = null;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Gagal menyelesaikan stok harian');
      }
    } catch (err) {
      console.error('Error completing entry:', err);
      showAlertMessage('error', `Error: ${err.message}`);
    }
  }

  function openGlobalCompletionDialog() {
    const now = new Date();
    const wibOffset = 7 * 60;
    const wibTime = new Date(now.getTime() + (wibOffset * 60000));
    const today = wibTime.toISOString().split('T')[0];
    
    const activeToday = dailyEntries.filter(entry => {
      const entryDate = entry.entry_date ? entry.entry_date.split('T')[0] : '';
      return entry.status === 'active' && entryDate === today;
    });
    
    console.log('Open global completion dialog - Today (WIB):', today);
    console.log('Active entries today:', activeToday.length);
    
    if (activeToday.length === 0) {
      showAlertMessage('info', 'Tidak ada entry aktif untuk hari ini yang perlu diselesaikan');
      return;
    }
    
    updateGlobalCompletionData();
    showGlobalCompletionDialog = true;
  }

  async function completeAllEntries() {
    try {
      showAlertMessage('info', 'Menyelesaikan semua stok harian aktif...');

      const now = new Date();
      const wibOffset = 7 * 60;
      const wibTime = new Date(now.getTime() + (wibOffset * 60000));
      const today = wibTime.toISOString().split('T')[0];
      
      console.log('Complete all entries - Today (WIB):', today);
      
      const response = await fetch(`${BACKEND_URL}/api/daily-stock/auto-complete`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ date: today })
      });

      if (response.ok) {
        const result = await response.json();
        showGlobalCompletionDialog = false;
        showAlertMessage('success', `${result.completed_count} entry berhasil diselesaikan untuk hari ini`);
        await loadDailyEntries();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Gagal menyelesaikan semua stok harian');
      }
    } catch (err) {
      console.error('Error completing all entries:', err);
      showAlertMessage('error', `Error: ${err.message}`);
    }
  }

  async function confirmGlobalCompletion() {
    isGlobalCompleting = true;
    try {
      await completeAllEntries();
    } finally {
      isGlobalCompleting = false;
    }
  }

  function updateGlobalCompletionData() {
    const now = new Date();
    const wibOffset = 7 * 60;
    const wibTime = new Date(now.getTime() + (wibOffset * 60000));
    const today = wibTime.toISOString().split('T')[0];
    
    const activeToday = dailyEntries.filter(entry => {
      const entryDate = entry.entry_date ? entry.entry_date.split('T')[0] : '';
      return entry.status === 'active' && entryDate === today;
    });
    
    console.log('Update global completion data - Today (WIB):', today);
    console.log('Active entries today:', activeToday.length);
    
    globalCompletionData = {
      totalEntries: activeToday.length,
      totalProducts: new Set(activeToday.map(e => e.product_id)).size,
      totalStock: activeToday.reduce((sum, e) => sum + e.quantity_in, 0)
    };
  }

  $: filteredEntries = dailyEntries
    .filter(entry => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        entry.product_name.toLowerCase().includes(searchLower) ||
        entry.supplier_name.toLowerCase().includes(searchLower);
      
      const entryDate = entry.entry_date ? entry.entry_date.split('T')[0] : '';
      const matchesDate = !selectedDate || entryDate === selectedDate;
      
      if (selectedDate && entry.id === 1) {
        console.log('Date filtering debug:', {
          selectedDate,
          entry_date_raw: entry.entry_date,
          entryDate_extracted: entryDate,
          matchesDate
        });
      }
      
      const matchesSupplier = !selectedSupplier || entry.supplier_id.toString() === selectedSupplier;
      
      const matchesStatus = !selectedStatus || entry.status === selectedStatus;
      
      return matchesSearch && matchesDate && matchesSupplier && matchesStatus;
    })
    .sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      
      if (sortField === 'entry_date') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  $: paginatedEntries = (() => {
    if (itemsPerPage >= filteredEntries.length) {
      return filteredEntries;
    }
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredEntries.slice(start, end);
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
      sortDirection = field === 'entry_date' ? 'desc' : 'asc';
    }
  }

  function clearFilters() {
    selectedDate = "";
    selectedSupplier = "";
    selectedStatus = "";
    searchTerm = "";
    currentPage = 1;
  }
</script>

<div class="flex-1 space-y-4 p-4 md:p-8 pt-6 max-w-full overflow-hidden">
  <div class="flex flex-col gap-4">
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <h2 class="text-2xl md:text-3xl font-bold tracking-tight">Stok Harian PUBJ</h2>
      <div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <Button 
          variant="outline" 
          on:click={loadDailyEntries} 
          title="Refresh Data" 
          class="w-full sm:w-auto"
        >
          <IconWrapper icon={Package} className="mr-2 h-4 w-4" />
          Refresh
        </Button>
        <Button 
          on:click={openAddDialog} 
          class="w-full sm:w-auto"
        >
          <IconWrapper icon={PlusCircle} className="mr-2 h-4 w-4" />
          Tambah Entry
        </Button>
        <Button 
          variant="outline" 
          on:click={openGlobalCompletionDialog} 
          class="w-full sm:w-auto text-success border-success/20"
        >
          <IconWrapper icon={Calendar} className="mr-2 h-4 w-4" />
          <span class="whitespace-nowrap">Selesaikan Hari</span>
        </Button>
      </div>
    </div>
  </div>

  <AlertMessage />

  <div class="bg-card rounded-lg shadow p-4">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
      <div class="flex flex-col">
        <Label for="search-filter" class="text-sm font-medium mb-2">Pencarian</Label>
        <div class="flex items-center gap-2">
          <IconWrapper icon={Search} className="h-5 w-5 text-muted-foreground" />
          <Input 
            id="search-filter"
            type="text" 
            placeholder="Cari produk/supplier..." 
            bind:value={searchTerm} 
          />
        </div>
      </div>
      
      <div class="flex flex-col">
        <Label for="date-filter" class="text-sm font-medium mb-2">Tanggal</Label>
        <Input 
          id="date-filter"
          type="date" 
          bind:value={selectedDate}
        />
      </div>
      
      <div class="flex flex-col">
        <Label for="supplier-filter" class="text-sm font-medium mb-2">Supplier</Label>
        <select 
          id="supplier-filter"
          bind:value={selectedSupplier}
          class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Semua Supplier</option>
          {#each suppliers as supplier}
            <option value={supplier.id}>{supplier.name}</option>
          {/each}
        </select>
      </div>
      
      <div class="flex flex-col">
        <Label for="status-filter" class="text-sm font-medium mb-2">Status</Label>
        <select 
          id="status-filter"
          bind:value={selectedStatus}
          class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="completed">Selesai</option>
        </select>
      </div>
      
      <div class="flex flex-col justify-end">
        <Button 
          variant="outline" 
          on:click={clearFilters} 
          class="h-10"
        >
          <IconWrapper icon={Filter} className="mr-2 h-4 w-4" />
          Reset Filter
        </Button>
      </div>
    </div>
    
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm text-muted-foreground">
      <span class="flex-shrink-0">Menampilkan {filteredEntries.length} dari {dailyEntries.length} entry</span>
      <div class="flex items-center gap-2 flex-shrink-0">
        <span class="hidden sm:inline">Urutkan:</span>
        <select 
          bind:value={sortField}
          class="px-2 py-1 border rounded text-sm bg-background"
        >
          <option value="entry_date">Tanggal</option>
          <option value="product_name">Produk</option>
          <option value="supplier_name">Supplier</option>
          <option value="status">Status</option>
        </select>
        <Button 
          variant="outline" 
          size="sm"
          on:click={() => toggleSort(sortField)}
          class=""
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
        <p>Memuat data stok harian...</p>
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
        <div class="min-w-[1200px] p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="cursor-pointer w-[110px] text-center" on:click={() => toggleSort('entry_date')}>
                  <div class="flex items-center justify-center">
                    Tanggal
                    <IconWrapper 
                      icon={sortField === 'entry_date' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                    />
                  </div>
                </TableHead>
                <TableHead class="cursor-pointer w-[180px] text-center" on:click={() => toggleSort('product_name')}>
                  <div class="flex items-center justify-center">
                    Produk
                    <IconWrapper 
                      icon={sortField === 'product_name' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                    />
                  </div>
                </TableHead>
                <TableHead class="cursor-pointer w-[140px] text-center" on:click={() => toggleSort('supplier_name')}>
                  <div class="flex items-center justify-center">
                    Supplier
                    <IconWrapper 
                      icon={sortField === 'supplier_name' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                    />
                  </div>
                </TableHead>
                <TableHead class="text-center w-[100px]">Stok Masuk</TableHead>
                <TableHead class="text-center w-[80px]">Terjual</TableHead>
                <TableHead class="text-center w-[80px]">Sisa</TableHead>
                <TableHead class="text-center w-[120px]">Harga</TableHead>
                <TableHead class="text-center w-[120px]">Pendapatan</TableHead>
                <TableHead class="text-center cursor-pointer w-[100px]" on:click={() => toggleSort('status')}>
                  <div class="flex items-center justify-center">
                    Status
                    <IconWrapper 
                      icon={sortField === 'status' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                    />
                  </div>
                </TableHead>
                <TableHead class="text-center w-[120px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {#each paginatedEntries as entry (entry.id)}
                <TableRow>
                  <TableCell class="w-[110px] text-center">
                    <div class="flex items-center gap-1 justify-center">
                                              <IconWrapper icon={Calendar} className="h-4 w-4 text-primary" />
                      <span class="text-sm">{new Date(entry.entry_date).toLocaleDateString('id-ID')}</span>
                    </div>
                  </TableCell>
                  <TableCell class="w-[180px] text-center">
                    <div class="flex items-center gap-2 justify-center">
                      {#if entry.product_image}
                        <img src={entry.product_image} alt={entry.product_name} class="w-8 h-8 object-cover rounded" />
                      {:else}
                        <div class="w-8 h-8 bg-muted rounded flex items-center justify-center">
                          <IconWrapper icon={Package} className="h-4 w-4 text-muted-foreground" />
                        </div>
                      {/if}
                      <span class="font-medium truncate text-sm">{entry.product_name}</span>
                    </div>
                  </TableCell>
                  <TableCell class="w-[140px] text-center">
                    <div class="flex items-center gap-1 justify-center">
                      <IconWrapper icon={Users} className="h-4 w-4 text-success" />
                      <div class="min-w-0">
                        <div class="font-medium truncate text-sm">{entry.supplier_name}</div>
                        {#if entry.supplier_phone}
                          <div class="text-xs text-muted-foreground truncate">{entry.supplier_phone}</div>
                        {/if}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell class="text-center font-medium">{entry.quantity_in}</TableCell>
                  <TableCell class="text-center">
                                            <span class="font-medium text-success">{entry.quantity_sold}</span>
                  </TableCell>
                  <TableCell class="text-center">
                    <span class="font-medium text-orange-600">{entry.quantity_returned}</span>
                  </TableCell>
                  <TableCell class="text-center font-mono text-sm">{formatCurrency(entry.product_price || entry.price_per_unit)}</TableCell>
                  <TableCell class="text-center">
                    <div class="text-center">
                      <div class="font-mono font-medium text-sm">{formatCurrency(entry.total_revenue)}</div>
                      <div class="text-xs text-muted-foreground">
                        Supplier: {formatCurrency(entry.supplier_earning)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell class="text-center">
                    <div class="flex flex-col items-center gap-1">
                      <Badge variant={entry.status === 'active' ? 'default' : entry.status === 'completed' ? 'secondary' : 'outline'} class="text-xs">
                        {entry.status === 'active' ? 'Aktif' : entry.status === 'completed' ? 'Selesai' : 'Dikembalikan'}
                      </Badge>
                      {#if entry.status === 'completed'}
                        <Badge variant={entry.is_paid ? 'default' : 'destructive'} class="text-xs">
                          <IconWrapper icon={entry.is_paid ? CheckCircle : XCircle} className="mr-1 h-3 w-3" />
                          {entry.is_paid ? 'Dibayar' : 'Belum Bayar'}
                        </Badge>
                      {/if}
                    </div>
                  </TableCell>
                  <TableCell class="text-center">
                    <div class="flex justify-center gap-1">
                      {#if entry.status === 'active'}
                        <Button variant="outline" size="sm" on:click={() => openEditDialog(entry)} title="Edit">
                          <IconWrapper icon={Edit} className="h-4 w-4" />
                        </Button>
                        {#if userRole === 'superadmin'}
                          <Button variant="default" size="sm" on:click={() => openCompletionDialog(entry)} title="Selesaikan">
                            <IconWrapper icon={Calendar} className="h-4 w-4" />
                          </Button>
                        {/if}
                      {/if}
                      {#if entry.status === 'completed' && !entry.is_paid && userRole === 'superadmin'}
                        <Button variant="default" size="sm" on:click={() => openMarkPaidDialog(entry)} title="Tandai Dibayar">
                          <IconWrapper icon={DollarSign} className="h-4 w-4" />
                        </Button>
                      {/if}
                    </div>
                  </TableCell>
                </TableRow>
              {/each}
              {#if paginatedEntries.length === 0}
                <TableRow>
                  <TableCell colspan={10} class="h-24 text-center">
                    {filteredEntries.length === 0 && dailyEntries.length > 0 ? 'Tidak ada data yang sesuai dengan filter.' : 'Belum ada data stok harian hari ini.'}
                  </TableCell>
                </TableRow>
              {/if}
            </TableBody>
          </Table>
        </div>
      </ScrollArea>
      
      <Pagination 
        {currentPage}
        totalItems={filteredEntries.length}
        {itemsPerPage}
        onPageChange={handlePageChange}
        onItemsPerPageChange={handleItemsPerPageChange}
      />
    </div>
  {/if}
</div>

{#if showAddEditDialog}
  <Dialog open={showAddEditDialog} onOpenChange={(open) => { if (!open) showAddEditDialog = false; }}>
    <DialogContent class="w-full max-w-[95vw] sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>{editingEntry ? "Edit Stok Harian" : "Input Stok Harian Baru"}</DialogTitle>
        <DialogDescription>
          {editingEntry ? "Ubah data stok harian di bawah ini." : "Isi data stok yang masuk hari ini."}
        </DialogDescription>
      </DialogHeader>
      
      <div class="space-y-4 py-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label for="entry-date">Tanggal *</Label>
            <Input 
              id="entry-date"
              type="date" 
              bind:value={currentEntry.entry_date}
              disabled={!!editingEntry}
            />
          </div>
          
          <div>
            <Label for="supplier">Supplier *</Label>
            <select 
              id="supplier"
              bind:value={currentEntry.supplier_id}
              disabled={!!editingEntry}
              class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value={null} disabled>Pilih supplier...</option>
              {#each suppliers as supplier}
                <option value={supplier.id}>{supplier.name}</option>
              {/each}
            </select>
          </div>
        </div>
        
        <div>
          <Label for="product">Produk *</Label>
          <select 
            id="product"
            bind:value={currentEntry.product_id}
            disabled={!!editingEntry}
            class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value={null} disabled>Pilih produk...</option>
            {#each availableProducts as product}
              <option value={product.id}>{product.name}</option>
            {/each}
          </select>
        </div>
        
        <div>
          <Label for="quantity">Jumlah Stok Masuk *</Label>
          <Input 
            id="quantity"
            type="number" 
            min="1"
            bind:value={currentEntry.quantity_in}
            placeholder="0"
          />
        </div>
        
        <div>
          <Label for="notes">Catatan</Label>
          <textarea 
            id="notes"
            bind:value={currentEntry.notes}
            class="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Catatan tambahan (opsional)..."
          ></textarea>
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
          on:click={handleSaveEntry} 
          class="w-full sm:w-auto"
        >
          <IconWrapper icon={editingEntry ? Edit : PlusCircle} className="mr-2 h-4 w-4" />
          {editingEntry ? "Update Entry" : "Simpan Entry"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/if}

{#if showCompletionDialog && completionEntry}
  <Dialog open={showCompletionDialog} onOpenChange={(open) => { if (!open) showCompletionDialog = false; }}>
    <DialogContent class="w-full max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-success">
          <IconWrapper icon={CheckCircle2} className="h-5 w-5" />
          Selesaikan Stok Harian
        </DialogTitle>
        <DialogDescription class="text-left">
          <div class="space-y-3">
            <div class="bg-success/10 border border-success/20 rounded-lg p-3">
              <p class="text-success text-sm">
                <strong>Selesaikan Entry:</strong> Entry stok untuk produk "{completionEntry.product_name}" akan diselesaikan dan sisa stok dikembalikan ke supplier.
              </p>
            </div>
            
            <div class="bg-muted border border-border rounded-lg p-3">
              <p class="font-medium text-foreground mb-1">Detail Entry:</p>
              <div class="text-sm text-muted-foreground">
                <p><strong>Produk:</strong> {completionEntry.product_name}</p>
                <p><strong>Supplier:</strong> {completionEntry.supplier_name}</p>
                <p><strong>Stok Masuk:</strong> {completionEntry.quantity_in} unit</p>
                <p><strong>Terjual:</strong> {completionEntry.quantity_sold} unit</p>
                <p><strong>Sisa:</strong> {completionEntry.quantity_returned} unit</p>
                <p><strong>Tanggal:</strong> {formatDate(completionEntry.entry_date)}</p>
              </div>
            </div>

            <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p class="text-yellow-800 dark:text-yellow-200 text-sm">
                <strong>Perhatian:</strong> Setelah menyelesaikan hari ini, Anda tidak dapat menambah atau mengubah entry untuk tanggal hari ini.
              </p>
            </div>
          </div>
        </DialogDescription>
      </DialogHeader>
      
      <DialogFooter class="flex flex-col sm:flex-row gap-2">
        <Button 
          variant="outline" 
          on:click={() => showCompletionDialog = false}
          class="w-full sm:w-auto"
        >
          Batal
        </Button>
        <Button 
          variant="default"
          on:click={completeEntry}
          class="w-full sm:w-auto"
        >
          <IconWrapper icon={CheckCircle2} className="mr-2 h-4 w-4" />
          Selesaikan
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/if}

{#if showGlobalCompletionDialog}
  <Dialog open={showGlobalCompletionDialog} onOpenChange={(open) => { if (!open) showGlobalCompletionDialog = false; }}>
    <DialogContent class="w-full max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-success">
          <IconWrapper icon={CheckCircle2} className="h-5 w-5" />
          Selesaikan Semua Stok Harian
        </DialogTitle>
        <DialogDescription class="text-left">
          <div class="space-y-3">
            <div class="bg-success/10 border border-success/20 rounded-lg p-3">
              <p class="text-success text-sm">
                <strong>Hari selesai!</strong> Semua entry stok harian telah diselesaikan dan status diperbarui.
              </p>
            </div>
            
            <div class="bg-muted border border-border rounded-lg p-3">
              <p class="font-medium text-foreground mb-1">Ringkasan Hari Ini:</p>
              <div class="text-sm text-muted-foreground">
                <p><strong>Total Entry:</strong> {globalCompletionData.totalEntries}</p>
                <p><strong>Total Produk:</strong> {globalCompletionData.totalProducts}</p>
                <p><strong>Total Stok Ditambahkan:</strong> {globalCompletionData.totalStock} unit</p>
                <p><strong>Tanggal:</strong> {formatDate(new Date())}</p>
              </div>
            </div>
            
            <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p class="text-yellow-800 dark:text-yellow-200 text-sm">
                <strong>Perhatian:</strong> Setelah menyelesaikan hari ini, Anda tidak dapat menambah atau mengubah entry untuk tanggal hari ini.
              </p>
            </div>
          </div>
        </DialogDescription>
      </DialogHeader>
      
      <DialogFooter class="flex flex-col sm:flex-row gap-2">
        <Button 
          variant="outline" 
          on:click={() => showGlobalCompletionDialog = false}
          class="w-full sm:w-auto"
        >
          Batal
        </Button>
        <Button 
          on:click={confirmGlobalCompletion} 
          disabled={isGlobalCompleting}
          class="w-full sm:w-auto"
        >
          <IconWrapper icon={CheckCircle2} className="mr-2 h-4 w-4" />
          Selesaikan Semua
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/if}

{#if showMarkPaidDialog && markPaidEntry}
  <Dialog open={showMarkPaidDialog} onOpenChange={(open) => { if (!open) showMarkPaidDialog = false; }}>
    <DialogContent class="w-full max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-success">
          <IconWrapper icon={DollarSign} className="h-5 w-5" />
          Konfirmasi Pembayaran
        </DialogTitle>
        <DialogDescription class="text-left">
          <div class="space-y-3">
            <div class="bg-success/10 border border-success/20 rounded-lg p-3">
              <p class="text-success text-sm">
                <strong>Tandai sebagai dibayar:</strong> Entry stok berikut akan ditandai sebagai sudah dibayar ke supplier.
              </p>
            </div>
            
            <div class="bg-muted border border-border rounded-lg p-3">
              <p class="font-medium text-foreground mb-1">Detail Entry:</p>
              <div class="text-sm text-muted-foreground">
                <p><strong>Produk:</strong> {markPaidEntry.product_name}</p>
                <p><strong>Supplier:</strong> {markPaidEntry.supplier_name}</p>
                <p><strong>Pendapatan Supplier:</strong> {formatCurrency(markPaidEntry.supplier_earning || 0)}</p>
                <p><strong>Tanggal:</strong> {formatDate(markPaidEntry.entry_date)}</p>
              </div>
            </div>

            <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p class="text-yellow-800 dark:text-yellow-200 text-sm">
                <strong>Perhatian:</strong> Setelah ditandai dibayar, status ini tidak dapat diubah kembali.
              </p>
            </div>
          </div>
        </DialogDescription>
      </DialogHeader>
      
      <DialogFooter class="flex flex-col sm:flex-row gap-2">
        <Button 
          variant="outline" 
          on:click={() => showMarkPaidDialog = false}
          class="w-full sm:w-auto"
        >
          Batal
        </Button>
        <Button 
          variant="default"
          on:click={confirmMarkAsPaid}
          class="w-full sm:w-auto"
        >
          <IconWrapper icon={DollarSign} className="mr-2 h-4 w-4" />
          Tandai Dibayar
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/if}
