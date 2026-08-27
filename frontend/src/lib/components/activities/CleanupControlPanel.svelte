<script lang="ts">
  import { Activity, AlertTriangle, CheckCircle, Eye, Info, Play, Settings, Sliders } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';

  export let status: any;
  export let logs: any;
  export let isLoadingAction = false;
  export let formatDateTime: (value: string) => string;
  export let formatNumber: (value: number) => string;
  export let onRetention: () => void;
  export let onTest: () => void;
  export let onCleanup: () => void;
</script>

<Card>
  <CardHeader><CardTitle class="flex items-center"><IconWrapper icon={Settings} className="mr-2 h-5 w-5" />Aksi Cleanup</CardTitle><CardDescription>Kelola pembersihan data aktivitas</CardDescription></CardHeader>
  <CardContent class="space-y-4">
    <div class="flex flex-wrap gap-4"><Button on:click={onRetention} variant="outline" disabled={isLoadingAction}><IconWrapper icon={Sliders} className="mr-2 h-4 w-4" />Atur Periode Retensi</Button><Button on:click={onTest} variant="outline" disabled={isLoadingAction}><IconWrapper icon={Eye} className="mr-2 h-4 w-4" />Test Cleanup (Dry Run)</Button><Button on:click={onCleanup} disabled={isLoadingAction || status?.data?.oldActivities === 0}><IconWrapper icon={Play} className="mr-2 h-4 w-4" />Manual Cleanup</Button></div>
    <div class="bg-muted p-4 rounded-lg">
      <div class="flex items-center gap-2 mb-2"><IconWrapper icon={Info} className="h-4 w-4 text-primary" /><span class="font-medium">Informasi Auto Cleanup</span></div>
      <div class="grid gap-3 text-sm">
        <div class="flex justify-between items-center"><span>Periode Retensi:</span><Badge variant="outline" class="text-primary border-primary/20">3 hari (tetap)</Badge></div>
        <div class="flex justify-between items-start"><span>Cleanup Berikutnya:</span><div class="text-right"><div class="font-mono text-primary">{status?.data?.nextCleanup || 'Tidak tersedia'}</div><div class="text-xs text-muted-foreground">{status?.data?.cleanupInterval?.includes('DAY') ? 'Otomatis setiap hari (jam tetap)' : `Otomatis setiap ${status?.data?.cleanupInterval || 'jam'}`}</div></div></div>
        <div class="flex justify-between items-center"><span>Cleanup Terakhir:</span><span class="font-mono">{formatDateTime(status?.data?.lastCleanupLogged || status?.data?.lastCleanupScheduled)}</span></div>
        <div class="mt-3 pt-3 border-t border-border">
          <div class="flex items-center gap-2">{#if status?.data?.oldActivities === 0}<IconWrapper icon={CheckCircle} className="h-4 w-4 text-primary" /><span class="text-primary font-medium">Database bersih - Tidak ada data lama</span>{:else}<IconWrapper icon={AlertTriangle} className="h-4 w-4 text-primary" /><span class="text-primary font-medium">{formatNumber(status?.data?.oldActivities)} aktivitas perlu dibersihkan</span>{/if}</div>
          <div class="mt-2 text-xs text-muted-foreground">• Total aktivitas saat ini: <strong>{formatNumber(status?.data?.totalActivities)}</strong><br />• Aktivitas yang melewati 3 hari: <strong>{formatNumber(status?.data?.oldActivities)}</strong><br />{status?.data?.cleanupInterval?.includes('DAY') ? '• System akan otomatis menghapus aktivitas > 3 hari setiap hari' : `• System akan otomatis menghapus aktivitas > 3 hari setiap ${status?.data?.cleanupInterval || 'interval'}`}</div>
        </div>
      </div>
    </div>
  </CardContent>
</Card>

{#if logs?.data}
  <Card>
    <CardHeader><CardTitle class="flex items-center"><IconWrapper icon={Activity} className="mr-2 h-5 w-5" />Statistik Aktivitas (7 Hari Terakhir)</CardTitle><CardDescription>Distribusi aktivitas pengguna per hari</CardDescription></CardHeader>
    <CardContent><ScrollArea class="h-[300px]"><Table><TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Jumlah Aktivitas</TableHead><TableHead>Persentase</TableHead></TableRow></TableHeader><TableBody>{#each logs.data.dailyActivities as day}{@const percentage = Math.round(day.activity_count / logs.data.statistics.total_activities * 100)}<TableRow><TableCell class="font-medium">{formatDateTime(day.activity_date)}</TableCell><TableCell>{formatNumber(day.activity_count)}</TableCell><TableCell><div class="flex items-center gap-2"><div class="w-20 bg-muted rounded-full h-2"><div class="bg-primary h-2 rounded-full transition-all duration-300" style={`width: ${percentage}%`}></div></div><span class="text-sm font-medium">{percentage}%</span></div></TableCell></TableRow>{/each}</TableBody></Table></ScrollArea></CardContent>
  </Card>
{/if}
