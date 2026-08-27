<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
  import { Search } from "lucide-svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { api, apiData } from "$lib/apiConfig";
  import { browser } from '$app/environment';
  import IconWrapper from "$lib/components/IconWrapper.svelte";
  import { formatCurrency } from "$lib/utils/format";
  import CheckoutDialog from '$lib/components/pos/CheckoutDialog.svelte';
  import CartPanel from '$lib/components/pos/CartPanel.svelte';
  import ProductCatalog from '$lib/components/pos/ProductCatalog.svelte';

  let products = [];
  let categories = [];
  let cart = [];
  let searchTerm = '';
  let selectedCategory = '';
  let isLoading = true;
  let isProcessing = false;
  let error = null;
  let showMobileCart = false;

  let showAlert = false;
  let alertType = 'success';
  let alertMessage = '';

  let showCheckoutDialog = false;
  let customerName = 'Umum';
  let paymentMethod = 'Cash';

  function showAlertMessage(type: string, message: string) {
    alertType = type;
    alertMessage = message;
    showAlert = true;
    setTimeout(() => {
      showAlert = false;
    }, 3000);
  }

  function toggleMobileCart() {
    showMobileCart = !showMobileCart;
  }

  onMount(async () => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_token") : null;
    const userRole = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_user_role") : null;
    
    if (!token || userRole !== 'cashier') {
      goto("/login");
      return;
    }
    
    await loadData();
  });

  async function loadData() {
    try {
      if (!browser) {
        isLoading = false;
        return;
      }
      
      
      const productsData = await apiData<any[]>(api.get('/api/products?active_only=true'));
      products = productsData.map(product => ({
        ...product,
        price: parseFloat(product.price) || 0,
        stock: parseInt(product.stock) || 0
      }));

      try {
        categories = await apiData<any[]>(api.get('/api/categories'));
      } catch (categoryError) {
        console.warn("Gagal memuat kategori, melanjutkan tanpa filter kategori");
        categories = [];
      }
      
      
    } catch (err) {
      console.error("Error loading data:", err);
      error = err.message;
      showAlertMessage('error', `Gagal memuat data: ${err.message}`);
    } finally {
      isLoading = false;
    }
  }

  $: filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || product.category_id == selectedCategory;
    return matchesSearch && matchesCategory;
  });

  $: cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  function addToCart(product) {
    if (product.stock <= 0) {
      showAlertMessage('error', 'Stok produk habis');
      return;
    }

    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        showAlertMessage('error', 'Stok tidak mencukupi');
        return;
      }
      updateQuantity(product.id, existingItem.quantity + 1);
    } else {
      cart = [...cart, { ...product, quantity: 1 }];
      showAlertMessage('success', `${product.name} ditambahkan ke keranjang`);
    }
    
  }

  function handleProductClick(product) {
    addToCart(product);
  }

  function updateQuantity(productId, newQuantity) {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const product = products.find(p => p.id === productId);
    if (newQuantity > product.stock) {
      showAlertMessage('error', 'Stok tidak mencukupi');
      return;
    }

    cart = cart.map(item => 
      item.id === productId 
        ? { ...item, quantity: newQuantity }
        : item
    );
  }

  function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
  }

  function clearCart() {
    cart = [];
    showAlertMessage('info', 'Keranjang dikosongkan');
  }

  function checkout() {
    if (cart.length === 0) {
      showAlertMessage('error', 'Keranjang kosong');
      return;
    }
    showCheckoutDialog = true;
  }

  async function processCheckout() {
    if (cart.length === 0) {
      showAlertMessage('error', 'Keranjang masih kosong!');
      return;
    }

    isProcessing = true;
    showAlertMessage('info', 'Memproses transaksi...');

    const saleData = {
      customer_name: customerName.trim() || 'Umum',
      payment_method: paymentMethod,
      items: cart.map(item => ({
        product_id: item.id,
        quantity: item.quantity,
        price: item.price
      })),
      total_amount: cartTotal
    };


    try {
      const result = await apiData<any>(api.post('/api/sales', saleData));

      if (result && (result.sale || result.sale_id)) {
        cart = [];
        customerName = 'Umum';
        paymentMethod = 'Cash';
        showCheckoutDialog = false;
        
        showAlertMessage('success', `Penjualan berhasil! Total: ${formatCurrency(result.total_amount || cartTotal)}`);
        
        await loadData();
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (error) {
      console.error("Error processing checkout:", error);
      showAlertMessage('error', `Error: ${error.message}`);
    } finally {
      isProcessing = false;
    }
  }

</script>

<div class="flex-1 h-full">
  <div class="flex flex-col xl:flex-row h-full">
    <div class="flex-1 p-3 sm:p-4 xl:p-6 overflow-y-auto">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 space-y-3 sm:space-y-0">
        <h2 class="text-xl sm:text-2xl xl:text-3xl font-bold">Point of Sale</h2>
        
        <div class="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
          <div class="relative flex-1 sm:flex-initial sm:w-64 xl:w-80">
            <IconWrapper icon={Search} className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              bind:value={searchTerm}
              placeholder="Cari produk..."
              class="pl-10 h-10 sm:h-11 xl:h-10 text-base xl:text-base"
            />
          </div>
          <select
            bind:value={selectedCategory}
            class="px-3 py-2 border rounded-md bg-background text-base xl:text-base h-10 sm:h-11 xl:h-10"
          >
            <option value="">Semua Kategori</option>
            {#each categories as category}
              <option value={category.id}>{category.name}</option>
            {/each}
          </select>
        </div>
      </div>

      {#if showAlert}
        <div class="fixed top-4 right-4 z-50 transition-all duration-300 {showAlert ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}" style="min-width: 280px; max-width: 400px;">
          <Alert variant={alertType === 'error' ? 'destructive' : 'default'} class="border-l-4 {alertType === 'success' ? 'border-l-primary bg-primary/10' : alertType === 'error' ? 'border-l-destructive bg-destructive/10' : 'border-l-primary bg-primary/10'}">
            <AlertTitle class="text-sm">{alertType === 'success' ? 'Berhasil!' : alertType === 'error' ? 'Error!' : 'Info'}</AlertTitle>
            <AlertDescription class="text-sm">{alertMessage}</AlertDescription>
          </Alert>
        </div>
      {/if}

      <ProductCatalog products={filteredProducts} {isLoading} onAdd={handleProductClick} />
    </div>

    <CartPanel {cart} debugProducts={products} total={cartTotal} {isProcessing} mobileOpen={showMobileCart} onToggle={toggleMobileCart} onUpdate={updateQuantity} onCheckout={checkout} onClear={clearCart} />
  </div>
</div>

<CheckoutDialog
  open={showCheckoutDialog}
  bind:customerName
  bind:paymentMethod
  {cart}
  total={cartTotal}
  {isProcessing}
  onClose={() => showCheckoutDialog = false}
  onConfirm={processCheckout}
/>


