<script lang="ts">
  import { DollarSign, Package, ShoppingCart, TrendingUp, Users } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { formatCurrency } from '$lib/utils/format';

  export let data: any;

  $: stats = [
    { title: 'Total Penjualan', value: formatCurrency(data.totalStats.revenue), detail: `${data.totalStats.transactions} transaksi`, icon: ShoppingCart },
    { title: 'Penjualan Hari Ini', value: formatCurrency(data.todayStats.revenue), detail: `${data.todayStats.transactions} transaksi`, icon: TrendingUp },
    { title: 'Total Produk', value: data.totals.products, detail: `${data.totals.categories} kategori`, icon: Package },
    { title: 'Kasir Aktif', value: data.totals.activeCashiers, detail: `dari ${data.totals.totalCashiers} kasir terdaftar`, icon: Users },
    { title: 'Total Keuntungan Toko', value: formatCurrency(data.totalStats.storeProfit), detail: 'Toko + Pajak PUBJ', icon: DollarSign, accent: true },
    { title: 'Keuntungan Hari Ini', value: formatCurrency(data.todayStats.storeProfit), detail: 'Toko + Pajak PUBJ', icon: DollarSign, accent: true },
    { title: 'Total Untung Supplier', value: formatCurrency(data.totalStats.supplierProfit), detail: 'Pendapatan Supplier PUBJ', icon: Users, accent: true },
    { title: 'Untung Supplier Hari Ini', value: formatCurrency(data.todayStats.supplierProfit), detail: 'Pendapatan Supplier PUBJ', icon: Users, accent: true }
  ];
</script>

<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
  {#each stats as stat}
    <Card>
      <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle class="text-sm font-medium">{stat.title}</CardTitle>
        <IconWrapper icon={stat.icon} className={stat.accent ? 'h-4 w-4 text-primary' : 'h-4 w-4 text-muted-foreground'} />
      </CardHeader>
      <CardContent>
        <div class:text-primary={stat.accent} class="text-2xl font-bold">{stat.value}</div>
        <p class="text-xs text-muted-foreground">{stat.detail}</p>
      </CardContent>
    </Card>
  {/each}
</div>
