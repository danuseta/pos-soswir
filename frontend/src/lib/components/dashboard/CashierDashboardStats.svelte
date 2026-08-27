<script lang="ts">
  import { AlertTriangle, Calendar, DollarSign, Package } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { formatCurrency } from '$lib/utils/format';

  export let data: any;

  $: stats = [
    {
      title: 'Penjualan Hari Ini',
      value: formatCurrency(data.todayStats.revenue),
      detail: `${data.todayStats.transactions} transaksi`,
      icon: DollarSign
    },
    {
      title: 'Penjualan Bulan Ini',
      value: formatCurrency(data.monthStats.revenue),
      detail: `${data.monthStats.transactions} transaksi`,
      icon: Calendar
    },
    { title: 'Total Produk', value: data.totals.products, detail: 'produk tersedia', icon: Package },
    { title: 'Stok Rendah', value: data.totals.lowStockProducts, detail: 'perlu restok', icon: AlertTriangle, accent: true }
  ];
</script>

<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
  {#each stats as stat}
    <Card>
      <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle class="text-sm font-medium">{stat.title}</CardTitle>
        <IconWrapper
          icon={stat.icon}
          className={stat.accent ? 'h-4 w-4 text-primary' : 'h-4 w-4 text-muted-foreground'}
        />
      </CardHeader>
      <CardContent>
        <div class:text-primary={stat.accent} class="text-2xl font-bold">{stat.value}</div>
        <p class="text-xs text-muted-foreground">{stat.detail}</p>
      </CardContent>
    </Card>
  {/each}
</div>
