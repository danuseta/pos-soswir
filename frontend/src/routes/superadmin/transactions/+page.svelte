<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
  import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
  import Pagination from "$lib/components/Pagination.svelte";
  import { Search, FileText, Calendar, Filter, SortAsc, SortDesc, ArrowUpDown, User, Package, UtensilsCrossed, Coffee, Truck } from "lucide-svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { BACKEND_URL, getAuthHeaders } from "$lib/apiConfig";
  import { browser } from '$app/environment';
  import IconWrapper from "$lib/components/IconWrapper.svelte";
  import { Badge } from "$lib/components/ui/badge";
  import AlertMessage from "$lib/components/AlertMessage.svelte";
  import { useAlert } from "$lib/composables/useAlert";

  let searchTerm = "";
  let transactions = [];
  let isLoading = true;
  let error = null;
  let dateRange = { from: null, to: null };
  let isExporting = false;

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
      
      showAlertMessage('info', 'Memuat data transaksi...');
      
      const response = await fetch(`${BACKEND_URL}/api/transactions`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        transactions = await response.json();
        console.log('Transaction data loaded:', transactions[0]);
        showAlertMessage('success', `Berhasil memuat ${transactions.length} data transaksi`);
        isLoading = false;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal memuat data transaksi");
      }
    } catch (err) {
      console.error("Error loading transactions:", err);
      error = err.message;
      showAlertMessage('error', `Gagal memuat data: ${err.message}`);
      isLoading = false;
    }
  });

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

  function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  }

  function handleDateRangeChange(event) {
    dateRange = event.detail;
  }

  function exportSimpleCsv() {
    const headers = [
      'Waktu', 'Produk', 'Kategori', 'Jumlah', 
      'Harga per Unit', 'Total Harga', 'Kasir', 
      'Metode Pembayaran', 'Keuntungan Toko', 'Keuntungan Supplier'
    ];

    let csvContent = headers.join(',') + '\n';
    filteredTransactions.forEach(transaction => {
      const row = [
        formatDateTime(transaction.waktu),
        transaction.produk || '',
        transaction.kategori || '',
        transaction.jumlah || 0,
        transaction.harga || 0,
        transaction.total || 0,
        transaction.kasir || '',
        transaction.payment_method || 'Cash',
        transaction.keuntungan_toko || 0,
        transaction.keuntungan_supplier || 0
      ].map(field => {
        if (field === null || field === undefined) return '';
        return typeof field === 'string' && field.includes(',') 
          ? `"${field}"` 
          : String(field);
      });
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    const currentDate = new Date().toISOString().split('T')[0];
    const timestamp = new Date().toLocaleTimeString('id-ID', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }).replace(':', '-');
    
    link.setAttribute("href", url);
    link.setAttribute("download", `Log_Transaksi_${currentDate}_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showAlertMessage('success', `Data berhasil diekspor ke CSV (${filteredTransactions.length} records)`);
  }

  async function exportToCsv() {
    if (filteredTransactions.length === 0) {
      showAlertMessage('error', 'Tidak ada data yang bisa diekspor');
      return;
    }

    isExporting = true;
    showAlertMessage('info', 'Sedang mempersiapkan export Excel...');
    
    try {
      let XLSX: any;
      try {
        const xlsxModule = await import('xlsx');
        XLSX = xlsxModule;
        if (!XLSX.utils) {
          XLSX = (xlsxModule as any).default;
        }
      } catch (error1) {
        try {
          const xlsxModule = await import('xlsx');
          XLSX = (xlsxModule as any).default || xlsxModule;
        } catch (error2) {
          console.error('All XLSX import strategies failed:', { error1, error2 });
          exportSimpleCsv();
          isExporting = false;
          return;
        }
      }
      
      if (!XLSX || !XLSX.utils) {
        console.error('XLSX utils not available after import');
        exportSimpleCsv();
        isExporting = false;
        return;
      }
      
      const exportData = filteredTransactions.map(transaction => ({
        'Waktu': formatDateTime(transaction.waktu),
        'Produk': transaction.produk || '',
        'Kategori': transaction.kategori || '',
        'Jumlah': transaction.jumlah || 0,
        'Harga per Unit': transaction.harga || 0,
        'Total Harga': transaction.total || 0,
        'Kasir': transaction.kasir || '',
        'Metode Pembayaran': transaction.payment_method || 'Cash',
        'Keuntungan Toko': transaction.keuntungan_toko || 0,
        'Keuntungan Supplier': transaction.keuntungan_supplier || 0
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      const columnWidths = [
        { wch: 20 },
        { wch: 25 },
        { wch: 15 },
        { wch: 10 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 18 },
        { wch: 15 },
        { wch: 18 }
      ];
      ws['!cols'] = columnWidths;

      const headerRange = XLSX.utils.decode_range(ws['!ref']);
      for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
        if (ws[cellRef]) {
          ws[cellRef].s = {
            font: { bold: true },
            fill: { fgColor: { rgb: "E3F2FD" } },
            alignment: { horizontal: "center" }
          };
        }
      }

      XLSX.utils.book_append_sheet(wb, ws, 'Log Transaksi');

      const currentDate = new Date().toISOString().split('T')[0];
      const timestamp = new Date().toLocaleTimeString('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }).replace(':', '-');
      
      XLSX.writeFile(wb, `Log_Transaksi_${currentDate}_${timestamp}.xlsx`);
      
      showAlertMessage('success', `Data transaksi berhasil diekspor ke Excel (${exportData.length} records)`);
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
    sortField = 'waktu';
    sortDirection = 'desc';
    currentPage = 1;
  }

  $: filteredTransactions = transactions.filter(t => {
    const matchesSearch = 
      (t.kasir && t.kasir.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.produk && t.produk.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.kategori && t.kategori.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.payment_method && t.payment_method.toLowerCase().includes(searchTerm.toLowerCase()));
    
    let matchesDateRange = true;
    if (dateRange.from && dateRange.to) {
      const txDate = new Date(t.waktu);
      const fromDate = dateRange.from;
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      
      matchesDateRange = txDate >= fromDate && txDate <= toDate;
    }
    
    return matchesSearch && matchesDateRange;
  }).sort((a, b) => {
    let aValue = a[sortField] || '';
    let bValue = b[sortField] || '';
    
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }
    
    if (sortField === 'waktu') {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    }
    
    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

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
  <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
    <h2 class="text-2xl md:text-3xl font-bold tracking-tight">Log Transaksi</h2>
    <div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
      <Button 
        on:click={exportToCsv} 
        disabled={isLoading || isExporting} 
        class="w-full sm:w-auto"
      >
        <IconWrapper icon={FileText} className="mr-2 h-4 w-4 {isLoading || isExporting ? 'animate-spin' : ''}" />
        {isExporting ? 'Mengekspor...' : 'Ekspor ke Excel'}
      </Button>
    </div>
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
          class="flex-shrink-0"
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
    <div class="bg-card rounded-lg shadow border border-border overflow-hidden">
      <ScrollArea class="h-[calc(100vh-400px)]" orientation="both">
        <div class="min-w-[1400px] p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-[60px] text-center">No.</TableHead>
                <TableHead class="cursor-pointer w-[160px] text-center" on:click={() => toggleSort('waktu')}>
                  <div class="flex items-center justify-center">
                    Waktu
                    <IconWrapper 
                      icon={sortField === 'waktu' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                    />
                  </div>
                </TableHead>
                <TableHead class="cursor-pointer w-[140px] text-center" on:click={() => toggleSort('produk')}>
                  <div class="flex items-center justify-center">
                    Produk
                    <IconWrapper 
                      icon={sortField === 'produk' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                    />
                  </div>
                </TableHead>
                <TableHead class="cursor-pointer w-[120px] text-center" on:click={() => toggleSort('kategori')}>
                  <div class="flex items-center justify-center">
                    Kategori
                    <IconWrapper 
                      icon={sortField === 'kategori' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                    />
                  </div>
                </TableHead>
                <TableHead class="w-[80px] text-center">Jumlah</TableHead>
                <TableHead class="w-[100px] text-center">Harga</TableHead>
                <TableHead class="cursor-pointer w-[110px] text-center" on:click={() => toggleSort('total')}>
                  <div class="flex items-center justify-center">
                    Total
                    <IconWrapper 
                      icon={sortField === 'total' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                    />
                  </div>
                </TableHead>
                <TableHead class="cursor-pointer w-[100px] text-center" on:click={() => toggleSort('kasir')}>
                  <div class="flex items-center justify-center">
                    Kasir
                    <IconWrapper 
                      icon={sortField === 'kasir' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                    />
                  </div>
                </TableHead>
                <TableHead class="cursor-pointer w-[120px] text-center" on:click={() => toggleSort(`payment_method`)}>
                  <div class="flex items-center justify-center">
                    Metode Pembayaran
                    <IconWrapper 
                      icon={sortField === 'payment_method' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                    />
                  </div>
                </TableHead>
                <TableHead class="w-[110px] text-center">Keuntungan Toko</TableHead>
                <TableHead class="w-[120px] text-center">Keuntungan Supplier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {#each paginatedTransactions as transaction, index (transaction.id)}
                <TableRow>
                  <TableCell class="w-[60px] text-center font-medium">{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
                  <TableCell class="w-[160px] text-center">
                    <div class="text-xs font-medium">{formatDateTime(transaction.waktu)}</div>
                  </TableCell>
                  <TableCell class="w-[140px] text-center">
                    <div class="font-medium truncate" title={transaction.produk}>{transaction.produk}</div>
                  </TableCell>
                  <TableCell class="w-[120px] text-center">
                    <div class="flex items-center gap-2 justify-center">
                      {#if transaction.kategori.toLowerCase() === 'makanan'}
                        <IconWrapper icon={UtensilsCrossed} className="h-4 w-4 text-orange-600" />
                      {:else if transaction.kategori.toLowerCase() === 'minuman'}
                        <IconWrapper icon={Coffee} className="h-4 w-4 text-primary" />
                      {:else if transaction.kategori.toLowerCase() === 'pubj'}
                        <IconWrapper icon={Truck} className="h-4 w-4 text-purple-600" />
                      {:else}
                                                  <IconWrapper icon={Package} className="h-4 w-4 text-muted-foreground" />
                        {/if}
                        <span class="text-sm font-medium text-foreground">
                        {transaction.kategori}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell class="w-[80px] text-center font-medium">{transaction.jumlah}</TableCell>
                  <TableCell class="w-[100px] text-center font-mono text-sm">{formatCurrency(transaction.harga)}</TableCell>
                  <TableCell class="w-[110px] text-center font-mono text-sm font-semibold">{formatCurrency(transaction.total)}</TableCell>
                  <TableCell class="w-[100px] text-center">
                    <div class="flex items-center justify-center gap-1">
                      <div class="w-6 h-6 bg-success/20 rounded-full flex items-center justify-center">
                        <IconWrapper icon={User} className="h-3 w-3 text-success" />
                      </div>
                      <span class="text-sm font-medium truncate" title={transaction.kasir}>{transaction.kasir}</span>
                    </div>
                  </TableCell>
                  <TableCell class="w-[120px] text-center">
                    <Badge variant="outline" class="text-xs">
                      {transaction.payment_method || 'Cash'}
                    </Badge>
                  </TableCell>
                  <TableCell class="w-[110px] text-center">
                                          <span class="font-mono text-sm text-primary font-medium">
                      {formatCurrency(transaction.keuntungan_toko || 0)}
                    </span>
                  </TableCell>
                  <TableCell class="w-[120px] text-center">
                    {#if transaction.is_reseller && transaction.keuntungan_supplier > 0}
                      <span class="font-mono text-sm text-destructive font-medium">
                        {formatCurrency(transaction.keuntungan_supplier)}
                      </span>
                    {:else}
                      <span class="text-muted-foreground text-sm">-</span>
                    {/if}
                  </TableCell>
                </TableRow>
              {/each}
              {#if paginatedTransactions.length === 0}
                <TableRow>
                  <TableCell colspan={11} class="h-24 text-center">
                    {filteredTransactions.length === 0 && transactions.length > 0 ? 'Tidak ada transaksi yang sesuai dengan filter.' : 'Belum ada transaksi yang tersedia.'}
                  </TableCell>
                </TableRow>
              {/if}
            </TableBody>
          </Table>
        </div>
      </ScrollArea>
      
      <Pagination 
        {currentPage}
        totalItems={filteredTransactions.length}
        {itemsPerPage}
        onPageChange={handlePageChange}
        onItemsPerPageChange={handleItemsPerPageChange}
      />
    </div>
  {/if}
</div>
