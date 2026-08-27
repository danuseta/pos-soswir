<script lang="ts">
  import { Activity, Clock, Eye, Package, Percent, ShoppingCart, Store, TrendingUp, Users } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { formatCurrency, formatTransactionDateTime } from '$lib/utils/format';

  export let data: any;
  export let formatDate: (value: string) => string;
  export let describeActivity: (activity: any) => string;
  export let onOpenActivities: () => void;
</script>

<div class="grid gap-4 md:grid-cols-2">
  <Card>
    <CardHeader><CardTitle class="flex items-center gap-2"><IconWrapper icon={Package} className="h-5 w-5" />Performa Kategori & Pajak PUBJ</CardTitle><CardDescription>30 Hari Terakhir</CardDescription></CardHeader>
    <CardContent>
      {#if data.categoryStats?.length}
        <div class="space-y-4">
          {#each data.categoryStats as category}
            <div class="flex items-center justify-between p-3 border rounded-lg">
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 rounded-lg {category.is_reseller ? 'bg-muted' : 'bg-primary/10'} flex items-center justify-center"><IconWrapper icon={category.is_reseller ? Users : Store} className="h-5 w-5 text-primary" /></div>
                <div><p class="font-medium">{category.name}</p><div class="flex items-center gap-2 text-sm text-muted-foreground"><span>{category.product_count || 0} produk</span>{#if category.is_reseller}<Badge variant="outline" class="text-primary border-border"><IconWrapper icon={Percent} className="mr-1 h-3 w-3" />PUBJ</Badge>{/if}</div></div>
              </div>
              <div class="text-right"><p class="font-medium">{formatCurrency(category.total_revenue || 0)}</p>{#if category.is_reseller && category.total_tax_amount}<div class="text-sm"><p class="text-primary">Pajak: {formatCurrency(category.total_tax_amount)}</p><p class="text-primary">Supplier: {formatCurrency(category.total_supplier_amount)}</p></div>{:else}<p class="text-sm text-muted-foreground">Pendapatan Toko</p>{/if}</div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="text-center py-8 text-muted-foreground"><IconWrapper icon={Package} className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Belum ada data kategori</p></div>
      {/if}
    </CardContent>
  </Card>

  <Card>
    <CardHeader><CardTitle class="flex items-center gap-2"><IconWrapper icon={TrendingUp} className="h-5 w-5" />Produk Terlaris</CardTitle><CardDescription>30 Hari Terakhir</CardDescription></CardHeader>
    <CardContent>
      {#if data.topProducts.length}
        <div class="space-y-4">{#each data.topProducts as product, index}<div class="flex items-center justify-between"><div class="flex items-center space-x-3"><div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">{index + 1}</div><div><p class="font-medium">{product.name}</p><div class="flex items-center gap-2 text-sm text-muted-foreground"><span>{product.total_sold} terjual</span>{#if product.is_reseller}<Badge variant="outline" class="text-primary border-border text-xs">PUBJ {product.tax_percentage}%</Badge>{/if}</div></div></div><div class="text-right"><p class="font-medium">{formatCurrency(product.total_revenue)}</p>{#if product.is_reseller && product.store_profit > 0}<p class="text-xs text-primary">Fee: {formatCurrency(product.store_profit)}</p>{/if}</div></div>{/each}</div>
      {:else}
        <div class="text-center py-8 text-muted-foreground"><IconWrapper icon={Package} className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Belum ada penjualan bulan ini</p></div>
      {/if}
    </CardContent>
  </Card>
</div>

<div class="grid gap-4 md:grid-cols-2">
  <Card>
    <CardHeader><CardTitle class="flex items-center gap-2"><IconWrapper icon={Clock} className="h-5 w-5" />Transaksi Terbaru</CardTitle></CardHeader>
    <CardContent>
      {#if data.recentTransactions.length}
        <div class="space-y-3">{#each data.recentTransactions.slice(0, 8) as transaction}<div class="flex items-center justify-between p-3 bg-muted/50 rounded-lg"><div class="flex-1 min-w-0"><p class="font-medium truncate">{transaction.customer_name}</p><div class="flex items-center gap-2 text-sm text-muted-foreground"><span>{formatTransactionDateTime(transaction.created_at)}</span><Badge variant="secondary" class="text-xs">{transaction.cashier_name || 'Unknown'}</Badge></div>{#if transaction.categories}<div class="flex flex-wrap gap-1 mt-1">{#each transaction.categories.split(',').slice(0, 2) as category}<Badge variant="outline" class="text-xs">{category}</Badge>{/each}{#if transaction.categories.split(',').length > 2}<Badge variant="outline" class="text-xs">+{transaction.categories.split(',').length - 2}</Badge>{/if}</div>{/if}</div><div class="text-right ml-2"><p class="font-medium">{formatCurrency(transaction.total_amount)}</p></div></div>{/each}</div>
      {:else}
        <div class="text-center py-8 text-muted-foreground"><IconWrapper icon={ShoppingCart} className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Belum ada transaksi hari ini</p></div>
      {/if}
    </CardContent>
  </Card>

  <Card>
    <CardHeader><CardTitle class="flex items-center gap-2"><IconWrapper icon={Activity} className="h-5 w-5" />Aktivitas Terkini</CardTitle></CardHeader>
    <CardContent>
      {#if data.recentActivities.length}
        <div class="space-y-4">{#each data.recentActivities.slice(0, 8) as activity}<div class="flex items-start space-x-3"><div class="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div><div class="flex-1 min-w-0"><p class="text-sm font-medium truncate">{describeActivity(activity)}</p><p class="text-xs text-muted-foreground">{formatDate(activity.created_at)}</p>{#if activity.route_path}<p class="text-xs text-primary truncate">{activity.route_path}</p>{/if}</div></div>{/each}</div>
        <div class="mt-4"><Button variant="outline" size="sm" on:click={onOpenActivities} class="w-full"><IconWrapper icon={Eye} className="h-4 w-4 mr-2" />Lihat Semua Aktivitas ({data.recentActivities.length})</Button></div>
      {:else}
        <div class="text-center py-8 text-muted-foreground"><IconWrapper icon={Activity} className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Belum ada aktivitas</p></div>
      {/if}
    </CardContent>
  </Card>
</div>
