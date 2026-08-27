<script lang="ts">
  import { Eye, EyeOff } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';

  export let open = false;
  export let cashier: any;
  export let isEditing = false;
  export let onClose: () => void;
  export let onSave: () => void;

  let showPassword = false;
  let showConfirmPassword = false;
</script>

<Dialog {open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
  <DialogContent class="sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle>{isEditing ? 'Edit Kasir' : 'Tambah Kasir Baru'}</DialogTitle>
      <DialogDescription>{isEditing ? 'Ubah detail kasir di bawah ini.' : 'Isi detail untuk kasir baru.'}</DialogDescription>
    </DialogHeader>
    <div class="grid gap-4 py-4">
      <div class="grid grid-cols-4 items-center gap-4">
        <Label for="username" class="text-right">Username</Label>
        <Input id="username" bind:value={cashier.username} class="col-span-3" />
      </div>
      <div class="grid grid-cols-4 items-center gap-4">
        <Label for="password" class="text-right">Password</Label>
        <div class="col-span-3 relative">
          <Input id="password" type={showPassword ? 'text' : 'password'} bind:value={cashier.password}
            placeholder={isEditing ? 'Kosongkan jika tidak ingin mengubah' : 'Password kasir'} />
          <Button type="button" variant="ghost" size="sm" class="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            on:click={() => showPassword = !showPassword}>
            <IconWrapper icon={showPassword ? EyeOff : Eye} className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div class="grid grid-cols-4 items-center gap-4">
        <Label for="confirmPassword" class="text-right">Konfirmasi</Label>
        <div class="col-span-3 relative">
          <Input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} bind:value={cashier.confirmPassword} placeholder="Konfirmasi password" />
          <Button type="button" variant="ghost" size="sm" class="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            on:click={() => showConfirmPassword = !showConfirmPassword}>
            <IconWrapper icon={showConfirmPassword ? EyeOff : Eye} className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" on:click={onClose}>Batal</Button>
      <Button on:click={onSave}>Simpan</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
