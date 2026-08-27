<script lang="ts">
  import { AlertTriangle, Clock, PlusCircle, Power, PowerOff, Trash2 } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';

  export let showAddStock = false;
  export let stockProduct: any = null;
  export let stockQuantity = 1;
  export let isAddingStock = false;
  export let showDelete = false;
  export let deleteProduct: any = null;
  export let deletePassword = '';
  export let isDeleting = false;
  export let showToggle = false;
  export let toggleProduct: any = null;
  export let isToggling = false;
  export let onCloseStock: () => void;
  export let onAddStock: () => void;
  export let onCloseDelete: () => void;
  export let onDelete: () => void;
  export let onCloseToggle: () => void;
  export let onToggle: () => void;
</script>

{#if showAddStock && stockProduct}
  <Dialog open={showAddStock} onOpenChange={(open) => { if (!open) onCloseStock(); }}>
    <DialogContent class="w-full max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2"><IconWrapper icon={PlusCircle} className="h-5 w-5 text-primary" />Tambah Stok</DialogTitle>
        <DialogDescription>Tambahkan stok untuk produk "{stockProduct.name}".</DialogDescription>
      </DialogHeader>
      <div class="space-y-4 py-4">
        <div class="rounded-lg border border-border bg-muted p-3 text-sm">
          <div class="flex justify-between gap-4"><span class="text-muted-foreground">Stok saat ini</span><span class="font-semibold">{stockProduct.stock}</span></div>
          <div class="mt-1 flex justify-between gap-4"><span class="text-muted-foreground">Stok setelah ditambah</span><span class="font-semibold">{stockProduct.stock + (Number(stockQuantity) || 0)}</span></div>
        </div>
        <div>
          <Label for="stock-quantity">Jumlah stok tambahan *</Label>
          <Input id="stock-quantity" type="number" min="1" step="1" bind:value={stockQuantity} disabled={isAddingStock} class="mt-1" />
        </div>
      </div>
      <DialogFooter class="flex flex-col sm:flex-row gap-2">
        <Button variant="outline" on:click={onCloseStock} disabled={isAddingStock} class="w-full sm:w-auto">Batal</Button>
        <Button on:click={onAddStock} disabled={isAddingStock || !Number.isInteger(Number(stockQuantity)) || Number(stockQuantity) <= 0} class="w-full sm:w-auto">
          <IconWrapper icon={isAddingStock ? Clock : PlusCircle} className={isAddingStock ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
          {isAddingStock ? 'Menambahkan...' : 'Tambah Stok'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/if}

{#if showDelete && deleteProduct}
  <Dialog open={showDelete} onOpenChange={(open) => { if (!open) onCloseDelete(); }}>
    <DialogContent class="w-full max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-destructive"><IconWrapper icon={AlertTriangle} className="h-5 w-5" />Hapus Produk Secara Permanen</DialogTitle>
        <DialogDescription class="text-left">
          <div class="space-y-3">
            <div class="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p class="text-destructive font-medium mb-2">⚠️ PERINGATAN KERAS ⚠️</p>
              <p class="text-destructive text-sm">Anda akan menghapus produk secara PERMANEN dari database. Tindakan ini TIDAK DAPAT dibatalkan!</p>
            </div>
            <div class="bg-muted border border-border rounded-lg p-3">
              <p class="font-medium text-foreground mb-1">Produk yang akan dihapus:</p>
              <p class="text-lg font-bold text-foreground">"{deleteProduct.name}"</p>
              <p class="text-sm text-muted-foreground mt-1">ID: {deleteProduct.id}</p>
            </div>
            <div class="bg-muted border border-border rounded-lg p-3 text-sm">Riwayat transaksi tetap tersimpan untuk audit, tetapi data produk akan dihapus dari sistem.</div>
          </div>
        </DialogDescription>
      </DialogHeader>
      <div class="space-y-4 py-4">
        <div>
          <Label for="delete-password" class="text-sm font-medium text-destructive">Masukkan Password Anda untuk Konfirmasi *</Label>
          <Input id="delete-password" type="password" bind:value={deletePassword} placeholder="Password superadmin Anda..." class="mt-1 border-destructive/30 focus:border-destructive focus:ring-destructive" disabled={isDeleting} />
        </div>
        <div class="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-destructive text-xs space-y-1">
          <p class="font-medium text-sm">Konsekuensi penghapusan:</p>
          <p>• Produk hilang permanen dan tidak bisa di-restore</p><p>• Gambar produk ikut terhapus</p><p>• Riwayat transaksi tetap ada untuk audit</p>
        </div>
      </div>
      <DialogFooter class="flex flex-col sm:flex-row gap-2">
        <Button variant="outline" on:click={onCloseDelete} disabled={isDeleting} class="w-full sm:w-auto">Batal</Button>
        <Button variant="destructive" on:click={onDelete} disabled={isDeleting || !deletePassword.trim()} class="w-full sm:w-auto">
          <IconWrapper icon={isDeleting ? Clock : Trash2} className={isDeleting ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
          {isDeleting ? 'Menghapus...' : 'Hapus Permanen'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/if}

{#if showToggle && toggleProduct}
  <Dialog open={showToggle} onOpenChange={(open) => { if (!open) onCloseToggle(); }}>
    <DialogContent class="w-full max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-primary"><IconWrapper icon={AlertTriangle} className="h-5 w-5" />Konfirmasi Perubahan Status</DialogTitle>
        <DialogDescription class="text-left">
          <div class="space-y-3">
            <div class="bg-muted border border-border rounded-lg p-3">
              <p class="text-foreground font-medium mb-2">{toggleProduct.is_active ? 'Nonaktifkan produk ini?' : 'Aktifkan produk ini?'}</p>
              <p class="text-foreground text-sm">{toggleProduct.is_active ? 'Produk tidak akan muncul di kasir' : 'Produk akan muncul kembali di kasir'}</p>
            </div>
            <div class="bg-muted border border-border rounded-lg p-3">
              <p class="font-medium text-foreground mb-1">Produk:</p><p class="text-lg font-bold text-foreground">"{toggleProduct.name}"</p>
              <p class="text-sm text-muted-foreground">Status saat ini: {toggleProduct.is_active ? 'Aktif' : 'Nonaktif'}</p>
            </div>
          </div>
        </DialogDescription>
      </DialogHeader>
      <DialogFooter class="flex flex-col sm:flex-row gap-2">
        <Button variant="outline" on:click={onCloseToggle} disabled={isToggling} class="w-full sm:w-auto">Batal</Button>
        <Button variant={toggleProduct.is_active ? 'destructive' : 'default'} on:click={onToggle} disabled={isToggling} class="w-full sm:w-auto">
          <IconWrapper icon={isToggling ? Clock : toggleProduct.is_active ? PowerOff : Power} className={isToggling ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
          {isToggling ? 'Memproses...' : toggleProduct.is_active ? 'Nonaktifkan' : 'Aktifkan'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/if}
