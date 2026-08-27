<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { api, apiData } from "$lib/apiConfig";
  import { browser } from '$app/environment';
  import AlertMessage from "$lib/components/AlertMessage.svelte";
  import { useAlert } from "$lib/composables/useAlert";
  import TransactionTable from '$lib/components/transactions/TransactionTable.svelte';
  import TransactionControls from '$lib/components/transactions/TransactionControls.svelte';
  import TransactionExportDialog from '$lib/components/transactions/TransactionExportDialog.svelte';
  import { exportTransactionsCsv, exportTransactionsExcel, filterAndSortTransactions, filterTransactionsByPeriod, type TransactionExportOptions } from '$lib/utils/transaction';

  let searchTerm = "";
  let transactions = [];
  let isLoading = true;
  let error = null;
  let dateRange = { from: null, to: null };
  let isExporting = false;
  let showExportDialog = false;

  let currentPage = 1;
  let itemsPerPage = 10;
  let sortField = 'waktu';
  let sortDirection = 'desc';

  const { showAlertMessage } = useAlert();

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
      
      
      transactions = await apiData(api.get('/api/transactions'));
      isLoading = false;
    } catch (err) {
      console.error("Error loading transactions:", err);
      error = err.message;
      showAlertMessage('error', `Gagal memuat data: ${err.message}`);
      isLoading = false;
    }
  });

  async function exportTransactions(options: TransactionExportOptions) {
    const transactionsToExport = filterTransactionsByPeriod(transactions, options);
    if (transactionsToExport.length === 0) {
      showAlertMessage('error', 'Tidak ada data yang bisa diekspor');
      return;
    }

    isExporting = true;
    showAlertMessage('info', 'Sedang mempersiapkan export Excel...');
    
    try {
      try {
        await exportTransactionsExcel(transactionsToExport, options);
        showExportDialog = false;
        showAlertMessage('success', `Data transaksi berhasil diekspor ke Excel (${transactionsToExport.length} baris sumber)`);
      } catch (excelError) {
        console.error('Excel export failed, using CSV:', excelError);
        exportTransactionsCsv(transactionsToExport, options);
        showExportDialog = false;
        showAlertMessage('success', `Data berhasil diekspor ke CSV (${transactionsToExport.length} baris sumber)`);
      }
    } catch (error) {
      console.error('Export error:', error);
      showAlertMessage('error', 'Gagal mengekspor data: ' + error.message);
    } finally {
      isExporting = false;
    }
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

<div class="flex-1 space-y-4 p-4 md:p-8 pt-6 max-w-full overflow-hidden">
  <TransactionControls bind:searchTerm bind:dateRange bind:sortField {sortDirection} filteredCount={filteredTransactions.length} totalCount={transactions.length} {isLoading} {isExporting} onExport={() => showExportDialog = true} onClear={clearFilters} onSort={toggleSort} />

  <TransactionExportDialog
    open={showExportDialog}
    {isExporting}
    onClose={() => showExportDialog = false}
    onExport={exportTransactions}
  />

  <AlertMessage />

  {#if isLoading}
    <div class="bg-card p-8 rounded-lg shadow flex justify-center">
      <div class="text-center">
        <div class="inline-block animate-spin h-8 w-8 border-4 border-t-primary border-r-transparent border-b-primary border-l-transparent rounded-full mb-4"></div>
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
    <TransactionTable transactions={paginatedTransactions} totalItems={filteredTransactions.length} allTransactionsCount={transactions.length} {currentPage} {itemsPerPage} {sortField} {sortDirection} showProfit onSort={toggleSort} onPageChange={handlePageChange} onItemsPerPageChange={handleItemsPerPageChange} />
  {/if}
</div>
