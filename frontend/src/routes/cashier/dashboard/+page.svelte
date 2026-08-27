<script lang="ts">
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import { ShoppingCart, TrendingUp, Package, AlertTriangle, Calendar, Truck } from "lucide-svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { api, apiData } from "$lib/apiConfig";
  import { browser } from '$app/environment';
  import IconWrapper from "$lib/components/IconWrapper.svelte";
  import { formatCurrency, formatTransactionDateTime } from "$lib/utils/format";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
  import AlertMessage from '$lib/components/AlertMessage.svelte';
  import CashierDashboardStats from '$lib/components/dashboard/CashierDashboardStats.svelte';
  import { useAlert } from '$lib/composables/useAlert';

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

  const { showAlertMessage } = useAlert();

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
      
      
      dashboardData = await apiData(api.get('/api/dashboard/cashier'));
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

  <AlertMessage />

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
    <CashierDashboardStats data={dashboardData} />

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
                    <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">
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
            <IconWrapper icon={AlertTriangle} className="h-5 w-5 text-primary" />
            Produk Stok Rendah
          </CardTitle>
          <CardDescription>Produk yang perlu segera direstok</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {#each dashboardData.lowStockProducts as product}
              <div class="flex items-center justify-between p-3 border rounded-lg {product.stock <= 5 ? 'border-red-200 bg-red-50 dark:bg-red-900/10' : 'border-border bg-muted'}">
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
          <IconWrapper icon={Truck} className="h-5 w-5 text-primary" />
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
                        <div class="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
                          <IconWrapper icon={Package} className="h-4 w-4 text-primary" />
                        </div>
                        <span class="font-medium">{stock.produk}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span class="text-sm font-medium">{stock.nama_supplier}</span>
                    </TableCell>
                    <TableCell class="text-center font-medium">{stock.stok_masuk}</TableCell>
                    <TableCell class="text-center">
                      <span class="font-medium">{stock.terjual}</span>
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

