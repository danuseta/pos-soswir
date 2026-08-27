<script lang="ts">
  import { TrendingUp } from 'lucide-svelte';
  import { Line } from 'svelte-chartjs';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';

  export let view = 'week';
  export let isLoading = false;
  export let salesTrend: any[] = [];
  export let chartData: any;
  export let chartOptions: any;
  export let trend: { isUp: boolean; percentage: number | string };
  export let description = '';
  export let period = '';
  export let onChange: (view: string) => void;
</script>

<Card>
  <CardHeader>
    <div class="flex items-center justify-between">
      <div><CardTitle>Tren Penjualan</CardTitle><CardDescription>{description}</CardDescription></div>
      <div class="flex items-center space-x-2">
        {#each [['week', 'Minggu'], ['month', 'Bulan'], ['year', 'Tahun']] as option}
          <Button variant={view === option[0] ? 'default' : 'outline'} size="sm" on:click={() => onChange(option[0])} disabled={isLoading}>{option[1]}</Button>
        {/each}
      </div>
    </div>
  </CardHeader>
  <CardContent>
    {#if isLoading}
      <div class="h-80 flex items-center justify-center"><div class="text-center"><div class="inline-block animate-spin h-8 w-8 border-4 border-t-blue-500 border-r-transparent border-b-blue-500 border-l-transparent rounded-full mb-4"></div><p>Memuat data chart...</p></div></div>
    {:else if salesTrend.length > 0 && chartData.labels.length > 0}
      <div class="h-80"><Line data={chartData} options={chartOptions} /></div>
    {:else}
      <div class="h-80 flex items-center justify-center text-muted-foreground"><div class="text-center"><IconWrapper icon={TrendingUp} className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Belum ada data penjualan</p></div></div>
    {/if}
  </CardContent>
  <div class="flex w-full items-start gap-2 text-sm p-6 pt-0"><div class="grid gap-2"><div class="flex items-center gap-2 leading-none font-medium">{trend.isUp ? `Trending up by ${trend.percentage}%` : `Trending down by ${trend.percentage}%`}<IconWrapper icon={TrendingUp} className={`h-4 w-4 ${trend.isUp ? '' : 'rotate-180'}`} /></div><div class="text-muted-foreground flex items-center gap-2 leading-none">{period}</div></div></div>
</Card>
