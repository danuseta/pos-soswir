<script lang="ts">
  import { Edit, PlusCircle, Upload, Users } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { formatCurrency } from '$lib/utils/format';

  export let open = false;
  export let product: any;
  export let categories: any[] = [];
  export let suppliers: any[] = [];
  export let isEditing = false;
  export let isReseller = false;
  export let imageFile: File | null = null;
  export let imagePreview = '';
  export let isUploading = false;
  export let onClose: () => void;
  export let onSave: () => void;

  function handleImageSelect(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    imageFile = file;
    const reader = new FileReader();
    reader.onload = () => imagePreview = String(reader.result || '');
    reader.readAsDataURL(file);
  }
</script>

<Dialog {open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
  <DialogContent class="w-full max-w-[95vw] sm:max-w-[700px] max-h-[95vh] overflow-y-auto mx-4">
    <DialogHeader>
      <DialogTitle class="text-lg sm:text-xl">{isEditing ? 'Edit Produk' : 'Tambah Produk Baru'}</DialogTitle>
      <DialogDescription class="text-sm">{isEditing ? 'Ubah detail produk di bawah ini.' : 'Isi detail untuk produk baru.'}</DialogDescription>
    </DialogHeader>

    <div class="space-y-6 py-4">
      <div class="space-y-4">
        <h4 class="font-medium text-base">Informasi Dasar</h4>
        <div class="space-y-3">
          <div>
            <Label for="name" class="text-sm font-medium">Nama Produk *</Label>
            <Input id="name" bind:value={product.name} placeholder="Masukkan nama produk" class="mt-1" />
          </div>
          <div>
            <Label for="category" class="text-sm font-medium">Kategori *</Label>
            <select id="category" bind:value={product.category_id} class="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value={null} disabled>Pilih kategori...</option>
              {#each categories as category (category.id)}<option value={category.id}>{category.name}</option>{/each}
            </select>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label for="price" class="text-sm font-medium">Harga (Rp) *</Label>
              <Input id="price" type="number" min="0" step="100" bind:value={product.price} placeholder="0" class="mt-1" />
            </div>
            <div>
              <Label for="stock" class="text-sm font-medium flex items-center gap-2">
                Stok {isReseller ? '(PUBJ)' : ''} *
                {#if isReseller}<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted text-foreground">Auto dari Stok Harian</span>{/if}
              </Label>
              <Input id="stock" type="number" min="0" bind:value={product.stock} placeholder="0" class="mt-1" disabled={isReseller || isEditing} />
              {#if isReseller}
                <p class="text-xs text-primary mt-1">⚠️ Stok PUBJ dikelola otomatis melalui <strong>Stok Harian PUBJ</strong></p>
              {:else if isEditing}
                <p class="text-xs text-muted-foreground mt-1">Gunakan menu titik tiga → <strong>Tambah Stok</strong> untuk menambah persediaan.</p>
              {/if}
            </div>
          </div>
          <div>
            <Label for="description" class="text-sm font-medium">Deskripsi</Label>
            <textarea id="description" bind:value={product.description} class="mt-1 min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Deskripsi produk (opsional)..."></textarea>
          </div>
        </div>
      </div>

      {#if isReseller}
        <div class="bg-muted p-4 rounded-lg border border-border">
          <div class="flex items-center gap-2 mb-4">
            <IconWrapper icon={Users} className="h-5 w-5 text-primary" />
            <h4 class="font-medium text-foreground">Pengaturan PUBJ (Penitipan)</h4>
          </div>
          <div class="space-y-4">
            <div>
              <Label for="supplier" class="text-sm font-medium text-foreground">Supplier *</Label>
              <select id="supplier" bind:value={product.supplier_id} class="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value={null} disabled>Pilih supplier...</option>
                {#each suppliers as supplier (supplier.id)}<option value={supplier.id}>{supplier.name} {supplier.phone ? `(${supplier.phone})` : ''}</option>{/each}
              </select>
              <p class="text-xs text-primary mt-1">Pilih supplier/pemilik barang yang dititipkan</p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label for="tax_percentage" class="text-sm font-medium text-foreground">Persentase Fee Toko (%) *</Label>
                <Input id="tax_percentage" type="number" min="0.01" max="100" step="0.01" bind:value={product.tax_percentage} placeholder="10.00" class="mt-1 border-border focus:border-primary focus:ring-ring" />
                <p class="text-xs text-primary mt-1">Fee yang diambil toko (1-100%)</p>
              </div>
              <div>
                <Label for="tax_description" class="text-sm font-medium text-foreground">Keterangan Fee</Label>
                <Input id="tax_description" bind:value={product.tax_description} placeholder="Contoh: Fee toko 10%" class="mt-1 border-border focus:border-primary focus:ring-ring" />
              </div>
            </div>
            {#if product.price > 0 && product.tax_percentage > 0}
              <div class="bg-muted p-3 rounded text-sm">
                <div class="font-medium mb-2">Simulasi Bagi Hasil:</div>
                <div class="space-y-1 text-xs">
                  <div class="flex justify-between"><span>Harga Jual:</span><span class="font-medium">{formatCurrency(product.price)}</span></div>
                  <div class="flex justify-between text-primary"><span>Fee Toko ({product.tax_percentage}%):</span><span class="font-medium">{formatCurrency(product.price * (product.tax_percentage / 100))}</span></div>
                  <div class="flex justify-between text-primary"><span>Untuk Supplier:</span><span class="font-medium">{formatCurrency(product.price - product.price * (product.tax_percentage / 100))}</span></div>
                  <hr class="my-2 border-border" />
                  <div class="text-xs text-primary">
                    <p class="mb-1"><strong>Contoh:</strong> Jika terjual 1 unit:</p>
                    <p>• Total penjualan: {formatCurrency(product.price)}</p>
                    <p>• Toko mendapat: {formatCurrency(product.price * (product.tax_percentage / 100))} (sebagai fee)</p>
                    <p>• Supplier mendapat: {formatCurrency(product.price - product.price * (product.tax_percentage / 100))}</p>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <div class="space-y-4">
        <h4 class="font-medium text-base">Gambar Produk</h4>
        <div class="space-y-3">
          {#if imagePreview}<div class="flex justify-center"><img src={imagePreview} alt="Preview" class="w-32 h-32 sm:w-40 sm:h-40 object-cover rounded-lg border border-border" /></div>{/if}
          <div>
            <Label for="image" class="text-sm font-medium">Pilih Gambar</Label>
            <input id="image" type="file" accept="image/*" on:change={handleImageSelect} class="mt-1 w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-muted file:text-foreground hover:file:bg-accent" />
            <p class="text-xs text-muted-foreground mt-1">Format: JPG, PNG, WebP. Maksimal 25MB</p>
          </div>
        </div>
      </div>
    </div>

    <DialogFooter class="flex flex-col sm:flex-row gap-2 sm:gap-0 pt-4">
      <Button variant="outline" on:click={onClose} class="w-full sm:w-auto order-2 sm:order-1">Batal</Button>
      <Button on:click={onSave} disabled={isUploading} class="w-full sm:w-auto order-1 sm:order-2">
        {#if isUploading}<IconWrapper icon={Upload} className="mr-2 h-4 w-4 animate-spin" />Mengupload...
        {:else}<IconWrapper icon={isEditing ? Edit : PlusCircle} className="mr-2 h-4 w-4" />{isEditing ? 'Update Produk' : 'Tambah Produk'}{/if}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
