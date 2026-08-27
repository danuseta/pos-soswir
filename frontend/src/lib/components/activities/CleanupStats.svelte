<script lang="ts">
  import { Activity, AlertTriangle, CheckCircle, Clock, Database } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';

  export let status: any;
  export let formatNumber: (value: number) => string;

  $: data = status?.data ?? {};
  $: cards = [
    {
      title: 'Status Auto Cleanup', value: data.isAutoCleanupActive ? 'Aktif' : 'Non-aktif',
      detail: `Interval: ${data.cleanupInterval || 'Tidak diatur'}`,
      icon: data.isAutoCleanupActive ? CheckCircle : AlertTriangle,
      danger: !data.isAutoCleanupActive
    },
    { title: 'Total Aktivitas', value: formatNumber(data.totalActivities), detail: 'Data aktivitas tersimpan', icon: Activity },
    {
      title: 'Aktivitas > 3 Hari', value: formatNumber(data.oldActivities),
      detail: data.oldActivities > 0 ? 'Perlu dibersihkan' : 'Database bersih', icon: Clock, danger: data.oldActivities > 0
    },
    {
      title: 'Event Scheduler', value: data.eventSchedulerStatus || 'Unknown', detail: 'MySQL Event Status',
      icon: Database, danger: data.eventSchedulerStatus !== 'ENABLED'
    }
  ];
</script>

<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
  {#each cards as card}
    <Card>
      <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle class="text-sm font-medium">{card.title}</CardTitle>
        <IconWrapper icon={card.icon} className={card.danger ? 'h-4 w-4 text-destructive' : 'h-4 w-4 text-primary'} />
      </CardHeader>
      <CardContent><div class="text-2xl font-bold">{card.value}</div><p class="text-xs text-muted-foreground">{card.detail}</p></CardContent>
    </Card>
  {/each}
</div>
