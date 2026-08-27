<script lang="ts">
  import ProductActionDialogs from './ProductActionDialogs.svelte';
  import { addProductStock, hardDeleteProduct, toggleProductActive } from '$lib/services/productService';
  import { useAlert } from '$lib/composables/useAlert';

  export let onStockUpdated: (id: number, stock: number) => void;
  export let onDeleted: (id: number) => void;
  export let onToggled: (id: number, active: boolean) => void;

  const { showAlertMessage } = useAlert();
  let showAddStock = false;
  let stockProduct: any = null;
  let stockQuantity = 1;
  let isAddingStock = false;
  let showDelete = false;
  let deleteProduct: any = null;
  let deletePassword = '';
  let isDeleting = false;
  let showToggle = false;
  let toggleProduct: any = null;
  let isToggling = false;

  export function openAddStock(product: any) {
    stockProduct = product;
    stockQuantity = 1;
    showAddStock = true;
  }

  export function openDelete(product: any) {
    deleteProduct = product;
    deletePassword = '';
    showDelete = true;
  }

  export function openToggle(product: any) {
    toggleProduct = product;
    showToggle = true;
  }

  async function handleAddStock() {
    const quantity = Number(stockQuantity);
    if (!stockProduct || !Number.isInteger(quantity) || quantity <= 0) {
      showAlertMessage('error', 'Jumlah stok tambahan harus berupa bilangan bulat lebih dari 0');
      return;
    }
    try {
      isAddingStock = true;
      const result = await addProductStock(stockProduct.id, quantity);
      onStockUpdated(stockProduct.id, result.stock);
      showAddStock = false;
      showAlertMessage('success', result.message);
      stockProduct = null;
      stockQuantity = 1;
    } catch (error) {
      showAlertMessage('error', `Error: ${error.message}`);
    } finally {
      isAddingStock = false;
    }
  }

  async function handleDelete() {
    if (!deletePassword.trim()) {
      showAlertMessage('error', 'Password wajib diisi untuk menghapus produk secara permanen');
      return;
    }
    if (!deleteProduct) return;
    try {
      isDeleting = true;
      showAlertMessage('info', 'Memverifikasi password dan menghapus produk...');
      await hardDeleteProduct(deleteProduct, deletePassword);
      onDeleted(deleteProduct.id);
      showDelete = false;
      showAlertMessage('success', `Produk "${deleteProduct.name}" berhasil dihapus secara permanen.`);
      deleteProduct = null;
      deletePassword = '';
    } catch (error) {
      showAlertMessage('error', `Error: ${error.message}`);
    } finally {
      isDeleting = false;
    }
  }

  async function handleToggle() {
    if (!toggleProduct) return;
    const wasActive = toggleProduct.is_active;
    try {
      isToggling = true;
      showAlertMessage('info', `${wasActive ? 'Menonaktifkan' : 'Mengaktifkan'} produk...`);
      await toggleProductActive(toggleProduct.id);
      onToggled(toggleProduct.id, !wasActive);
      showAlertMessage('success', `Produk berhasil ${wasActive ? 'dinonaktifkan' : 'diaktifkan'}.`);
      showToggle = false;
      toggleProduct = null;
    } catch (error) {
      showAlertMessage('error', `Error: ${error.message}`);
    } finally {
      isToggling = false;
    }
  }
</script>

<ProductActionDialogs
  {showAddStock} {stockProduct} bind:stockQuantity {isAddingStock}
  {showDelete} {deleteProduct} bind:deletePassword {isDeleting}
  {showToggle} {toggleProduct} {isToggling}
  onCloseStock={() => { showAddStock = false; stockProduct = null; }}
  onAddStock={handleAddStock}
  onCloseDelete={() => showDelete = false}
  onDelete={handleDelete}
  onCloseToggle={() => { showToggle = false; toggleProduct = null; }}
  onToggle={handleToggle}
/>
