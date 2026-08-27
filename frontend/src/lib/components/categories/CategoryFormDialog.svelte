<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Switch } from '$lib/components/ui/switch';

  export let open = false;
  export let category: any;
  export let isEditing = false;
  export let onClose: () => void;
  export let onSave: () => void;
</script>

<Dialog {open} onOpenChange={(nextOpen) => {
  if (!nextOpen) onClose();
}}>
  <DialogContent class="sm:max-w-[500px]">
    <DialogHeader>
      <DialogTitle>{isEditing ? 'Edit Kategori' : 'Tambah Kategori Baru'}</DialogTitle>
      <DialogDescription>
        {isEditing ? 'Ubah detail kategori di bawah ini.' : 'Isi detail untuk kategori baru.'}
      </DialogDescription>
    </DialogHeader>
    <div class="grid gap-4 py-4">
      <div class="grid grid-cols-4 items-center gap-4">
        <Label for="name" class="text-right">Nama</Label>
        <Input id="name" bind:value={category.name} class="col-span-3" placeholder="Nama kategori" />
      </div>
      <div class="grid grid-cols-4 items-center gap-4">
        <Label for="description" class="text-right">Deskripsi</Label>
        <textarea
          id="description"
          bind:value={category.description}
          class="col-span-3 flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Deskripsi kategori (opsional)..."
        ></textarea>
      </div>
      <div class="grid grid-cols-4 items-center gap-4">
        <Label for="is_reseller" class="text-right">Jenis Kategori</Label>
        <div class="col-span-3 flex items-center space-x-2">
          <Switch id="is_reseller" bind:checked={category.is_reseller} />
          <Label for="is_reseller" class="text-sm">
            {category.is_reseller ? 'Penitipan/Reseller (PUBJ)' : 'Produk Toko'}
          </Label>
        </div>
      </div>
      {#if category.is_reseller}
        <div class="bg-muted p-4 rounded-lg">
          <p class="text-sm text-foreground mb-2">
            <strong>Info PUBJ:</strong> Pajak akan ditentukan per produk saat menambah/edit produk dalam kategori ini.
          </p>
          <p class="text-xs text-primary">Contoh: Risol 10%, Tahu Isi 15%, Martabak 12%</p>
        </div>
      {/if}
    </div>
    <DialogFooter>
      <Button variant="outline" on:click={onClose}>Batal</Button>
      <Button on:click={onSave}>Simpan</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
