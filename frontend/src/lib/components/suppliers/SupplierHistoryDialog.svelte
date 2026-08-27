<script lang="ts">
  import { Calendar, DollarSign, Eye, Package, TrendingUp } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
  import { formatCurrency } from '$lib/utils/format';

  export let open = false;
  export let supplier: any = null;
  export let history: any[] = [];
  export let isLoading = false;
  export let onClose: () => void;

  $: supplierRevenue = history.reduce((sum, item) => sum + (parseFloat(item.supplier_earning) || 0), 0);
  $: storeFee = history.reduce((sum, item) => sum + (parseFloat(item.store_fee) || 0), 0);
</script>

{#if supplier}
  <Dialog {open} onOpenChange={(nextOpen) => {
    if (!nextOpen) onClose();
  }}>
    <DialogContent class="w-full max-w-[95vw] lg:max-w-[900px] max-h-[90vh] overflow-hidden">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <IconWrapper icon={Eye} className="h-5 w-5 text-primary" />
          Riwayat Stok - {supplier.name}
        </DialogTitle>
        <DialogDescription>Riwayat stok masuk dan transaksi supplier beserta detail pendapatan</DialogDescription>
      </DialogHeader>
      <div class="space-y-4 py-4 overflow-y-auto max-h-[60vh]">
        {#if isLoading}
          <div class="flex items-center justify-center py-8">
            <div class="text-center">
              <div class="inline-block animate-spin h-8 w-8 border-4 border-t-blue-500 border-r-transparent rounded-full mb-4"></div>
              <p class="text-sm text-muted-foreground">Memuat riwayat supplier...</p>
            </div>
          </div>
        {:else if history.length === 0}
          <div class="text-center py-8">
            <IconWrapper icon={Package} className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p class="text-muted-foreground">Belum ada riwayat stok untuk supplier ini</p>
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <h4 class="font-medium text-primary mb-2 flex items-center gap-2">
                <IconWrapper icon={Calendar} className="h-4 w-4" />
                Rangkuman Historis
              </h4>
              <div class="text-sm text-primary">
                <p>Total produk berbeda: <strong>{new Set(history.map(item => item.product_id)).size}</strong></p>
                <p>Total stok masuk: <strong>{history.reduce((sum, item) => sum + (item.quantity_in || 0), 0)} unit</strong></p>
              </div>
            </div>
            <div class="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <h4 class="font-medium text-primary mb-2 flex items-center gap-2">
                <IconWrapper icon={DollarSign} className="h-4 w-4" />
                Estimasi Total Pendapatan Supplier
              </h4>
              <div class="text-sm text-primary">
                <p>Jika semua produk terjual habis: <strong>{formatCurrency(supplierRevenue)}</strong></p>
                <p class="text-xs mt-1 text-primary">*Berdasarkan harga jual dikurangi fee toko</p>
              </div>
            </div>
            <div class="bg-muted border border-border rounded-lg p-4">
              <h4 class="font-medium text-foreground mb-2 flex items-center gap-2">
                <IconWrapper icon={TrendingUp} className="h-4 w-4" />
                Estimasi Fee Toko
              </h4>
              <div class="text-sm text-foreground">
                <p>Jika semua produk terjual habis: <strong>{formatCurrency(storeFee)}</strong></p>
                <p class="text-xs mt-1 text-primary">*Total fee yang akan diterima toko</p>
              </div>
            </div>
          </div>
          <div class="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Produk</TableHead>
                  <TableHead class="text-center">Stok Masuk</TableHead>
                  <TableHead class="text-center">Terjual</TableHead>
                  <TableHead class="text-center">Sisa</TableHead>
                  <TableHead class="text-right">Pendapatan Supplier</TableHead>
                  <TableHead class="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {#each history as item (item.id)}
                  <TableRow>
                    <TableCell>
                      <div class="flex items-center gap-2">
                        <IconWrapper icon={Calendar} className="h-4 w-4 text-primary" />
                        {new Date(item.entry_date).toLocaleDateString('id-ID')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div class="flex items-center gap-2">
                        <div class="w-8 h-8 bg-muted rounded flex items-center justify-center">
                          <IconWrapper icon={Package} className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span class="font-medium">{item.product_name}</span>
                      </div>
                    </TableCell>
                    <TableCell class="text-center font-medium">{item.quantity_in}</TableCell>
                    <TableCell class="text-center"><span class="font-medium text-primary">{item.quantity_sold}</span></TableCell>
                    <TableCell class="text-center"><span class="font-medium text-primary">{item.quantity_returned}</span></TableCell>
                    <TableCell class="text-right font-mono">{formatCurrency(item.supplier_earning || 0)}</TableCell>
                    <TableCell class="text-center">
                      <Badge variant={item.status === 'active' ? 'default' : item.status === 'completed' ? 'secondary' : 'outline'}>
                        {item.status === 'active' ? 'Aktif' : item.status === 'completed' ? 'Selesai' : 'Dikembalikan'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                {/each}
              </TableBody>
            </Table>
          </div>
        {/if}
      </div>
      <DialogFooter>
        <Button variant="outline" on:click={onClose}>Tutup</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/if}
