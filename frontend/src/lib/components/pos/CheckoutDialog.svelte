<script lang="ts">
  import { Clock, CreditCard } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { formatCurrency } from '$lib/utils/format';

  export let open = false;
  export let customerName = 'Umum';
  export let paymentMethod = 'Cash';
  export let cart: any[] = [];
  export let total = 0;
  export let isProcessing = false;
  export let onClose: () => void;
  export let onConfirm: () => void;
</script>

<Dialog {open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
  <DialogContent class="sm:max-w-lg xl:max-w-md w-[95vw] sm:w-full">
    <DialogHeader><DialogTitle>Checkout</DialogTitle><DialogDescription>Konfirmasi detail transaksi</DialogDescription></DialogHeader>
    <div class="space-y-4">
      <div>
        <label for="customer_name" class="text-sm font-medium block mb-2">Nama Pelanggan</label>
        <Input id="customer_name" bind:value={customerName} placeholder="Masukkan nama pelanggan (opsional)" class="w-full h-10 sm:h-11 text-base" />
        <p class="text-xs text-muted-foreground mt-1">Kosongkan untuk pelanggan umum</p>
      </div>
      <div>
        <label for="payment_method" class="text-sm font-medium block mb-2">Metode Pembayaran</label>
        <select id="payment_method" bind:value={paymentMethod} class="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring text-base">
          <option value="Cash">Cash / Tunai</option><option value="Card">Kartu Debit/Kredit</option>
          <option value="Transfer">Transfer Bank</option><option value="E-Wallet">E-Wallet (GoPay, OVO, etc.)</option><option value="QRIS">QRIS</option>
        </select>
      </div>
      <div class="bg-muted p-4 rounded-lg">
        <h4 class="font-medium mb-2">Ringkasan Pesanan:</h4>
        <div class="space-y-1 text-sm">
          {#each cart as item}<div class="flex justify-between"><span>{item.name} x{item.quantity}</span><span class="font-medium">{formatCurrency(item.price * item.quantity)}</span></div>{/each}
        </div>
        <hr class="my-2"><div class="flex justify-between items-center text-lg font-semibold"><span>Total:</span><span class="text-primary">{formatCurrency(total)}</span></div>
      </div>
    </div>
    <DialogFooter class="mt-4">
      <div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <Button variant="outline" on:click={onClose} class="w-full sm:w-auto">Batal</Button>
        <Button on:click={onConfirm} disabled={isProcessing} class="w-full sm:w-auto">
          <IconWrapper icon={isProcessing ? Clock : CreditCard} className={isProcessing ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
          {isProcessing ? 'Memproses...' : 'Konfirmasi Pembayaran'}
        </Button>
      </div>
    </DialogFooter>
  </DialogContent>
</Dialog>
