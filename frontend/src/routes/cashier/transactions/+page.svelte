<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Search, FileText, Filter, SortAsc, SortDesc } from "lucide-svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { api, apiData } from "$lib/apiConfig";
  import { browser } from '$app/environment';
  import IconWrapper from "$lib/components/IconWrapper.svelte";
  import AlertMessage from "$lib/components/AlertMessage.svelte";
  import { useAlert } from "$lib/composables/useAlert";
  import { formatCurrency, formatDateTime } from "$lib/utils/format";
  import { downloadCsv } from '$lib/utils/csv';
  import TransactionTable from '$lib/components/transactions/TransactionTable.svelte';
  import { filterAndSortTransactions } from '$lib/utils/transaction';

  let searchTerm = "";
  let transactions = [];
  let isLoading = true;
  let error = null;
  let dateRange = { from: null, to: null };

  let currentPage = 1;
  let itemsPerPage = 10;
  let sortField = 'waktu';
  let sortDirection = 'desc';

  const { showAlertMessage } = useAlert();

  onMount(async () => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_token") : null;
    const userRole = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_user_role") : null;
    
    if (!token || userRole !== 'cashier') {
      goto("/login");
      return;
    }
    
    try {
      if (!browser) {
        isLoading = false;
        return;
      }
      
      
      transactions = await apiData(api.get('/api/transactions/cashier'));
      isLoading = false;
    } catch (err) {
      console.error("Error loading transactions:", err);
      error = err.message;
      showAlertMessage('error', `Gagal memuat data: ${err.message}`);
      isLoading = false;
    }
  });

  function handleDateRangeChange(event) {
    dateRange = event.detail;
  }

  function exportToCsv() {
    if (filteredTransactions.length === 0) {
      showAlertMessage('error', 'Tidak ada data yang bisa diekspor');
      return;
    }

    const headers = ["Waktu", "Produk", "Kategori", "Jumlah", "Harga", "Total", "Kasir", "Metode Pembayaran"];
    const rows = filteredTransactions.map((transaction) => [
        formatDateTime(transaction.waktu),
        transaction.produk,
        transaction.kategori,
        transaction.jumlah,
        transaction.harga,
        transaction.total,
        transaction.kasir,
        transaction.payment_method || 'Cash'
      ]);
    downloadCsv(`log_transaksi_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
    showAlertMessage('success', 'Data transaksi berhasil diekspor ke CSV');
  }

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
    dateRange = { from: null, to: null };
    sortField = 'waktu';
    sortDirection = 'desc';
    currentPage = 1;
  }

  $: filteredTransactions = filterAndSortTransactions(transactions, searchTerm, dateRange, sortField, sortDirection);

  $: paginatedTransactions = (() => {
    if (itemsPerPage >= filteredTransactions.length) {
      return filteredTransactions;
    }
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredTransactions.slice(start, end);
  })();
</script>

<svelte:head>
  <title>Log Transaksi - Cashier</title>
</svelte:head>

<div class="flex-1 space-y-4 p-4 md:p-8 pt-6 max-w-full overflow-hidden">
  <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
    <h2 class="text-2xl md:text-3xl font-bold tracking-tight">Log Transaksi</h2>
         <Button 
       on:click={exportToCsv} 
       disabled={isLoading} 
       class="w-full sm:w-auto bg-primary hover:bg-primary/90"
     >
      <IconWrapper icon={FileText} className="mr-2 h-4 w-4 {isLoading ? 'animate-spin' : ''}" />
      Ekspor ke CSV
    </Button>
  </div>

  <AlertMessage />

  <div class="bg-card rounded-lg shadow p-4 max-w-full">
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <div class="flex items-center gap-2 min-w-0">
        <IconWrapper icon={Search} className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <Input 
          type="text" 
          placeholder="Cari transaksi..." 
          bind:value={searchTerm}
          class="min-w-0"
        />
      </div>
      
      <div>
        <Input 
          type="date" 
          bind:value={dateRange.from}
          class="w-full"
        />
      </div>
      
      <div>
        <Input 
          type="date" 
          bind:value={dateRange.to}
          class="w-full"
        />
      </div>
      
      <div class="flex gap-2 min-w-0">
                 <Button 
           variant="outline" 
           on:click={clearFilters} 
           size="sm" 
           class="flex-shrink-0 bg-primary/10 hover:bg-primary/20 border-primary/20 text-primary"
         >
          <IconWrapper icon={Filter} className="mr-2 h-4 w-4" />
          Reset
        </Button>
      </div>
    </div>
    
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm text-muted-foreground">
      <span class="flex-shrink-0">Menampilkan {filteredTransactions.length} dari {transactions.length} transaksi</span>
      <div class="flex items-center gap-2 flex-shrink-0">
        <span class="hidden sm:inline">Urutkan:</span>
        <select 
          bind:value={sortField}
          class="px-2 py-1 border rounded text-sm bg-background min-w-0"
        >
          <option value="waktu">Waktu</option>
          <option value="produk">Produk</option>
          <option value="kategori">Kategori</option>
          <option value="kasir">Kasir</option>
          <option value="total">Total</option>
          <option value="payment_method">Metode Pembayaran</option>
        </select>
                 <Button 
           variant="outline" 
           size="sm"
           on:click={() => toggleSort(sortField)}
           class="flex-shrink-0 bg-primary/10 hover:bg-primary/20 border-primary/20 text-primary"
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
        <p>Memuat data transaksi...</p>
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
    <TransactionTable transactions={paginatedTransactions} totalItems={filteredTransactions.length} allTransactionsCount={transactions.length} {currentPage} {itemsPerPage} {sortField} {sortDirection} onSort={toggleSort} onPageChange={handlePageChange} onItemsPerPageChange={handleItemsPerPageChange} />
  {/if}
</div>
