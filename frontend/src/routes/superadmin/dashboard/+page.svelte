<script lang="ts">
  import { Card, CardContent } from "$lib/components/ui/card";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { api, apiData } from "$lib/apiConfig";
  import { browser } from '$app/environment';
  import AlertMessage from "$lib/components/AlertMessage.svelte";
  import { useAlert } from "$lib/composables/useAlert";
  import ActivityDetailDialog from '$lib/components/dashboard/ActivityDetailDialog.svelte';
  import DashboardOverviewPanels from '$lib/components/dashboard/DashboardOverviewPanels.svelte';
  import DashboardStats from '$lib/components/dashboard/DashboardStats.svelte';
  import SalesTrendCard from '$lib/components/dashboard/SalesTrendCard.svelte';
  import {
    createDashboardChartData,
    dashboardChartOptions,
    getChartDescription,
    getChartPeriod,
    getTrendData
  } from '$lib/utils/dashboardChart';

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

  const chartOptions = dashboardChartOptions;

  async function changeChartView(newView) {
    if (newView === chartView) return;
    
    chartView = newView;
    isLoadingChart = true;
    
    try {
      const newData = await apiData<any>(api.get(`/api/dashboard?view=${chartView}`));
      dashboardData.salesTrend = newData.salesTrend;
      prepareChartData();
    } catch (err) {
      console.error("Error loading chart data:", err);
    } finally {
      isLoadingChart = false;
    }
  }

  function prepareChartData() {
    chartData = createDashboardChartData(dashboardData.salesTrend, chartView);
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

  $: trendData = getTrendData(dashboardData.salesTrend);

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
      
      
      dashboardData = await apiData<any>(api.get(`/api/dashboard?view=${chartView}`));
      prepareChartData();
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
    <DashboardStats data={dashboardData} />

    <SalesTrendCard view={chartView} isLoading={isLoadingChart} salesTrend={dashboardData.salesTrend} {chartData} {chartOptions} trend={trendData} description={getChartDescription(chartView)} period={getChartPeriod(chartView)} onChange={changeChartView} />

    <DashboardOverviewPanels data={dashboardData} {formatDate} describeActivity={getActivityDescription} onOpenActivities={openActivityDetail} />
  {/if}
</div>

<ActivityDetailDialog
  open={showActivityDetail}
  activities={selectedActivities}
  describe={getActivityDescription}
  {formatDate}
  onClose={() => showActivityDetail = false}
/>

