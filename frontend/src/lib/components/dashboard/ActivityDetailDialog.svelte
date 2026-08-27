<script lang="ts">
  import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';

  export let open = false;
  export let activities: any[] = [];
  export let describe: (activity: any) => string;
  export let formatDate: (value: string) => string;
  export let onClose: () => void;
</script>

<Dialog {open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
  <DialogContent class="sm:max-w-4xl max-h-[80vh]">
    <DialogHeader>
      <DialogTitle>Detail Aktivitas Terkini</DialogTitle>
      <DialogDescription>Semua aktivitas pengguna dalam sistem ({activities.length} aktivitas)</DialogDescription>
    </DialogHeader>
    <div class="max-h-96 overflow-y-auto">
      {#if activities.length > 0}
        <div class="space-y-3">
          {#each activities as activity}
            <div class="flex items-start space-x-3 p-3 rounded-lg bg-muted/50">
              <div class="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium">{describe(activity)}</p>
                <p class="text-xs text-muted-foreground">{formatDate(activity.created_at)}</p>
                {#if activity.route_path}<p class="text-xs text-primary">Path: {activity.route_path}</p>{/if}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="text-center py-8 text-muted-foreground"><p>Belum ada aktivitas</p></div>
      {/if}
    </div>
  </DialogContent>
</Dialog>
