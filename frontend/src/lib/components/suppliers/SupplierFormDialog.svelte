<script lang="ts">
  import { Edit, PlusCircle } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';

  export let open = false;
  export let supplier: any;
  export let isEditing = false;
  export let onClose: () => void;
  export let onSave: () => void;
</script>

<Dialog {open} onOpenChange={(nextOpen) => {
  if (!nextOpen) onClose();
}}>
  <DialogContent class="w-full max-w-[95vw] sm:max-w-[500px]">
    <DialogHeader>
      <DialogTitle>{isEditing ? 'Edit Supplier' : 'Tambah Supplier Baru'}</DialogTitle>
      <DialogDescription>
        {isEditing ? 'Ubah informasi supplier di bawah ini.' : 'Isi informasi untuk supplier baru.'}
      </DialogDescription>
    </DialogHeader>
    <div class="space-y-4 py-4">
      <div>
        <Label for="name" class="text-sm font-medium">Nama Supplier *</Label>
        <Input id="name" bind:value={supplier.name} placeholder="Masukkan nama supplier" class="mt-1" />
      </div>
      <div>
        <Label for="phone" class="text-sm font-medium">No. Telepon</Label>
        <Input id="phone" bind:value={supplier.phone} placeholder="081234567890" class="mt-1" />
        <p class="text-xs text-muted-foreground mt-1">Nomor telepon untuk kontak supplier (opsional)</p>
      </div>
    </div>
    <DialogFooter class="flex flex-col sm:flex-row gap-2">
      <Button variant="outline" on:click={onClose} class="w-full sm:w-auto">Batal</Button>
      <Button on:click={onSave} class="w-full sm:w-auto">
        <IconWrapper icon={isEditing ? Edit : PlusCircle} className="mr-2 h-4 w-4" />
        {isEditing ? 'Update Supplier' : 'Tambah Supplier'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
