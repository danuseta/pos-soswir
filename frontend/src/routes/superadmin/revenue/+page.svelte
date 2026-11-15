<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
  import { Badge } from "$lib/components/ui/badge";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import Pagination from "$lib/components/Pagination.svelte";
  import { Eye, FileSpreadsheet, RefreshCw, SortAsc, SortDesc, ArrowUpDown } from "lucide-svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { api, apiData } from "$lib/apiConfig";
  import { browser } from '$app/environment';
  import IconWrapper from "$lib/components/IconWrapper.svelte";
  import RowActions from "$lib/components/RowActions.svelte";
  import RowActionItem from "$lib/components/RowActionItem.svelte";
  import AlertMessage from "$lib/components/AlertMessage.svelte";
  import { useAlert } from "$lib/composables/useAlert";
  import { formatCurrency } from "$lib/utils/format";
  import RevenueDetailDialog from '$lib/components/revenue/RevenueDetailDialog.svelte';
  import RevenueExportDialog from '$lib/components/revenue/RevenueExportDialog.svelte';
  import ListFilters from '$lib/components/ListFilters.svelte';
  import { combineRevenueData, filterAndSortRevenue } from '$lib/utils/managementLists';
  import { exportRevenueExcel, filterMonthlyRevenue, type RevenueExportOptions } from '$lib/utils/revenueExport';

  let revenueData = {
    daily: [],
    monthly: [],
    yearly: []
  };
  let isLoading = true;
  let error = null;

  const { showAlertMessage } = useAlert();

  let showDetailDialog = false;
  let detailData = [];
  let detailTitle = '';
  let isLoadingDetail = false;
  let showExportDialog = false;
  let isExporting = false;

  let searchTerm = "";
  let currentPage = 1;
  let itemsPerPage = 10;
  let sortField = 'date';
  let sortDirection = 'desc';
  let typeFilter = "";

  $: combinedRevenueData = combineRevenueData(revenueData);
  $: filteredRevenue = filterAndSortRevenue(combinedRevenueData, searchTerm, typeFilter, sortField, sortDirection);

  $: paginatedRevenue = (() => {
    if (itemsPerPage >= filteredRevenue.length) {
      return filteredRevenue;
    }
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredRevenue.slice(start, end);
  })();



  async function loadRevenueData() {
    try {
      isLoading = true;
      
      revenueData = await apiData(api.get(`/api/sales/revenue?_t=${Date.now()}`));
    } catch (err) {
      console.error("Error loading revenue data:", err);
      error = err.message;
      showAlertMessage('error', `Gagal memuat data: ${err.message}`);
    } finally {
      isLoading = false;
    }
  }

  async function viewDetail(type: string, date: string, title: string) {
    try {
      isLoadingDetail = true;
      showDetailDialog = true;
      detailTitle = title;
      detailData = [];
      
      let formattedDate = date;
      
      if (type === 'daily') {
        if (date.includes('T') || date.includes('Z')) {
          formattedDate = date.split('T')[0];
        }
      }
      
      const params = new URLSearchParams({ type, date: formattedDate });
      detailData = await apiData(api.get(`/api/sales/revenue/detail?${params}`));
    } catch (err) {
      console.error("Error loading detail data:", err);
      showAlertMessage('error', `Gagal memuat detail: ${err.message}`);
    } finally {
      isLoadingDetail = false;
    }
  }

  async function exportRevenue(options: RevenueExportOptions) {
    try {
      isExporting = true;
      const allRevenue = await apiData(api.get('/api/sales/revenue?all_months=true'));
      const rows = filterMonthlyRevenue(allRevenue.monthly || [], options);

      if (rows.length === 0) {
        showAlertMessage('error', 'Tidak ada data pendapatan pada periode yang dipilih');
        return;
      }

      await exportRevenueExcel(rows, options);
      showExportDialog = false;
      showAlertMessage('success', `${rows.length} bulan berhasil diekspor ke Excel`);
    } catch (err) {
      console.error('Error exporting revenue:', err);
      showAlertMessage('error', `Gagal mengekspor pendapatan: ${err.message}`);
    } finally {
      isExporting = false;
    }
  }

  onMount(async () => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_token") : null;
    const userRole = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_user_role") : null;
    
    if (!token || userRole !== 'superadmin') {
      goto("/login");
      return;
    }
    
    if (browser) {
      await loadRevenueData();
    }
  });

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
    sortField = 'date';
    sortDirection = 'desc';
    currentPage = 1;
    typeFilter = '';
  }
</script>

<div class="flex-1 space-y-4 p-4 md:p-8 pt-6 max-w-full overflow-hidden">
  <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
    <h2 class="text-2xl md:text-3xl font-bold tracking-tight">Total Pendapatan</h2>
    <div class="flex w-full sm:w-auto flex-col sm:flex-row gap-2">
      <Button variant="outline" on:click={() => showExportDialog = true} disabled={isLoading || isExporting} class="w-full sm:w-auto">
        <IconWrapper icon={FileSpreadsheet} className="mr-2 h-4 w-4 {isExporting ? 'animate-spin' : ''}" />
        {isExporting ? 'Mengekspor...' : 'Export Excel'}
      </Button>
      <Button on:click={loadRevenueData} disabled={isLoading} class="w-full sm:w-auto">
        <IconWrapper icon={RefreshCw} className="mr-2 h-4 w-4 {isLoading ? 'animate-spin' : ''}" />
        Refresh Data
      </Button>
    </div>
  </div>

  <AlertMessage />

  <RevenueExportDialog open={showExportDialog} {isExporting} onClose={() => showExportDialog = false} onExport={exportRevenue} />

  <ListFilters bind:searchTerm bind:secondaryValue={typeFilter} bind:sortField {sortDirection} searchPlaceholder="Cari data pendapatan..." secondaryOptions={[{ value: '', label: 'Semua Periode' }, { value: 'daily', label: 'Harian' }, { value: 'monthly', label: 'Bulanan' }, { value: 'yearly', label: 'Tahunan' }]} sortOptions={[{ value: 'date', label: 'Tanggal' }, { value: 'type', label: 'Tipe' }, { value: 'total_revenue', label: 'Total Pendapatan' }, { value: 'total_profit', label: 'Total Keuntungan' }, { value: 'store_profit', label: 'Keuntungan Toko' }, { value: 'supplier_profit', label: 'Keuntungan Supplier' }, { value: 'transaction_count', label: 'Jumlah Transaksi' }]} filteredCount={filteredRevenue.length} totalCount={combinedRevenueData.length} itemLabel="data" onClear={clearFilters} onSort={toggleSort} />

  {#if isLoading}
    <div class="bg-card p-8 rounded-lg shadow flex justify-center">
      <div class="text-center">
        <div class="inline-block animate-spin h-8 w-8 border-4 border-t-primary border-r-transparent border-b-primary border-l-transparent rounded-full mb-4"></div>
        <p>Memuat data pendapatan...</p>
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
        <div class="min-w-[1100px] p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="cursor-pointer w-[80px] text-center" on:click={() => toggleSort('type')}>
                  <div class="flex items-center justify-center">
                    Periode
                    <IconWrapper 
                      icon={sortField === 'type' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                    />
                  </div>
                </TableHead>
                <TableHead class="cursor-pointer w-[180px] text-center" on:click={() => toggleSort('formatted_date')}>
                  <div class="flex items-center justify-center">
                    Tanggal
                    <IconWrapper 
                      icon={sortField === 'formatted_date' || sortField === 'date' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                    />
                  </div>
                </TableHead>
                <TableHead class="text-center cursor-pointer w-[140px]" on:click={() => toggleSort('total_revenue')}>
                  <div class="flex items-center justify-center">
                    Total Pendapatan
                    <IconWrapper 
                      icon={sortField === 'total_revenue' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                    />
                  </div>
                </TableHead>
                <TableHead class="text-center cursor-pointer w-[130px]" on:click={() => toggleSort('total_profit')}>
                  <div class="flex items-center justify-center">
                    Total Keuntungan
                    <IconWrapper 
                      icon={sortField === 'total_profit' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                    />
                  </div>
                </TableHead>
                <TableHead class="text-center cursor-pointer w-[120px]" on:click={() => toggleSort('store_profit')}>
                  <div class="flex items-center justify-center">
                    Keuntungan Toko
                    <IconWrapper 
                      icon={sortField === 'store_profit' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                  />
                </div>
                </TableHead>
                <TableHead class="text-center w-[120px]">Keuntungan Supplier</TableHead>
                <TableHead class="text-center cursor-pointer w-[100px]" on:click={() => toggleSort('transaction_count')}>
                  <div class="flex items-center justify-center">
                    Transaksi
                    <IconWrapper 
                      icon={sortField === 'transaction_count' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                  />
                </div>
                </TableHead>
                <TableHead class="text-center w-[100px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {#each paginatedRevenue as item}
                <TableRow>
                  <TableCell class="w-[80px] text-center">
                    <Badge variant={item.type === 'daily' ? 'default' : item.type === 'monthly' ? 'secondary' : 'outline'} class="text-xs">
                      {item.type_label}
                    </Badge>
                  </TableCell>
                  <TableCell class="font-medium w-[180px] text-center truncate">{item.formatted_date}</TableCell>
                  <TableCell class="text-center font-mono text-sm w-[140px]">{formatCurrency(item.total_revenue)}</TableCell>
                  <TableCell class="text-center font-mono text-primary text-sm font-semibold w-[130px]">{formatCurrency(item.total_profit)}</TableCell>
                  <TableCell class="text-center font-mono text-primary text-sm w-[120px]">{formatCurrency(item.store_profit)}</TableCell>
                  <TableCell class="text-center font-mono text-destructive text-sm w-[120px]">{formatCurrency(item.supplier_profit)}</TableCell>
                  <TableCell class="text-center font-medium w-[100px]">{item.transaction_count}</TableCell>
                  <TableCell class="text-center w-[100px]">
                    <RowActions>
                      <RowActionItem
                        icon={Eye}
                        label="Lihat Detail"
                        on:click={() => viewDetail(item.type, item.date, `Detail ${item.type_label} - ${item.formatted_date}`)}
                      />
                    </RowActions>
                  </TableCell>
                </TableRow>
              {/each}
              {#if paginatedRevenue.length === 0}
                <TableRow>
                  <TableCell colspan={8} class="h-24 text-center">
                    {filteredRevenue.length === 0 && combinedRevenueData.length > 0 ? 'Tidak ada data yang sesuai dengan filter.' : 'Belum ada data pendapatan.'}
                  </TableCell>
                </TableRow>
              {/if}
            </TableBody>
          </Table>
        </div>
      </ScrollArea>
      
      <Pagination 
        {currentPage}
        totalItems={filteredRevenue.length}
        {itemsPerPage}
        onPageChange={handlePageChange}
        onItemsPerPageChange={handleItemsPerPageChange}
      />
    </div>
  {/if}
</div>

<RevenueDetailDialog open={showDetailDialog} title={detailTitle} data={detailData} isLoading={isLoadingDetail} onClose={() => showDetailDialog = false} />
