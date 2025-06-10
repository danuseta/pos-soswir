<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "$lib/components/ui/dialog";
  import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
  import { Badge } from "$lib/components/ui/badge";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import Tabs from "$lib/components/ui/tabs/tabs.svelte";
  import TabsList from "$lib/components/ui/tabs/tabs-list.svelte";
  import TabsTrigger from "$lib/components/ui/tabs/tabs-trigger.svelte";
  import TabsContent from "$lib/components/ui/tabs/tabs-content.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import { Eye, TrendingUp, DollarSign, Calendar, RefreshCw, Search, Filter, SortAsc, SortDesc, ArrowUpDown, UtensilsCrossed, Coffee, Truck, Package } from "lucide-svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { BACKEND_URL, getAuthHeaders } from "$lib/apiConfig";
  import { browser } from '$app/environment';
  import IconWrapper from "$lib/components/IconWrapper.svelte";
  import AlertMessage from "$lib/components/AlertMessage.svelte";
  import { useAlert } from "$lib/composables/useAlert";

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

  let searchTerm = "";
  let currentPage = 1;
  let itemsPerPage = 10;
  let sortField = 'date';
  let sortDirection = 'desc';
  let typeFilter = "";

  $: combinedRevenueData = [
    ...revenueData.daily.map(item => ({
      ...item,
      type: 'daily',
      type_label: 'Harian',
      formatted_date: formatDate(item.date),
      sort_date: new Date(item.date + 'T12:00:00'),
      date: item.date,
      total_profit: (parseFloat(item.total_revenue) || 0) - (parseFloat(item.supplier_profit) || 0)
    })),
    ...revenueData.monthly.map(item => ({
      ...item,
      type: 'monthly',
      type_label: 'Bulanan',
      formatted_date: getMonthLabel(item),
      sort_date: new Date(item.year, item.month - 1, 15),
      date: `${item.year}-${String(item.month).padStart(2, '0')}`,
      total_profit: (parseFloat(item.total_revenue) || 0) - (parseFloat(item.supplier_profit) || 0)
    })),
    ...revenueData.yearly.map(item => ({
      ...item,
      type: 'yearly',
      type_label: 'Tahunan',
      formatted_date: item.year.toString(),
      sort_date: new Date(item.year, 6, 1),
      date: item.year.toString(),
      total_profit: (parseFloat(item.total_revenue) || 0) - (parseFloat(item.supplier_profit) || 0)
    }))
  ];

  $: filteredRevenue = combinedRevenueData
    .filter(item => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        item.formatted_date.toLowerCase().includes(searchLower) ||
        item.type_label.toLowerCase().includes(searchLower);
      
      const matchesType = !typeFilter || item.type === typeFilter;
      
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      
      if (sortField === 'date' || sortField === 'formatted_date') {
        aValue = a.sort_date;
        bValue = b.sort_date;
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

  $: paginatedRevenue = (() => {
    if (itemsPerPage >= filteredRevenue.length) {
      return filteredRevenue;
    }
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredRevenue.slice(start, end);
  })();



  function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Jakarta'
    });
  }

  function formatDateTime(dateString) {
    if (!dateString) return '';
    
    const parts = dateString.replace('T', ' ').split(' ');
    const datePart = parts[0];
    const timePart = parts[1] ? parts[1].split('.')[0] : '00:00:00';
    
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 
                       'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    
    return `${day} ${monthNames[month - 1]} ${year}, ${String(hours).padStart(2, '0')}.${String(minutes).padStart(2, '0')}`;
  }

  async function loadRevenueData() {
    try {
      isLoading = true;
      showAlertMessage('info', 'Memuat data pendapatan...');
      
      const response = await fetch(`${BACKEND_URL}/api/sales/revenue?_t=${Date.now()}`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        revenueData = await response.json();
        console.log('Raw revenue data from API:', revenueData);
        console.log('Daily data sample:', revenueData.daily[0]);
        console.log('All daily dates:', revenueData.daily.map(item => item.date));
        showAlertMessage('success', 'Data pendapatan berhasil dimuat');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal memuat data pendapatan");
      }
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
      
      console.log('Debug viewDetail called with:', { type, date, title });
      
      let formattedDate = date;
      
      if (type === 'daily') {
        if (date.includes('T') || date.includes('Z')) {
          formattedDate = date.split('T')[0];
        }
      }
      
      console.log('Sending formatted date to API:', formattedDate);
      
      const response = await fetch(`${BACKEND_URL}/api/sales/revenue/detail?type=${type}&date=${formattedDate}`, {
        headers: getAuthHeaders()
      });
      
      console.log('Detail API response status:', response.status);
      
      if (response.ok) {
        detailData = await response.json();
        console.log('Detail data received:', detailData);
        
        if (detailData.length === 0) {
          console.warn('No detail data found for:', { type, date: formattedDate });
        }
      } else {
        const errorData = await response.json();
        console.error('Detail API error:', errorData);
        throw new Error(errorData.message || "Gagal memuat detail data");
      }
    } catch (err) {
      console.error("Error loading detail data:", err);
      showAlertMessage('error', `Gagal memuat detail: ${err.message}`);
    } finally {
      isLoadingDetail = false;
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

  function getMonthLabel(monthData) {
    const date = new Date(monthData.year, monthData.month - 1);
    return date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });
  }

  function generateMonthLabel(monthData) {
    return `${monthData.year}-${String(monthData.month).padStart(2, '0')}`;
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
    sortField = 'date';
    sortDirection = 'desc';
    currentPage = 1;
    typeFilter = '';
  }
</script>

<div class="flex-1 space-y-4 p-4 md:p-8 pt-6 max-w-full overflow-hidden">
  <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
    <h2 class="text-2xl md:text-3xl font-bold tracking-tight">Total Pendapatan</h2>
    <Button 
      on:click={loadRevenueData} 
      disabled={isLoading} 
        class="w-full sm:w-auto"
    >
      <IconWrapper icon={RefreshCw} className="mr-2 h-4 w-4 {isLoading ? 'animate-spin' : ''}" />
      Refresh Data
    </Button>
  </div>

  <AlertMessage />

  <div class="bg-card rounded-lg shadow p-4">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <div class="flex items-center gap-2">
        <IconWrapper icon={Search} className="h-5 w-5 text-muted-foreground" />
        <Input 
          type="text" 
          placeholder="Cari data pendapatan..." 
          bind:value={searchTerm}
        />
      </div>
      
      <div>
        <select 
          bind:value={typeFilter}
          class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Semua Periode</option>
          <option value="daily">Harian</option>
          <option value="monthly">Bulanan</option>
          <option value="yearly">Tahunan</option>
        </select>
      </div>
      
      <div class="flex gap-2">
        <Button 
          variant="outline" 
          on:click={clearFilters} 
          size="sm"
        >
          <IconWrapper icon={Filter} className="mr-2 h-4 w-4" />
          Reset
        </Button>
      </div>
    </div>
    
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm text-muted-foreground">
      <span class="flex-shrink-0">Menampilkan {filteredRevenue.length} dari {combinedRevenueData.length} data</span>
      <div class="flex items-center gap-2 flex-shrink-0">
        <span class="hidden sm:inline">Urutkan:</span>
        <select 
          bind:value={sortField}
          class="px-2 py-1 border rounded text-sm bg-background"
        >
          <option value="date">Tanggal</option>
          <option value="type">Tipe</option>
          <option value="total_revenue">Total Pendapatan</option>
          <option value="total_profit">Total Keuntungan</option>
          <option value="store_profit">Keuntungan Toko</option>
          <option value="supplier_profit">Keuntungan Supplier</option>
          <option value="transaction_count">Jumlah Transaksi</option>
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
                  <TableCell class="text-center font-mono text-success text-sm font-semibold w-[130px]">{formatCurrency(item.total_profit)}</TableCell>
                  <TableCell class="text-center font-mono text-primary text-sm w-[120px]">{formatCurrency(item.store_profit)}</TableCell>
                  <TableCell class="text-center font-mono text-destructive text-sm w-[120px]">{formatCurrency(item.supplier_profit)}</TableCell>
                  <TableCell class="text-center font-medium w-[100px]">{item.transaction_count}</TableCell>
                  <TableCell class="text-center w-[100px]">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      on:click={() => viewDetail(item.type, item.date, `Detail ${item.type_label} - ${item.formatted_date}`)}
                    >
                      <IconWrapper icon={Eye} className="mr-1 h-3 w-3" />
                      Detail
                    </Button>
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

<Dialog bind:open={showDetailDialog}>
  <DialogContent class="max-w-6xl max-h-[90vh] overflow-auto">
    <DialogHeader>
      <DialogTitle>{detailTitle}</DialogTitle>
      <DialogDescription>
        Detail transaksi dan keuntungan periode yang dipilih
      </DialogDescription>
    </DialogHeader>
    
    {#if isLoadingDetail}
      <div class="flex items-center justify-center p-8">
        <IconWrapper icon={RefreshCw} className="h-8 w-8 animate-spin mr-2" />
        <span>Memuat detail data...</span>
      </div>
    {:else}
      <div class="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Produk</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Jumlah</TableHead>
              <TableHead>Harga</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Metode Pembayaran</TableHead>
              <TableHead>Kasir</TableHead>
              <TableHead>Keuntungan Toko</TableHead>
              <TableHead>Keuntungan Supplier</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {#each detailData as item}
              <TableRow>
                <TableCell>{formatDateTime(item.waktu)}</TableCell>
                <TableCell class="font-medium">{item.produk}</TableCell>
                <TableCell>
                  <div class="flex items-center gap-2 justify-center">
                    {#if item.kategori.toLowerCase() === 'makanan'}
                      <IconWrapper icon={UtensilsCrossed} className="h-4 w-4 text-orange-600" />
                    {:else if item.kategori.toLowerCase() === 'minuman'}
                      <IconWrapper icon={Coffee} className="h-4 w-4 text-primary" />
                    {:else if item.kategori.toLowerCase() === 'pubj'}
                      <IconWrapper icon={Truck} className="h-4 w-4 text-purple-600" />
                    {:else}
                      <IconWrapper icon={Package} className="h-4 w-4 text-muted-foreground" />
                    {/if}
                    <span class="text-sm font-medium text-foreground">
                      {item.kategori}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{item.jumlah}</TableCell>
                <TableCell>{formatCurrency(item.harga)}</TableCell>
                <TableCell>{formatCurrency(item.total)}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {item.payment_method || 'Cash'}
                  </Badge>
                </TableCell>
                <TableCell>{item.kasir}</TableCell>
                <TableCell class="text-success">
                  {formatCurrency(item.keuntungan_toko)}
                </TableCell>
                <TableCell class="text-primary">
                  {#if item.keuntungan_supplier > 0}
                    {formatCurrency(item.keuntungan_supplier)}
                  {:else}
                    -
                  {/if}
                </TableCell>
              </TableRow>
            {/each}
            {#if detailData.length === 0}
              <TableRow>
                <TableCell colspan={10} class="text-center text-muted-foreground">
                  Tidak ada data untuk ditampilkan
                </TableCell>
              </TableRow>
            {/if}
          </TableBody>
        </Table>
      </div>
    {/if}
    
    <DialogFooter>
      <Button variant="outline" on:click={() => showDetailDialog = false}>
        Tutup
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog> 