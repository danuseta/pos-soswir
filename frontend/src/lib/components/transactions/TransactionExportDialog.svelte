<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import type { TransactionExportOptions } from '$lib/utils/transaction';

  export let open = false;
  export let isExporting = false;
  export let onClose: () => void;
  export let onExport: (options: TransactionExportOptions) => void;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let format: TransactionExportOptions['format'] = 'monthly-product';
  let scope: TransactionExportOptions['scope'] = 'single';
  let singleMonth = currentMonth;
  let startMonth = currentMonth;
  let endMonth = currentMonth;

  $: isInvalid = scope === 'single'
    ? !singleMonth
    : scope === 'range'
      ? !startMonth || !endMonth || startMonth > endMonth
      : false;
</script>

<Dialog {open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
  <DialogContent class="sm:max-w-[520px]">
    <DialogHeader>
      <DialogTitle>Export Log Transaksi</DialogTitle>
      <DialogDescription>Pilih bentuk laporan dan periode yang akan dimasukkan ke file Excel.</DialogDescription>
    </DialogHeader>

    <div class="space-y-4 py-2">
      <div class="space-y-2">
        <Label for="transaction-export-format">Jenis laporan</Label>
        <select id="transaction-export-format" bind:value={format} class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="monthly-product">Rekap produk bulanan</option>
          <option value="detail">Detail per transaksi</option>
        </select>
        <p class="text-sm text-muted-foreground">
          {format === 'monthly-product'
            ? 'Satu baris untuk setiap produk pada setiap bulan.'
            : 'Satu baris untuk setiap produk dalam transaksi.'}
        </p>
      </div>

      <div class="space-y-2">
        <Label for="transaction-export-scope">Pilihan periode</Label>
        <select id="transaction-export-scope" bind:value={scope} class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="single">Satu bulan</option>
          <option value="range">Beberapa bulan</option>
          <option value="all">Semua bulan</option>
        </select>
      </div>

      {#if scope === 'single'}
        <div class="space-y-2">
          <Label for="transaction-export-month">Bulan</Label>
          <Input id="transaction-export-month" type="month" bind:value={singleMonth} />
        </div>
      {:else if scope === 'range'}
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="space-y-2">
            <Label for="transaction-export-start">Bulan awal</Label>
            <Input id="transaction-export-start" type="month" bind:value={startMonth} />
          </div>
          <div class="space-y-2">
            <Label for="transaction-export-end">Bulan akhir</Label>
            <Input id="transaction-export-end" type="month" bind:value={endMonth} />
          </div>
        </div>
        {#if startMonth && endMonth && startMonth > endMonth}
          <p class="text-sm text-destructive">Bulan akhir tidak boleh sebelum bulan awal.</p>
        {/if}
      {:else}
        <p class="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">Seluruh histori transaksi akan diekspor.</p>
      {/if}
    </div>

    <DialogFooter>
      <Button variant="outline" on:click={onClose} disabled={isExporting}>Batal</Button>
      <Button
        on:click={() => onExport({ format, scope, singleMonth, startMonth, endMonth })}
        disabled={isExporting || isInvalid}
      >
        {isExporting ? 'Mengekspor...' : 'Export Excel'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
