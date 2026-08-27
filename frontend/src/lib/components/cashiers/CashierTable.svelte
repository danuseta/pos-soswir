<script lang="ts">
  import { Activity, ArrowUpDown, Edit, Eye, SortAsc, SortDesc, Trash2, User } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import RowActions from '$lib/components/RowActions.svelte';
  import RowActionItem from '$lib/components/RowActionItem.svelte';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';

  export let groups: any[] = [];
  export let shifts: any[] = [];
  export let filteredCount = 0;
  export let allCashiersCount = 0;
  export let sortField = 'username';
  export let sortDirection = 'asc';
  export let formatDate: (value: string) => string;
  export let formatDateOnly: (value: string) => string;
  export let formatTime: (value: string) => string;
  export let formatShiftTime: (value: string) => string;
  export let isOnline: (cashier: any) => boolean;
  export let onSort: (field: string) => void;
  export let onMoveShift: (cashier: any, shiftId: string) => void;
  export let onEditShift: (shift: any) => void;
  export let onDeleteShift: (shift: any) => void;
  export let onActivity: (cashier: any) => void;
  export let onEdit: (cashier: any) => void;
  export let onDelete: (cashierId: number) => void;
</script>

<div class="bg-card rounded-lg shadow border border-border overflow-hidden">
  <ScrollArea class="h-[calc(100vh-400px)]" orientation="both">
    <div class="min-w-[800px] p-0">
      <Table>
        <TableHeader><TableRow><TableHead class="w-[60px] text-center">No.</TableHead><TableHead class="cursor-pointer w-[200px] text-center" on:click={() => onSort('username')}><div class="flex items-center justify-center">Username<IconWrapper icon={sortField === 'username' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} className="ml-2 h-4 w-4" /></div></TableHead><TableHead class="text-center w-[120px]">Status</TableHead><TableHead class="text-center w-[150px]">Login Terakhir</TableHead><TableHead class="text-center cursor-pointer w-[120px]" on:click={() => onSort('created_at')}><div class="flex items-center justify-center">Dibuat<IconWrapper icon={sortField === 'created_at' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} className="ml-2 h-4 w-4" /></div></TableHead><TableHead class="text-center w-[120px]">Aktivitas</TableHead><TableHead class="text-center w-[150px]">Sesi</TableHead><TableHead class="text-center w-[120px]">Aksi</TableHead></TableRow></TableHeader>
        <TableBody>
          {#each groups as group (group.shift ? group.shift.id : 'tanpa-sesi')}
            {#if group.shift || group.cashiers.length > 0}
              <TableRow class="bg-muted/50 hover:bg-muted/50"><TableCell colspan={8} class="py-2"><div class="flex flex-wrap items-center gap-3">{#if group.shift}<span class="font-semibold text-sm">{group.shift.label}</span><span class="text-sm text-muted-foreground">{formatShiftTime(group.shift.start_time)} - {formatShiftTime(group.shift.end_time)} setiap hari</span><span class="text-xs text-muted-foreground">{group.cashiers.length} kasir</span><div class="ml-auto"><RowActions><RowActionItem icon={Edit} label="Edit sesi" on:click={() => onEditShift(group.shift)} /><RowActionItem icon={Trash2} label="Hapus sesi" danger on:click={() => onDeleteShift(group.shift)} /></RowActions></div>{:else}<span class="font-semibold text-sm">Belum ada sesi</span><span class="text-sm text-muted-foreground">Kasir di sini tidak bisa login</span><span class="text-xs text-muted-foreground">{group.cashiers.length} kasir</span>{/if}</div></TableCell></TableRow>
            {/if}
            {#each group.cashiers as cashier, index (cashier.id)}
              <TableRow>
                <TableCell class="font-medium text-center">{index + 1}</TableCell>
                <TableCell class="w-[200px] text-center"><div class="flex items-center gap-3 justify-center"><div class="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center"><IconWrapper icon={User} className="h-5 w-5 text-primary" /></div><div class="min-w-0 flex-1 text-left"><p class="font-medium truncate">{cashier.username}</p><p class="text-sm text-muted-foreground">Kasir</p></div></div></TableCell>
                <TableCell class="text-center"><div class="flex items-center justify-center"><div class="flex items-center gap-2"><div class={`w-2 h-2 rounded-full ${isOnline(cashier) ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`}></div><span class={isOnline(cashier) ? 'text-primary text-sm font-medium' : 'text-muted-foreground text-sm'}>{isOnline(cashier) ? 'Online' : 'Offline'}</span></div></div></TableCell>
                <TableCell class="text-center">{#if cashier.last_login}<div class="text-sm"><div class="font-medium">{formatDate(cashier.last_login)}</div></div>{:else}<span class="text-muted-foreground text-sm">Belum pernah login</span>{/if}</TableCell>
                <TableCell class="text-center"><div class="text-sm"><div class="font-medium">{formatDateOnly(cashier.created_at)}</div><div class="text-muted-foreground text-xs">{formatTime(cashier.created_at)}</div></div></TableCell>
                <TableCell class="text-center"><div class="flex items-center justify-center gap-1"><IconWrapper icon={Activity} className="h-4 w-4 text-primary" /><span class="font-medium text-sm">{cashier.total_activities || 0}</span></div></TableCell>
                <TableCell class="text-center"><select value={cashier.shift_id ?? ''} on:change={(event) => onMoveShift(cashier, event.currentTarget.value)} class="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"><option value="">Tanpa sesi</option>{#each shifts as shift}<option value={shift.id}>{shift.label}</option>{/each}</select></TableCell>
                <TableCell class="text-center"><RowActions><RowActionItem icon={Eye} label="Lihat Aktivitas" on:click={() => onActivity(cashier)} /><RowActionItem icon={Edit} label="Edit" on:click={() => onEdit(cashier)} /><RowActionItem icon={Trash2} label="Hapus" danger on:click={() => onDelete(cashier.id)} /></RowActions></TableCell>
              </TableRow>
            {/each}
          {/each}
          {#if filteredCount === 0}<TableRow><TableCell colspan={8} class="h-24 text-center">{allCashiersCount > 0 ? 'Tidak ada kasir yang sesuai dengan filter.' : 'Belum ada kasir yang tersedia.'}</TableCell></TableRow>{/if}
        </TableBody>
      </Table>
    </div>
  </ScrollArea>
</div>
