<script lang="ts">
  import { CheckCircle2, DollarSign, Edit, PlusCircle } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { formatCurrency } from '$lib/utils/format';

  export let showEntry = false;
  export let editingEntry: any = null;
  export let entry: any;
  export let suppliers: any[] = [];
  export let products: any[] = [];
  export let showCompletion = false;
  export let completionEntry: any = null;
  export let showGlobalCompletion = false;
  export let globalCompletion: any;
  export let isGlobalCompleting = false;
  export let showPaid = false;
  export let paidEntry: any = null;
  export let formatDate: (value: any) => string;
  export let onCloseEntry: () => void;
  export let onSaveEntry: () => void;
  export let onCloseCompletion: () => void;
  export let onComplete: () => void;
  export let onCloseGlobal: () => void;
  export let onCompleteGlobal: () => void;
  export let onClosePaid: () => void;
  export let onMarkPaid: () => void;
</script>

{#if showEntry}
  <Dialog open={showEntry} onOpenChange={(open) => { if (!open) onCloseEntry(); }}>
    <DialogContent class="w-full max-w-[95vw] sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>{editingEntry ? 'Edit Stok Harian' : 'Input Stok Harian Baru'}</DialogTitle>
        <DialogDescription>{editingEntry ? 'Ubah data stok harian di bawah ini.' : 'Isi data stok yang masuk hari ini.'}</DialogDescription>
      </DialogHeader>
      <div class="space-y-4 py-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><Label for="entry-date">Tanggal *</Label><Input id="entry-date" type="date" bind:value={entry.entry_date} disabled={Boolean(editingEntry)} /></div>
          <div>
            <Label for="supplier">Supplier *</Label>
            <select id="supplier" bind:value={entry.supplier_id} disabled={Boolean(editingEntry)} class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value={null} disabled>Pilih supplier...</option>
              {#each suppliers as supplier}<option value={supplier.id}>{supplier.name}</option>{/each}
            </select>
          </div>
        </div>
        <div>
          <Label for="product">Produk *</Label>
          <select id="product" bind:value={entry.product_id} disabled={Boolean(editingEntry)} class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value={null} disabled>Pilih produk...</option>
            {#each products as product}<option value={product.id}>{product.name}</option>{/each}
          </select>
        </div>
        <div><Label for="quantity">Jumlah Stok Masuk *</Label><Input id="quantity" type="number" min="1" bind:value={entry.quantity_in} placeholder="0" /></div>
        <div><Label for="notes">Catatan</Label><textarea id="notes" bind:value={entry.notes} class="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Catatan tambahan (opsional)..."></textarea></div>
      </div>
      <DialogFooter class="flex flex-col sm:flex-row gap-2">
        <Button variant="outline" on:click={onCloseEntry} class="w-full sm:w-auto">Batal</Button>
        <Button on:click={onSaveEntry} class="w-full sm:w-auto"><IconWrapper icon={editingEntry ? Edit : PlusCircle} className="mr-2 h-4 w-4" />{editingEntry ? 'Update Entry' : 'Simpan Entry'}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/if}

{#if showCompletion && completionEntry}
  <Dialog open={showCompletion} onOpenChange={(open) => { if (!open) onCloseCompletion(); }}>
    <DialogContent class="w-full max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-primary"><IconWrapper icon={CheckCircle2} className="h-5 w-5" />Selesaikan Stok Harian</DialogTitle>
        <DialogDescription class="text-left space-y-3">
          <div class="bg-primary/10 border border-primary/20 rounded-lg p-3 text-primary text-sm">Entry "{completionEntry.product_name}" akan diselesaikan dan sisa stok dikembalikan ke supplier.</div>
          <div class="bg-muted border border-border rounded-lg p-3 text-sm text-muted-foreground">
            <p><strong>Produk:</strong> {completionEntry.product_name}</p><p><strong>Supplier:</strong> {completionEntry.supplier_name}</p>
            <p><strong>Stok Masuk:</strong> {completionEntry.quantity_in} unit</p><p><strong>Terjual:</strong> {completionEntry.quantity_sold} unit</p>
            <p><strong>Sisa:</strong> {completionEntry.quantity_returned} unit</p><p><strong>Tanggal:</strong> {formatDate(completionEntry.entry_date)}</p>
          </div>
          <div class="bg-muted border border-border rounded-lg p-3 text-sm">Setelah diselesaikan, entry hari ini tidak dapat ditambah atau diubah.</div>
        </DialogDescription>
      </DialogHeader>
      <DialogFooter class="flex flex-col sm:flex-row gap-2"><Button variant="outline" on:click={onCloseCompletion}>Batal</Button><Button on:click={onComplete}><IconWrapper icon={CheckCircle2} className="mr-2 h-4 w-4" />Selesaikan</Button></DialogFooter>
    </DialogContent>
  </Dialog>
{/if}

{#if showGlobalCompletion}
  <Dialog open={showGlobalCompletion} onOpenChange={(open) => { if (!open) onCloseGlobal(); }}>
    <DialogContent class="w-full max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-primary"><IconWrapper icon={CheckCircle2} className="h-5 w-5" />Selesaikan Semua Stok Harian</DialogTitle>
        <DialogDescription class="text-left space-y-3">
          <div class="bg-muted border border-border rounded-lg p-3 text-sm text-muted-foreground">
            <p><strong>Total Entry:</strong> {globalCompletion.totalEntries}</p><p><strong>Total Produk:</strong> {globalCompletion.totalProducts}</p>
            <p><strong>Total Stok Ditambahkan:</strong> {globalCompletion.totalStock} unit</p><p><strong>Tanggal:</strong> {formatDate(new Date())}</p>
          </div>
          <div class="bg-muted border border-border rounded-lg p-3 text-sm">Setelah diselesaikan, entry hari ini tidak dapat ditambah atau diubah.</div>
        </DialogDescription>
      </DialogHeader>
      <DialogFooter class="flex flex-col sm:flex-row gap-2"><Button variant="outline" on:click={onCloseGlobal}>Batal</Button><Button on:click={onCompleteGlobal} disabled={isGlobalCompleting}><IconWrapper icon={CheckCircle2} className="mr-2 h-4 w-4" />Selesaikan Semua</Button></DialogFooter>
    </DialogContent>
  </Dialog>
{/if}

{#if showPaid && paidEntry}
  <Dialog open={showPaid} onOpenChange={(open) => { if (!open) onClosePaid(); }}>
    <DialogContent class="w-full max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-primary"><IconWrapper icon={DollarSign} className="h-5 w-5" />Konfirmasi Pembayaran</DialogTitle>
        <DialogDescription class="text-left space-y-3">
          <div class="bg-primary/10 border border-primary/20 rounded-lg p-3 text-primary text-sm">Entry berikut akan ditandai sudah dibayar ke supplier.</div>
          <div class="bg-muted border border-border rounded-lg p-3 text-sm text-muted-foreground">
            <p><strong>Produk:</strong> {paidEntry.product_name}</p><p><strong>Supplier:</strong> {paidEntry.supplier_name}</p>
            <p><strong>Pendapatan Supplier:</strong> {formatCurrency(paidEntry.supplier_earning || 0)}</p><p><strong>Tanggal:</strong> {formatDate(paidEntry.entry_date)}</p>
          </div>
          <div class="bg-muted border border-border rounded-lg p-3 text-sm">Setelah ditandai dibayar, status tidak dapat diubah kembali.</div>
        </DialogDescription>
      </DialogHeader>
      <DialogFooter class="flex flex-col sm:flex-row gap-2"><Button variant="outline" on:click={onClosePaid}>Batal</Button><Button on:click={onMarkPaid}><IconWrapper icon={DollarSign} className="mr-2 h-4 w-4" />Tandai Dibayar</Button></DialogFooter>
    </DialogContent>
  </Dialog>
{/if}
