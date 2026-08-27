<script lang="ts">
  import { Activity, Circle, User } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
  import { ScrollArea } from '$lib/components/ui/scroll-area';

  export let open = false;
  export let cashierName = '';
  export let activities: any[] = [];
  export let isLoading = false;
  export let formatDate: (value: string) => string;
  export let onClose: () => void;
</script>

<Dialog {open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
  <DialogContent class="sm:max-w-[600px] max-h-[80vh]">
    <DialogHeader>
      <DialogTitle class="flex items-center gap-2">
        <IconWrapper icon={Activity} className="h-5 w-5 text-primary" />
        Detail Aktivitas - {cashierName}
      </DialogTitle>
      <DialogDescription>Riwayat aktivitas kasir dalam 50 record terakhir</DialogDescription>
    </DialogHeader>
    <div class="py-4">
      {#if isLoading}
        <div class="flex justify-center items-center py-8">
          <div class="inline-block animate-spin h-6 w-6 border-4 border-t-primary border-r-transparent rounded-full mr-3"></div>
          <span>Memuat aktivitas...</span>
        </div>
      {:else if activities.length === 0}
        <div class="text-center py-8 text-muted-foreground">
          <IconWrapper icon={Activity} className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <p>Belum ada aktivitas tercatat</p>
        </div>
      {:else}
        <ScrollArea class="h-[400px] w-full rounded-md border">
          <div class="p-4 space-y-3">
            {#each activities as activity}
              <div class="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <div class="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center mt-1">
                  <IconWrapper icon={activity.activity_type === 'login' ? User : activity.activity_type === 'logout' ? Circle : Activity}
                    className={activity.activity_type === 'logout' ? 'h-4 w-4 text-destructive' : 'h-4 w-4 text-primary'} />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="font-medium text-sm capitalize">
                      {activity.activity_type === 'login' ? 'Login' : activity.activity_type === 'logout' ? 'Logout' : 'Navigasi'}
                    </span>
                    {#if activity.activity_type === 'route_change' && activity.route_path}
                      <span class="text-xs bg-primary/10 text-primary px-2 py-1 rounded">{activity.route_path}</span>
                    {/if}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    <div>{formatDate(activity.created_at)}</div>
                    {#if activity.ip_address}<div class="mt-1">IP: {activity.ip_address}</div>{/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </ScrollArea>
        <div class="mt-4 text-sm text-muted-foreground text-center">Total aktivitas: {activities.length} record</div>
      {/if}
    </div>
    <DialogFooter><Button variant="outline" on:click={onClose}>Tutup</Button></DialogFooter>
  </DialogContent>
</Dialog>
