<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';

  export let open = false;
  export let shift: any;
  export let isEditing = false;
  export let isSaving = false;
  export let onClose: () => void;
  export let onSave: () => void;
</script>

<Dialog {open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
  <DialogContent class="sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle>{isEditing ? 'Edit Sesi' : 'Tambah Sesi'}</DialogTitle>
      <DialogDescription>Jam sesi berlaku setiap hari. Kasir di sesi ini cuma bisa login pada rentang jam tersebut, dengan toleransi 15 menit.</DialogDescription>
    </DialogHeader>
    <div class="space-y-4 py-2">
      <div class="space-y-2">
        <Label for="sesi-label">Nama sesi</Label>
        <Input id="sesi-label" bind:value={shift.label} placeholder="Sesi 1" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-2">
          <Label for="sesi-mulai">Jam mulai</Label>
          <Input id="sesi-mulai" type="time" bind:value={shift.start_time} />
        </div>
        <div class="space-y-2">
          <Label for="sesi-selesai">Jam selesai</Label>
          <Input id="sesi-selesai" type="time" bind:value={shift.end_time} />
        </div>
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" on:click={onClose} disabled={isSaving}>Batal</Button>
      <Button on:click={onSave} disabled={isSaving}>{isSaving ? 'Menyimpan...' : 'Simpan'}</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
