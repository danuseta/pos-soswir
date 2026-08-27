<script lang="ts">
  import { AlertTriangle, CheckCircle, Clock, Database, Eye, RefreshCw, Settings, Trash2 } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';

  export let showManual = false;
  export let showTest = false;
  export let showRetention = false;
  export let cleanupStatus: any;
  export let testResult: any;
  export let retentionOptions: any;
  export let selectedRetentionDays: any;
  export let selectedInterval: any;
  export let selectedIntervalUnit = '';
  export let isLoadingAction = false;
  export let formatDateTime: (value: string) => string;
  export let formatNumber: (value: number) => string;
  export let onCleanup: () => void;
  export let onUpdate: () => void;

  function syncIntervalUnit(value: string) {
    const options = retentionOptions?.data?.intervals || [];
    const option = options.find(item => item.value == value && item.unit == selectedIntervalUnit)
      || options.find(item => item.value == value);
    if (option) selectedIntervalUnit = option.unit;
  }
</script>

<Dialog bind:open={showManual}>
  <DialogContent>
    <DialogHeader><DialogTitle>Konfirmasi Manual Cleanup</DialogTitle><DialogDescription>Anda akan menghapus <strong>{formatNumber(cleanupStatus?.data?.oldActivities)} aktivitas</strong> yang lebih lama dari {cleanupStatus?.data?.retentionDays} hari.</DialogDescription></DialogHeader>
    <div class="bg-muted p-4 rounded-lg"><div class="flex items-center gap-2 text-foreground"><IconWrapper icon={AlertTriangle} className="h-4 w-4" /><span class="font-medium">Peringatan</span></div><p class="text-sm text-foreground mt-1">Aksi ini tidak dapat dibatalkan. Data yang dihapus tidak dapat dikembalikan.</p></div>
    <DialogFooter><Button variant="outline" on:click={() => showManual = false}>Batal</Button><Button on:click={onCleanup} disabled={isLoadingAction}>{#if isLoadingAction}<IconWrapper icon={RefreshCw} className="mr-2 h-4 w-4 animate-spin" />{:else}<IconWrapper icon={Trash2} className="mr-2 h-4 w-4" />{/if}Hapus Sekarang</Button></DialogFooter>
  </DialogContent>
</Dialog>

<Dialog bind:open={showTest}>
  <DialogContent class="max-w-2xl">
    <DialogHeader><DialogTitle>Hasil Test Cleanup (Dry Run)</DialogTitle><DialogDescription>Simulasi pembersihan data tanpa menghapus data sesungguhnya</DialogDescription></DialogHeader>
    {#if testResult?.data}
      <div class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2"><div class="bg-primary/10 p-4 rounded-lg"><div class="text-2xl font-bold text-primary">{formatNumber(testResult.data.wouldDelete)}</div><div class="text-sm text-primary">Aktivitas akan dihapus</div></div><div class="bg-primary/10 p-4 rounded-lg"><div class="text-2xl font-bold text-primary">{testResult.data.retentionDays}</div><div class="text-sm text-primary">Hari periode retensi</div></div></div>
        {#if testResult.data.wouldDelete > 0}
          <div><h4 class="font-medium mb-2">Rentang Data yang Akan Dihapus:</h4><div class="text-sm text-muted-foreground"><div>Terlama: {formatDateTime(testResult.data.oldestToDelete)}</div><div>Terbaru: {formatDateTime(testResult.data.newestToDelete)}</div></div></div>
          {#if testResult.data.examples?.length > 0}<div><h4 class="font-medium mb-2">Contoh Data (10 pertama):</h4><ScrollArea class="h-[200px]"><Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Username</TableHead><TableHead>Tipe</TableHead><TableHead>Waktu</TableHead></TableRow></TableHeader><TableBody>{#each testResult.data.examples as example}<TableRow><TableCell>{example.id}</TableCell><TableCell>{example.username}</TableCell><TableCell><Badge variant="outline">{example.activity_type}</Badge></TableCell><TableCell>{formatDateTime(example.created_at)}</TableCell></TableRow>{/each}</TableBody></Table></ScrollArea></div>{/if}
        {:else}<div class="text-center p-4 bg-primary/10 rounded-lg"><IconWrapper icon={CheckCircle} className="mx-auto h-8 w-8 text-primary mb-2" /><p class="text-primary">Tidak ada data yang perlu dihapus saat ini.</p></div>{/if}
      </div>
    {/if}
    <DialogFooter><Button variant="outline" on:click={() => showTest = false}>Tutup</Button></DialogFooter>
  </DialogContent>
</Dialog>

<Dialog bind:open={showRetention}>
  <DialogContent class="max-w-2xl">
    <DialogHeader><DialogTitle>Pengaturan Periode Retensi Aktivitas</DialogTitle><DialogDescription>Ubah periode penyimpanan dan frekuensi pembersihan data aktivitas pengguna</DialogDescription></DialogHeader>
    <div class="space-y-6">
      <div class="bg-muted p-4 rounded-lg border border-border"><div class="flex items-center mb-2"><IconWrapper icon={AlertTriangle} className="mr-2 h-5 w-5 text-primary" /><span class="font-medium text-foreground">Peringatan Penting</span></div><p class="text-foreground text-sm">Mengubah pengaturan ini akan merubah event scheduler MySQL dan berlaku segera. Pastikan pengaturan yang dipilih sesuai dengan kebutuhan sistem.</p></div>
      {#if retentionOptions?.data}
        <div><label for="retention-days" class="block text-sm font-medium text-foreground mb-2">Hapus aktivitas setelah:</label><select id="retention-days" bind:value={selectedRetentionDays} class="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary bg-background text-foreground">{#each retentionOptions.data.retentionDays as option}<option value={option.value}>{option.label} - {option.description}</option>{/each}</select></div>
        <div><label for="cleanup-interval" class="block text-sm font-medium text-foreground mb-2">Frekuensi pembersihan:</label><select id="cleanup-interval" bind:value={selectedInterval} on:change={(event) => syncIntervalUnit(event.currentTarget.value)} class="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary bg-background text-foreground">{#each retentionOptions.data.intervals as option}<option value={option.value} data-unit={option.unit}>{option.label} - {option.description}</option>{/each}</select></div>
        <div class="bg-muted p-4 rounded-lg border border-border"><h4 class="font-medium text-foreground mb-3 flex items-center"><IconWrapper icon={Eye} className="mr-2 h-4 w-4" />Preview Pengaturan Baru:</h4><div class="grid gap-2 text-sm"><div class="flex items-center gap-2"><IconWrapper icon={Clock} className="h-4 w-4 text-primary" /><span>Aktivitas akan dihapus setelah <strong>{selectedRetentionDays} hari</strong></span></div><div class="flex items-center gap-2"><IconWrapper icon={RefreshCw} className="h-4 w-4 text-primary" /><span>Pembersihan otomatis <strong>setiap {selectedInterval} {selectedIntervalUnit.toLowerCase()}</strong></span></div><div class="flex items-center gap-2"><IconWrapper icon={Database} className="h-4 w-4 text-primary" /><span>Event scheduler MySQL akan diperbarui</span></div></div><div class="mt-4 pt-4 border-t border-border"><div class="grid md:grid-cols-2 gap-4 text-xs"><div><div class="font-medium text-muted-foreground mb-1">Pengaturan Saat Ini:</div><div class="text-muted-foreground">• Hapus setelah 3 hari<br />• Pembersihan setiap hari</div></div><div><div class="font-medium text-primary mb-1">Pengaturan Baru:</div><div class="text-primary">• Hapus setelah <strong>{selectedRetentionDays} hari</strong><br />• Pembersihan <strong>setiap {selectedInterval} {selectedIntervalUnit.toLowerCase()}</strong></div></div></div></div></div>
      {:else}<div class="flex items-center justify-center py-8"><IconWrapper icon={RefreshCw} className="mr-2 h-5 w-5 animate-spin" /><span>Memuat opsi pengaturan...</span></div>{/if}
    </div>
    <DialogFooter><Button variant="outline" on:click={() => showRetention = false} disabled={isLoadingAction}>Batal</Button><Button on:click={onUpdate} disabled={isLoadingAction || !retentionOptions?.data}>{#if isLoadingAction}<IconWrapper icon={RefreshCw} className="mr-2 h-4 w-4 animate-spin" />{:else}<IconWrapper icon={Settings} className="mr-2 h-4 w-4" />{/if}Update Pengaturan</Button></DialogFooter>
  </DialogContent>
</Dialog>
