<script lang="ts">
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
  import { Badge } from "$lib/components/ui/badge";
  import { DollarSign, ShoppingCart, TrendingUp, Package, AlertTriangle, Calendar, Truck } from "lucide-svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { BACKEND_URL, getAuthHeaders } from "$lib/apiConfig";
  import { browser } from '$app/environment';
  import IconWrapper from "$lib/components/IconWrapper.svelte";
  import { formatTransactionDateTime } from "$lib/utils/format";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";

  let dashboardData = {
    todayStats: { transactions: 0, revenue: 0 },
    monthStats: { transactions: 0, revenue: 0 },
    totals: { products: 0, lowStockProducts: 0 },
    recentSales: [],
    lowStockProducts: [],
    topProducts: [],
    pubjStock: []
  };

  let isLoading = true;
  let error = null;

  let showAlert = false;
  let alertType = 'success';
  let alertMessage = '';

  function showAlertMessage(type: string, message: string) {
    alertType = type;
    alertMessage = message;
    showAlert = true;
    setTimeout(() => {
      showAlert = false;
    }, 3000);
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
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Tanggal tidak valid';
    }
  }

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
      
      showAlertMessage('info', 'Memuat data dashboard...');
      
      const response = await fetch(`${BACKEND_URL}/api/dashboard/cashier`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        dashboardData = await response.json();
        showAlertMessage('success', 'Data dashboard berhasil dimuat');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal memuat data dashboard");
      }
    } catch (err) {
      console.error("Error loading dashboard:", err);
      error = err.message;
      showAlertMessage('error', `Gagal memuat data: ${err.message}`);
    } finally {
      isLoading = false;
    }
  });
</script>

<div class="flex-1 space-y-4 p-4 md:p-8 pt-6">
  <div class="flex items-center justify-between space-y-2">
    <h2 class="text-3xl font-bold tracking-tight">Dashboard Kasir</h2>
  </div>

  {#if showAlert}
    <div class="fixed top-4 right-4 z-50 transition-all duration-300 {showAlert ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}" style="min-width: 300px; max-width: 400px;">
      <Alert variant={alertType === 'error' ? 'destructive' : 'default'} class="border-l-4 {alertType === 'success' ? 'border-l-green-500 bg-green-50 dark:bg-green-900/10 dark:border-green-600' : alertType === 'error' ? 'border-l-red-500 bg-red-50 dark:bg-red-900/10' : 'border-l-green-500 bg-green-50 dark:bg-green-900/10'}">
        <AlertTitle>{alertType === 'success' ? 'Berhasil!' : alertType === 'error' ? 'Error!' : 'Info'}</AlertTitle>
        <AlertDescription>{alertMessage}</AlertDescription>
      </Alert>
    </div>
  {/if}

  {#if isLoading}
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {#each Array(4) as _}
        <Card>
          <CardContent class="p-6">
            <div class="animate-pulse">
              <div class="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div class="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      {/each}
    </div>
  {:else if error}
    <Card>
      <CardContent class="p-8">
        <div class="text-center text-red-500">
          <p class="mb-2 font-semibold">Error:</p>
          <p>{error}</p>
        </div>
      </CardContent>
    </Card>
  {:else}
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Penjualan Hari Ini</CardTitle>
          <IconWrapper icon={DollarSign} className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{formatCurrency(dashboardData.todayStats.revenue)}</div>
          <p class="text-xs text-muted-foreground">{dashboardData.todayStats.transactions} transaksi</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Penjualan Bulan Ini</CardTitle>
          <IconWrapper icon={Calendar} className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{formatCurrency(dashboardData.monthStats.revenue)}</div>
          <p class="text-xs text-muted-foreground">{dashboardData.monthStats.transactions} transaksi</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Total Produk</CardTitle>
          <IconWrapper icon={Package} className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{dashboardData.totals.products}</div>
          <p class="text-xs text-muted-foreground">produk tersedia</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Stok Rendah</CardTitle>
          <IconWrapper icon={AlertTriangle} className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold text-yellow-600">{dashboardData.totals.lowStockProducts}</div>
          <p class="text-xs text-muted-foreground">perlu restok</p>
        </CardContent>
      </Card>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <IconWrapper icon={ShoppingCart} className="h-5 w-5" />
            Penjualan Terbaru
          </CardTitle>
          <CardDescription>10 transaksi terakhir</CardDescription>
        </CardHeader>
        <CardContent>
          {#if dashboardData.recentSales.length > 0}
            <div class="space-y-3">
              {#each dashboardData.recentSales as sale}
                <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div class="flex-1 min-w-0">
                    <p class="font-medium truncate">{sale.customer_name}</p>
                    <p class="text-sm text-muted-foreground">{formatTransactionDateTime(sale.created_at)}</p>
                    <Badge variant="secondary" class="text-xs">{sale.payment_method}</Badge>
                  </div>
                  <div class="text-right ml-2">
                    <p class="font-medium">{formatCurrency(sale.total_amount)}</p>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="text-center py-8 text-muted-foreground">
              <IconWrapper icon={ShoppingCart} className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Belum ada penjualan</p>
            </div>
          {/if}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <IconWrapper icon={TrendingUp} className="h-5 w-5" />
            Produk Terlaris
          </CardTitle>
          <CardDescription>30 hari terakhir</CardDescription>
        </CardHeader>
        <CardContent>
          {#if dashboardData.topProducts.length > 0}
            <div class="space-y-4">
              {#each dashboardData.topProducts as product, index}
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-green-600 dark:text-green-300 text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <p class="font-medium">{product.name}</p>
                      <p class="text-sm text-muted-foreground">{product.total_sold} terjual</p>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="font-medium">{formatCurrency(product.total_revenue)}</p>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="text-center py-8 text-muted-foreground">
              <IconWrapper icon={Package} className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Belum ada penjualan</p>
            </div>
          {/if}
        </CardContent>
      </Card>
    </div>

    {#if dashboardData.lowStockProducts.length > 0}
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <IconWrapper icon={AlertTriangle} className="h-5 w-5 text-yellow-500" />
            Produk Stok Rendah
          </CardTitle>
          <CardDescription>Produk yang perlu segera direstok</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {#each dashboardData.lowStockProducts as product}
              <div class="flex items-center justify-between p-3 border rounded-lg {product.stock <= 5 ? 'border-red-200 bg-red-50 dark:bg-red-900/10' : 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10'}">
                <div>
                  <p class="font-medium">{product.name}</p>
                  <p class="text-sm text-muted-foreground">{formatCurrency(product.price)}</p>
                </div>
                <div class="text-right">
                  <Badge variant={product.stock <= 5 ? 'destructive' : 'secondary'}>
                    {product.stock} tersisa
                  </Badge>
                </div>
              </div>
            {/each}
          </div>
        </CardContent>
      </Card>
    {/if}

    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <IconWrapper icon={Truck} className="h-5 w-5 text-purple-600" />
          Stok PUBJ
        </CardTitle>
        <CardDescription>Data stok produk PUBJ 30 hari terakhir</CardDescription>
      </CardHeader>
      <CardContent>
        {#if dashboardData.pubjStock.length > 0}
          <div class="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Produk</TableHead>
                  <TableHead>Nama Supplier</TableHead>
                  <TableHead class="text-center">Stok Masuk</TableHead>
                  <TableHead class="text-center">Terjual</TableHead>
                  <TableHead class="text-center">Dikembalikan</TableHead>
                  <TableHead class="text-right">Pendapatan Supplier</TableHead>
                  <TableHead class="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {#each dashboardData.pubjStock as stock}
                  <TableRow>
                    <TableCell>
                      <div class="flex items-center gap-2">
                        <IconWrapper icon={Calendar} className="h-4 w-4 text-primary" />
                        {new Date(stock.tanggal).toLocaleDateString('id-ID')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div class="flex items-center gap-2">
                        <div class="w-8 h-8 bg-purple-100 dark:bg-purple-900/20 rounded flex items-center justify-center">
                          <IconWrapper icon={Package} className="h-4 w-4 text-purple-600" />
                        </div>
                        <span class="font-medium">{stock.produk}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span class="text-sm font-medium">{stock.nama_supplier}</span>
                    </TableCell>
                    <TableCell class="text-center font-medium">{stock.stok_masuk}</TableCell>
                    <TableCell class="text-center">
                      <span class="font-medium text-green-600">{stock.terjual}</span>
                    </TableCell>
                    <TableCell class="text-center">
                      <span class="font-medium text-red-600">{stock.sisa}</span>
                    </TableCell>
                    <TableCell class="text-right font-mono">
                      {formatCurrency(stock.pendapatan_supplier || 0)}
                    </TableCell>
                    <TableCell class="text-center">
                      <Badge variant={stock.status === 'active' ? 'default' : stock.status === 'completed' ? 'secondary' : 'outline'}>
                        {stock.status === 'active' ? 'Aktif' : stock.status === 'completed' ? 'Selesai' : 'Dikembalikan'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                {/each}
              </TableBody>
            </Table>
          </div>
        {:else}
          <div class="text-center py-8 text-muted-foreground">
            <IconWrapper icon={Truck} className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Belum ada data stok PUBJ dalam 30 hari terakhir</p>
          </div>
        {/if}
      </CardContent>
    </Card>
  {/if}
</div>

