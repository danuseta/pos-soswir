<script lang="ts">
  import { Coffee, Package, RefreshCw, Truck, UtensilsCrossed } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
  import { formatCurrency, formatDateTime } from '$lib/utils/format';

  export let open = false;
  export let title = '';
  export let data: any[] = [];
  export let isLoading = false;
  export let onClose: () => void;

  function categoryIcon(name = '') {
    const category = name.toLowerCase();
    if (category === 'makanan') return UtensilsCrossed;
    if (category === 'minuman') return Coffee;
    if (category === 'pubj') return Truck;
    return Package;
  }
</script>

<Dialog {open} onOpenChange={(nextOpen) => {
  if (!nextOpen) onClose();
}}>
  <DialogContent class="max-w-6xl max-h-[90vh] overflow-auto">
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>Detail transaksi dan keuntungan periode yang dipilih</DialogDescription>
    </DialogHeader>
    {#if isLoading}
      <div class="flex items-center justify-center p-8">
        <IconWrapper icon={RefreshCw} className="h-8 w-8 animate-spin mr-2" />
        <span>Memuat detail data...</span>
      </div>
    {:else}
      <div class="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Produk</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Jumlah</TableHead>
              <TableHead>Harga</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Metode Pembayaran</TableHead>
              <TableHead>Kasir</TableHead>
              <TableHead>Keuntungan Toko</TableHead>
              <TableHead>Keuntungan Supplier</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {#each data as item}
              <TableRow>
                <TableCell>{formatDateTime(item.waktu)}</TableCell>
                <TableCell class="font-medium">{item.produk}</TableCell>
                <TableCell>
                  <div class="flex items-center gap-2 justify-center">
                    <IconWrapper icon={categoryIcon(item.kategori)} className="h-4 w-4 text-primary" />
                    <span class="text-sm font-medium text-foreground">{item.kategori}</span>
                  </div>
                </TableCell>
                <TableCell>{item.jumlah}</TableCell>
                <TableCell>{formatCurrency(item.harga)}</TableCell>
                <TableCell>{formatCurrency(item.total)}</TableCell>
                <TableCell><Badge variant="outline">{item.payment_method || 'Cash'}</Badge></TableCell>
                <TableCell>{item.kasir}</TableCell>
                <TableCell class="text-primary">{formatCurrency(item.keuntungan_toko)}</TableCell>
                <TableCell class="text-primary">
                  {item.keuntungan_supplier > 0 ? formatCurrency(item.keuntungan_supplier) : '-'}
                </TableCell>
              </TableRow>
            {/each}
            {#if data.length === 0}
              <TableRow>
                <TableCell colspan={10} class="text-center text-muted-foreground">Tidak ada data untuk ditampilkan</TableCell>
              </TableRow>
            {/if}
          </TableBody>
        </Table>
      </div>
    {/if}
    <DialogFooter>
      <Button variant="outline" on:click={onClose}>Tutup</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
