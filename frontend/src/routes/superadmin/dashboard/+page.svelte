<script lang="ts">
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "$lib/components/ui/dialog";
  import { DollarSign, ShoppingCart, TrendingUp, Package, Users, Activity, Clock, Eye, Store, Percent } from "lucide-svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { BACKEND_URL, getAuthHeaders } from "$lib/apiConfig";
  import { browser } from '$app/environment';
  import IconWrapper from "$lib/components/IconWrapper.svelte";
  import AlertMessage from "$lib/components/AlertMessage.svelte";
  import { useAlert } from "$lib/composables/useAlert";
  import { formatTransactionDateTime } from "$lib/utils/format";
  
  import { Line } from 'svelte-chartjs';
  import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    LineElement,
    LinearScale,
    PointElement,
    CategoryScale,
    Filler
  } from 'chart.js';

  ChartJS.register(
    Title,
    Tooltip,
    Legend,
    LineElement,
    LinearScale,
    PointElement,
    CategoryScale,
    Filler
  );

  let dashboardData = {
    todayStats: { transactions: 0, revenue: 0, storeProfit: 0, supplierProfit: 0 },
    totalStats: { transactions: 0, revenue: 0, storeProfit: 0, supplierProfit: 0 },
    totals: { products: 0, categories: 0, totalCashiers: 0, activeCashiers: 0 },
    categoryStats: [],
    recentTransactions: [],
    recentActivities: [],
    salesTrend: [],
    topProducts: []
  };

  let isLoading = true;
  let error = null;

  let chartView = 'month';
  let isLoadingChart = false;

  let showActivityDetail = false;
  let selectedActivities = [];

  const { showAlertMessage } = useAlert();

  let chartData = {
    labels: [],
    datasets: []
  };

  function getThemeColors() {
    if (typeof window === 'undefined') return {
      primary: 'rgb(59, 130, 246)',
      primaryAlpha: 'rgba(59, 130, 246, 0.1)',
      text: 'rgb(100, 116, 139)',
      border: 'rgb(226, 232, 240)'
    };

    const isDark = document.documentElement.classList.contains('dark');
    
    return {
      primary: isDark ? 'rgb(59, 130, 246)' : 'rgb(59, 130, 246)',
      primaryAlpha: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
      primaryHover: isDark ? 'rgb(37, 99, 235)' : 'rgb(37, 99, 235)',
      
      text: isDark ? 'rgb(203, 213, 225)' : 'rgb(71, 85, 105)',
      textPrimary: isDark ? 'rgb(241, 245, 249)' : 'rgb(15, 23, 42)',
      
      border: isDark ? 'rgb(71, 85, 105)' : 'rgb(203, 213, 225)',
      gridColor: isDark ? 'rgba(71, 85, 105, 0.5)' : 'rgba(203, 213, 225, 0.5)',
      
      cardBg: isDark ? 'rgb(15, 23, 42)' : 'rgb(255, 255, 255)',
      tooltipBg: isDark ? 'rgb(30, 41, 59)' : 'rgb(248, 250, 252)',
    };
  }

  let chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: () => getThemeColors().tooltipBg,
        titleColor: () => getThemeColors().textPrimary,
        bodyColor: () => getThemeColors().textPrimary,
        borderColor: () => getThemeColors().border,
        borderWidth: 2,
        cornerRadius: 8,
        displayColors: false,
        titleFont: {
          size: 14,
          weight: 'bold' as any
        },
        bodyFont: {
          size: 13
        },
        callbacks: {
          label: function(context) {
            return `Pendapatan: ${formatCurrency(context.parsed.y)}`;
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        grid: {
          display: false,
          color: () => getThemeColors().border
        },
        border: {
          display: false,
          color: () => getThemeColors().border
        },
        ticks: {
          color: () => getThemeColors().text,
          font: {
            family: 'Inter, system-ui, sans-serif'
          }
        }
      },
      y: {
        display: true,
        grid: {
          color: () => getThemeColors().gridColor,
          borderDash: [3, 3],
          lineWidth: 1
        },
        border: {
          display: false,
          color: () => getThemeColors().border
        },
        ticks: {
          color: () => getThemeColors().text,
          font: {
            family: 'Inter, system-ui, sans-serif'
          },
          callback: function(value) {
            return formatCurrencyShort(value);
          }
        }
      }
    },
    elements: {
      point: {
        radius: 0,
        hoverRadius: 8,
        borderWidth: 2,
        hoverBorderWidth: 3
      },
      line: {
        borderWidth: 3
      }
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false
    }
  };



  async function changeChartView(newView) {
    if (newView === chartView) return;
    
    chartView = newView;
    isLoadingChart = true;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/dashboard?view=${chartView}`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const newData = await response.json();
        dashboardData.salesTrend = newData.salesTrend;
        prepareChartData();
      }
    } catch (err) {
      console.error("Error loading chart data:", err);
    } finally {
      isLoadingChart = false;
    }
  }

  function formatChartLabel(item, view) {
    const date = new Date(item.date);
    switch (view) {
      case 'year':
        return item.year || date.getFullYear().toString();
      case 'week':
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
      default:
        return date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
    }
  }

  function prepareChartData() {
    if (dashboardData.salesTrend.length === 0) return;

    const labels = dashboardData.salesTrend.map(item => formatChartLabel(item, chartView));
    const revenueData = dashboardData.salesTrend.map(item => parseFloat(item.revenue) || 0);
    const themeColors = getThemeColors();

    chartData = {
      labels: labels,
      datasets: [
        {
          label: 'Pendapatan',
          data: revenueData,
          borderColor: themeColors.primary,
          backgroundColor: themeColors.primaryAlpha,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: themeColors.primary,
          pointBorderColor: themeColors.primary,
          pointHoverBackgroundColor: themeColors.primaryHover,
          pointHoverBorderColor: themeColors.primaryHover,
          pointBorderWidth: 2,
          pointHoverBorderWidth: 3
        }
      ]
    };
  }

  function getChartDescription() {
    switch (chartView) {
      case 'year':
        return 'Pendapatan 5 tahun terakhir';
      case 'week':
        return 'Pendapatan 7 hari terakhir';
      default:
        return 'Pendapatan 6 bulan terakhir';
    }
  }

  function getChartPeriod() {
    switch (chartView) {
      case 'year':
        return '5 tahun terakhir';
      case 'week':
        return '7 hari terakhir';
      default:
        return '6 bulan terakhir';
    }
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  }

  function formatCurrencyShort(amount) {
    if (amount >= 1000000) {
      return (amount / 1000000).toFixed(1) + 'M';
    } else if (amount >= 1000) {
      return (amount / 1000).toFixed(0) + 'K';
    }
    return amount.toString();
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

  function getActivityDescription(activity) {
    const username = activity.username || activity.user_name || 'Unknown';
    
    switch (activity.activity_type) {
      case 'login':
        return `${username} masuk ke sistem`;
      case 'logout':
        return `${username} keluar dari sistem`;
      case 'route_change':
        return `${username} mengakses ${activity.route_path}`;
      default:
        return `${username} melakukan aktivitas`;
    }
  }

  function openActivityDetail() {
    selectedActivities = dashboardData.recentActivities;
    showActivityDetail = true;
  }

  function getTrendPercentage() {
    if (dashboardData.salesTrend.length < 2) return { percentage: 0, isUp: true };
    
    const latest = parseFloat(dashboardData.salesTrend[dashboardData.salesTrend.length - 1]?.revenue || 0);
    const previous = parseFloat(dashboardData.salesTrend[dashboardData.salesTrend.length - 2]?.revenue || 0);
    
    if (previous === 0) return { percentage: 0, isUp: true };
    
    const percentage = ((latest - previous) / previous) * 100;
    return { percentage: Math.abs(percentage).toFixed(1), isUp: percentage >= 0 };
  }

  $: trendData = getTrendPercentage();

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
      
      showAlertMessage('info', 'Memuat data dashboard...');
      
      const response = await fetch(`${BACKEND_URL}/api/dashboard?view=${chartView}`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        dashboardData = await response.json();
        prepareChartData();
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
    <h2 class="text-3xl font-bold tracking-tight">Dashboard</h2>
  </div>

  <AlertMessage />

  {#if isLoading}
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {#each Array(8) as _}
        <Card>
          <CardContent class="p-6">
            <div class="animate-pulse">
            <div class="h-4 bg-muted rounded w-3/4 mb-2"></div>
            <div class="h-8 bg-muted rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      {/each}
    </div>
  {:else if error}
    <Card>
      <CardContent class="p-8">
        <div class="text-center text-destructive">
          <p class="mb-2 font-semibold">Error:</p>
          <p>{error}</p>
        </div>
      </CardContent>
    </Card>
  {:else}
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Total Penjualan</CardTitle>
          <IconWrapper icon={ShoppingCart} className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{formatCurrency(dashboardData.totalStats.revenue)}</div>
          <p class="text-xs text-muted-foreground">{dashboardData.totalStats.transactions} transaksi</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Penjualan Hari Ini</CardTitle>
          <IconWrapper icon={TrendingUp} className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{formatCurrency(dashboardData.todayStats.revenue)}</div>
          <p class="text-xs text-muted-foreground">{dashboardData.todayStats.transactions} transaksi</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Total Produk</CardTitle>
          <IconWrapper icon={Package} className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{dashboardData.totals.products}</div>
          <p class="text-xs text-muted-foreground">{dashboardData.totals.categories} kategori</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Kasir Aktif</CardTitle>
          <IconWrapper icon={Users} className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{dashboardData.totals.activeCashiers}</div>
          <p class="text-xs text-muted-foreground">dari {dashboardData.totals.totalCashiers} kasir terdaftar</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Total Keuntungan Toko</CardTitle>
          <IconWrapper icon={DollarSign} className="h-4 w-4 text-success" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold text-success">{formatCurrency(dashboardData.totalStats.storeProfit)}</div>
          <p class="text-xs text-muted-foreground">Toko + Pajak PUBJ</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Keuntungan Hari Ini</CardTitle>
          <IconWrapper icon={DollarSign} className="h-4 w-4 text-success" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold text-success">{formatCurrency(dashboardData.todayStats.storeProfit)}</div>
          <p class="text-xs text-muted-foreground">Toko + Pajak PUBJ</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Total Untung Supplier</CardTitle>
                          <IconWrapper icon={Users} className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
                <div class="text-2xl font-bold text-primary">{formatCurrency(dashboardData.totalStats.supplierProfit)}</div>
          <p class="text-xs text-muted-foreground">Pendapatan Supplier PUBJ</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Untung Supplier Hari Ini</CardTitle>
                          <IconWrapper icon={Users} className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
                <div class="text-2xl font-bold text-primary">{formatCurrency(dashboardData.todayStats.supplierProfit)}</div>
          <p class="text-xs text-muted-foreground">Pendapatan Supplier PUBJ</p>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader>
        <div class="flex items-center justify-between">
          <div>
            <CardTitle>Tren Penjualan</CardTitle>
            <CardDescription>
              {getChartDescription()}
            </CardDescription>
          </div>
          <div class="flex items-center space-x-2">
            <Button
              variant={chartView === 'week' ? 'default' : 'outline'}
              size="sm"
              on:click={() => changeChartView('week')}
              disabled={isLoadingChart}
            >
              Minggu
            </Button>
            <Button
              variant={chartView === 'month' ? 'default' : 'outline'}
              size="sm"
              on:click={() => changeChartView('month')}
              disabled={isLoadingChart}
            >
              Bulan
            </Button>
            <Button
              variant={chartView === 'year' ? 'default' : 'outline'}
              size="sm"
              on:click={() => changeChartView('year')}
              disabled={isLoadingChart}
            >
              Tahun
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {#if isLoadingChart}
          <div class="h-80 flex items-center justify-center">
            <div class="text-center">
              <div class="inline-block animate-spin h-8 w-8 border-4 border-t-blue-500 border-r-transparent border-b-blue-500 border-l-transparent rounded-full mb-4"></div>
              <p>Memuat data chart...</p>
            </div>
          </div>
        {:else if dashboardData.salesTrend.length > 0 && chartData.labels.length > 0}
          <div class="h-80">
            <Line data={chartData} options={chartOptions} />
          </div>
        {:else}
          <div class="h-80 flex items-center justify-center text-muted-foreground">
            <div class="text-center">
              <IconWrapper icon={TrendingUp} className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Belum ada data penjualan</p>
            </div>
          </div>
        {/if}
      </CardContent>
      <div class="flex w-full items-start gap-2 text-sm p-6 pt-0">
        <div class="grid gap-2">
          <div class="flex items-center gap-2 leading-none font-medium">
            {#if trendData.isUp}
              Trending up by {trendData.percentage}% <IconWrapper icon={TrendingUp} className="h-4 w-4" />
            {:else}
              Trending down by {trendData.percentage}% <IconWrapper icon={TrendingUp} className="h-4 w-4 rotate-180" />
            {/if}
          </div>
          <div class="text-muted-foreground flex items-center gap-2 leading-none">
            {getChartPeriod()}
          </div>
        </div>
      </div>
    </Card>

    <div class="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <IconWrapper icon={Package} className="h-5 w-5" />
            Performa Kategori & Pajak PUBJ
          </CardTitle>
          <CardDescription>30 Hari Terakhir</CardDescription>
        </CardHeader>
        <CardContent>
          {#if dashboardData.categoryStats && dashboardData.categoryStats.length > 0}
            <div class="space-y-4">
              {#each dashboardData.categoryStats as category}
                <div class="flex items-center justify-between p-3 border rounded-lg">
                  <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-lg {category.is_reseller ? 'bg-orange-100 dark:bg-orange-900' : 'bg-primary/10'} flex items-center justify-center">
                      <IconWrapper 
                        icon={category.is_reseller ? Users : Store} 
                        className="h-5 w-5 {category.is_reseller ? 'text-orange-600 dark:text-orange-300' : 'text-primary'}" 
                      />
                    </div>
                    <div>
                      <p class="font-medium">{category.name}</p>
                      <div class="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{category.product_count || 0} produk</span>
                        {#if category.is_reseller}
                          <Badge variant="outline" class="text-orange-600 border-orange-300">
                            <IconWrapper icon={Percent} className="mr-1 h-3 w-3" />
                            PUBJ
                          </Badge>
                        {/if}
                      </div>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="font-medium">{formatCurrency(category.total_revenue || 0)}</p>
                    {#if category.is_reseller && category.total_tax_amount}
                      <div class="text-sm">
                        <p class="text-success">Pajak: {formatCurrency(category.total_tax_amount)}</p>
                        <p class="text-primary">Supplier: {formatCurrency(category.total_supplier_amount)}</p>
                      </div>
                    {:else}
                      <p class="text-sm text-muted-foreground">Pendapatan Toko</p>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="text-center py-8 text-muted-foreground">
              <IconWrapper icon={Package} className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Belum ada data kategori</p>
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
          <CardDescription>30 Hari Terakhir</CardDescription>
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
                      <div class="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{product.total_sold} terjual</span>
                        {#if product.is_reseller}
                          <Badge variant="outline" class="text-orange-600 border-orange-300 text-xs">
                            PUBJ {product.tax_percentage}%
                          </Badge>
                        {/if}
                      </div>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="font-medium">{formatCurrency(product.total_revenue)}</p>
                    {#if product.is_reseller && product.store_profit > 0}
                                              <p class="text-xs text-success">
                        Fee: {formatCurrency(product.store_profit)}
                      </p>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="text-center py-8 text-muted-foreground">
              <IconWrapper icon={Package} className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Belum ada penjualan bulan ini</p>
            </div>
          {/if}
        </CardContent>
      </Card>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <IconWrapper icon={Clock} className="h-5 w-5" />
            Transaksi Terbaru
          </CardTitle>
        </CardHeader>
        <CardContent>
          {#if dashboardData.recentTransactions.length > 0}
            <div class="space-y-3">
              {#each dashboardData.recentTransactions.slice(0, 8) as transaction}
                <div class="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div class="flex-1 min-w-0">
                    <p class="font-medium truncate">{transaction.customer_name}</p>
                    <div class="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{formatTransactionDateTime(transaction.created_at)}</span>
                      <Badge variant="secondary" class="text-xs">{transaction.cashier_name || 'Unknown'}</Badge>
                    </div>
                    {#if transaction.categories}
                      <div class="flex flex-wrap gap-1 mt-1">
                        {#each transaction.categories.split(',').slice(0, 2) as category}
                          <Badge variant="outline" class="text-xs">{category}</Badge>
                        {/each}
                        {#if transaction.categories.split(',').length > 2}
                          <Badge variant="outline" class="text-xs">+{transaction.categories.split(',').length - 2}</Badge>
                        {/if}
                      </div>
                    {/if}
                  </div>
                  <div class="text-right ml-2">
                    <p class="font-medium">{formatCurrency(transaction.total_amount)}</p>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="text-center py-8 text-muted-foreground">
              <IconWrapper icon={ShoppingCart} className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Belum ada transaksi hari ini</p>
            </div>
          {/if}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <IconWrapper icon={Activity} className="h-5 w-5" />
            Aktivitas Terkini
          </CardTitle>
        </CardHeader>
        <CardContent>
          {#if dashboardData.recentActivities.length > 0}
            <div class="space-y-4">
              {#each dashboardData.recentActivities.slice(0, 8) as activity}
                <div class="flex items-start space-x-3">
                  <div class="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium truncate">
                      {getActivityDescription(activity)}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {formatDate(activity.created_at)}
                    </p>
                    {#if activity.route_path}
                      <p class="text-xs text-primary truncate">
                        {activity.route_path}
                      </p>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
            <div class="mt-4">
              <Button variant="outline" size="sm" on:click={openActivityDetail} class="w-full">
                <IconWrapper icon={Eye} className="h-4 w-4 mr-2" />
                Lihat Semua Aktivitas ({dashboardData.recentActivities.length})
              </Button>
            </div>
          {:else}
            <div class="text-center py-8 text-muted-foreground">
              <IconWrapper icon={Activity} className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Belum ada aktivitas</p>
            </div>
          {/if}
        </CardContent>
      </Card>
    </div>
  {/if}
</div>

<Dialog bind:open={showActivityDetail}>
  <DialogContent class="sm:max-w-4xl max-h-[80vh]">
    <DialogHeader>
      <DialogTitle>Detail Aktivitas Terkini</DialogTitle>
      <DialogDescription>
        Semua aktivitas pengguna dalam sistem ({selectedActivities.length} aktivitas)
      </DialogDescription>
    </DialogHeader>
    
    <div class="max-h-96 overflow-y-auto">
      {#if selectedActivities.length > 0}
        <div class="space-y-3">
          {#each selectedActivities as activity}
            <div class="flex items-start space-x-3 p-3 rounded-lg bg-muted/50">
              <div class="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium">
                  {getActivityDescription(activity)}
                </p>
                <p class="text-xs text-muted-foreground">
                  {formatDate(activity.created_at)}
                </p>
                {#if activity.route_path}
                  <p class="text-xs text-primary">
                    Path: {activity.route_path}
                  </p>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="text-center py-8 text-muted-foreground">
          <p>Belum ada aktivitas</p>
        </div>
      {/if}
    </div>
  </DialogContent>
</Dialog>

