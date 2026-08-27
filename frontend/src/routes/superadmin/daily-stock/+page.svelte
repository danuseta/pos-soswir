<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { onDestroy, onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { browser } from '$app/environment';
  import AlertMessage from "$lib/components/AlertMessage.svelte";
  import { useAlert } from "$lib/composables/useAlert";
  import DailyStockActionsController from '$lib/components/daily-stock/DailyStockActionsController.svelte';
  import DailyStockFilters from '$lib/components/daily-stock/DailyStockFilters.svelte';
  import DailyStockHeader from '$lib/components/daily-stock/DailyStockHeader.svelte';
  import DailyStockTable from '$lib/components/daily-stock/DailyStockTable.svelte';
  import {
    loadDailyStock,
    loadResellerProducts,
    loadStockSuppliers
  } from '$lib/services/dailyStockService';
  import {
    filterAndSortDailyStock
  } from '$lib/utils/dailyStock';

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

  let stockActions: DailyStockActionsController;

  let selectedDate = "";
  let selectedSupplier = "";
  let selectedStatus = "";

  let filterTimeout;

  $: {
    selectedDate;
    selectedSupplier;
    selectedStatus;
    if (browser && !isLoading) {
      clearTimeout(filterTimeout);
      filterTimeout = setTimeout(() => {
        loadDailyEntries();
      }, 300);
    }
  }

  onDestroy(() => clearTimeout(filterTimeout));

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
      
      isLoading = false;
    } catch (err) {
      console.error("Error loading data:", err);
      error = err.message;
      showAlertMessage('error', `Gagal memuat data: ${err.message}`);
      isLoading = false;
    }
  });

  async function loadDailyEntries() {
    try {
      dailyEntries = await loadDailyStock({ date: selectedDate, supplierId: selectedSupplier, status: selectedStatus });
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
      products = await loadResellerProducts();
    } catch (err) {
      console.warn("Error loading products:", err);
      products = [];
    }
  }

  async function loadSuppliers() {
    try {
      suppliers = await loadStockSuppliers();
    } catch (err) {
      console.warn("Error loading suppliers:", err);
      suppliers = [];
    }
  }

  $: filteredEntries = filterAndSortDailyStock(dailyEntries, {
    search: searchTerm,
    date: selectedDate,
    supplier: selectedSupplier,
    status: selectedStatus
  }, sortField, sortDirection);

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
  <DailyStockHeader onRefresh={loadDailyEntries} onAdd={() => stockActions.openAdd()} onCompleteDay={() => stockActions.openCompleteDay()} />

  <AlertMessage />

  <DailyStockFilters bind:searchTerm bind:selectedDate bind:selectedSupplier bind:selectedStatus bind:sortField {sortDirection} {suppliers} filteredCount={filteredEntries.length} totalCount={dailyEntries.length} onClear={clearFilters} onSort={toggleSort} />

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
    <DailyStockTable entries={paginatedEntries} totalItems={filteredEntries.length} allEntriesCount={dailyEntries.length} {currentPage} {itemsPerPage} {sortField} {sortDirection} {userRole} onSort={toggleSort} onPageChange={handlePageChange} onItemsPerPageChange={handleItemsPerPageChange} onEdit={(entry) => stockActions.openEdit(entry)} onComplete={(entry) => stockActions.openComplete(entry)} onMarkPaid={(entry) => stockActions.openMarkPaid(entry)} />
  {/if}
</div>

<DailyStockActionsController bind:this={stockActions} entries={dailyEntries} {products} {suppliers} {selectedDate} onRefresh={loadDailyEntries} />
