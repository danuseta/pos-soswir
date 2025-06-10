<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "$lib/components/ui/dialog";
  import { Search, Package, ShoppingCart, Plus, Minus, Trash2, CreditCard, Clock, ChevronDown, ChevronUp } from "lucide-svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { BACKEND_URL, getAuthHeaders } from "$lib/apiConfig";
  import { browser } from '$app/environment';
  import IconWrapper from "$lib/components/IconWrapper.svelte";

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
      
      showAlertMessage('info', 'Memuat data produk dan kategori...');
      
      const productsResponse = await fetch(`${BACKEND_URL}/api/products?active_only=true`, {
        headers: getAuthHeaders()
      });
      
      if (productsResponse.ok) {
        const productsData = await productsResponse.json();
        products = productsData.map(product => ({
          ...product,
          price: parseFloat(product.price) || 0,
          stock: parseInt(product.stock) || 0
        }));
      } else {
        throw new Error("Gagal memuat data produk");
      }
      
      const categoriesResponse = await fetch(`${BACKEND_URL}/api/categories`, {
        headers: getAuthHeaders()
      });
      
      if (categoriesResponse.ok) {
        categories = await categoriesResponse.json();
      } else {
        console.warn("Gagal memuat kategori, melanjutkan tanpa filter kategori");
        categories = [];
      }
      
      showAlertMessage('success', `Berhasil memuat ${products.length} produk`);
      
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
    
    console.log('Cart updated:', cart);
  }

  function handleProductClick(product) {
    console.log('Product clicked:', product);
    addToCart(product);
  }

  function handleButtonClick(event, product) {
    event.stopPropagation();
    handleProductClick(product);
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

    console.log('Sending sale data:', saleData);

    try {
      const response = await fetch(`${BACKEND_URL}/api/sales`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(saleData)
      });

      if (response.ok) {
        const result = await response.json();
        
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
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Gagal memproses checkout');
      }
    } catch (error) {
      console.error("Error processing checkout:", error);
      showAlertMessage('error', `Error: ${error.message}`);
    } finally {
      isProcessing = false;
    }
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  }

  $: {
    console.log('Cart state changed:', cart);
    console.log('Cart total:', cartTotal);
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

      {#if isLoading}
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 xl:gap-4">
          {#each Array(10) as _}
            <Card class="overflow-hidden">
              <div class="animate-pulse">
                <div class="h-32 sm:h-36 md:h-38 xl:h-40 bg-muted"></div>
                <CardContent class="p-2 sm:p-3 xl:p-4">
                  <div class="h-4 bg-muted rounded mb-2"></div>
                  <div class="h-3 bg-muted rounded w-2/3"></div>
                </CardContent>
              </div>
            </Card>
          {/each}
        </div>
      {:else}
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 xl:gap-4">
          {#each filteredProducts as product}
            <Card 
              class="overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] {product.stock <= 0 ? 'opacity-50 cursor-not-allowed' : ''}" 
              on:click={() => handleProductClick(product)}
            >
              <div class="relative">
                {#if product.image_url}
                  <img src={product.image_url} alt={product.name} class="w-full h-32 sm:h-36 md:h-38 xl:h-40 object-cover" />
                {:else}
                  <div class="w-full h-32 sm:h-36 md:h-38 xl:h-40 bg-muted flex items-center justify-center">
                    <IconWrapper icon={Package} className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 xl:h-12 xl:w-12 text-muted-foreground" />
                  </div>
                {/if}
                {#if product.stock <= 0}
                  <div class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <span class="text-white font-medium text-xs sm:text-sm xl:text-sm">Stok Habis</span>
                  </div>
                {:else if product.stock <= 5}
                  <div class="absolute top-2 right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded">
                    Stok: {product.stock}
                  </div>
                {/if}
              </div>
              <CardContent class="p-2 sm:p-3 xl:p-4">
                <h3 class="font-medium text-sm sm:text-sm md:text-base xl:text-base line-clamp-2 mb-1 sm:mb-2 xl:mb-2">{product.name}</h3>
                <p class="text-primary font-bold text-sm sm:text-base md:text-lg xl:text-lg">{formatCurrency(product.price)}</p>
                <p class="text-xs sm:text-xs md:text-sm xl:text-sm text-muted-foreground mb-2">Stok: {product.stock}</p>
                <button
                  class="w-full mt-2 text-xs sm:text-sm md:text-sm xl:text-sm px-3 py-2 sm:py-3 md:py-3 xl:py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed transition-colors font-medium"
                  disabled={product.stock <= 0}
                  on:click={(e) => handleButtonClick(e, product)}
                >
                  {product.stock <= 0 ? 'Stok Habis' : 'Tambah ke Keranjang'}
                </button>
              </CardContent>
            </Card>
          {/each}
        </div>

        {#if filteredProducts.length === 0}
          <div class="text-center py-12">
            <IconWrapper icon={Package} className="h-16 w-16 xl:h-16 xl:w-16 mx-auto mb-4 text-muted-foreground" />
            <p class="text-muted-foreground text-lg xl:text-lg">Tidak ada produk ditemukan</p>
          </div>
        {/if}
      {/if}
    </div>

    <div class="xl:w-80 2xl:w-96 xl:border-l border-border bg-card flex flex-col">
      <div class="xl:hidden border-t border-border p-3 sm:p-4">
        <Button
          on:click={toggleMobileCart}
          class="w-full flex items-center justify-between h-11 sm:h-12 xl:h-10 text-base xl:text-base"
          variant="outline"
        >
          <span class="font-medium">Keranjang ({cart.length})</span>
          <div class="flex items-center gap-3">
            <span class="font-bold text-primary">{formatCurrency(cartTotal)}</span>
            <IconWrapper icon={showMobileCart ? ChevronDown : ChevronUp} className="h-4 w-4 sm:h-5 sm:w-5 xl:h-4 xl:w-4" />
          </div>
        </Button>
      </div>

      <div class="flex-1 flex flex-col {showMobileCart ? 'block' : 'hidden xl:flex'}">
        <div class="p-3 sm:p-4 xl:p-6 border-b border-border">
          <h3 class="text-lg xl:text-lg font-semibold">Keranjang Belanja</h3>
          <p class="text-xs xl:text-xs text-muted-foreground mt-1">Total Items: {cart.length}</p>
          <p class="text-xs xl:text-xs text-muted-foreground mt-1">Total Amount: {formatCurrency(cartTotal)}</p>
        </div>

        <div class="flex-1 overflow-y-auto p-3 sm:p-4 xl:p-6">
          {#if cart.length === 0}
            <div class="text-center text-muted-foreground mt-8">
              <IconWrapper icon={ShoppingCart} className="h-12 w-12 xl:h-12 xl:w-12 mx-auto mb-4 opacity-50" />
              <p class="text-base xl:text-base">Keranjang kosong</p>
              <Button 
                on:click={() => console.log('Debug - Products:', products, 'Cart:', cart)} 
                variant="outline" 
                size="sm" 
                class="mt-2 text-sm xl:text-sm h-8 xl:h-8"
              >
                Debug Info
              </Button>
            </div>
          {:else}
            <div class="space-y-3 sm:space-y-4 xl:space-y-4">
              {#each cart as item}
                <div class="flex items-center gap-3 sm:gap-4 xl:gap-3 p-3 sm:p-4 xl:p-3 border rounded-lg">
                  <div class="flex-1 min-w-0">
                    <h4 class="font-medium text-sm xl:text-sm truncate">{item.name}</h4>
                    <p class="text-sm xl:text-sm text-muted-foreground">{formatCurrency(item.price)}</p>
                  </div>
                  <div class="flex items-center gap-2 sm:gap-3 xl:gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      on:click={() => updateQuantity(item.id, item.quantity - 1)}
                      class="h-8 w-8 sm:h-9 sm:w-9 xl:h-8 xl:w-8 p-0"
                    >
                      <IconWrapper icon={Minus} className="h-3 w-3 sm:h-4 sm:w-4 xl:h-3 xl:w-3" />
                    </Button>
                    <span class="w-8 text-center text-sm xl:text-sm font-medium">{item.quantity}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      on:click={() => updateQuantity(item.id, item.quantity + 1)}
                      class="h-8 w-8 sm:h-9 sm:w-9 xl:h-8 xl:w-8 p-0"
                    >
                      <IconWrapper icon={Plus} className="h-3 w-3 sm:h-4 sm:w-4 xl:h-3 xl:w-3" />
                    </Button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        {#if cart.length > 0}
          <div class="border-t border-border p-3 sm:p-4 xl:p-6 space-y-3 sm:space-y-4 xl:space-y-4">
            <div class="flex justify-between items-center">
              <span class="text-lg xl:text-lg font-semibold">Total:</span>
              <span class="text-xl xl:text-xl font-bold text-primary">{formatCurrency(cartTotal)}</span>
            </div>
            
            <div class="space-y-2 sm:space-y-3 xl:space-y-2">
              <Button
                on:click={checkout}
                disabled={isProcessing || cart.length === 0}
                class="w-full h-11 sm:h-12 xl:h-10 text-base xl:text-base font-medium"
              >
                {#if isProcessing}
                  <IconWrapper icon={Clock} className="mr-2 h-4 w-4 xl:h-4 xl:w-4 animate-spin" />
                  Memproses...
                {:else}
                  <IconWrapper icon={CreditCard} className="mr-2 h-4 w-4 xl:h-4 xl:w-4" />
                  Checkout
                {/if}
              </Button>
              
              <Button
                on:click={clearCart}
                variant="outline"
                class="w-full h-9 sm:h-10 xl:h-8 text-sm xl:text-sm"
              >
                <IconWrapper icon={Trash2} className="mr-2 h-3 w-3 xl:h-3 xl:w-3" />
                Kosongkan Keranjang
              </Button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<Dialog bind:open={showCheckoutDialog}>
  <DialogContent class="sm:max-w-lg xl:max-w-md w-[95vw] sm:w-full">
    <DialogHeader>
      <DialogTitle class="text-lg xl:text-lg">Checkout</DialogTitle>
      <DialogDescription class="text-sm xl:text-sm">
        Konfirmasi detail transaksi
      </DialogDescription>
    </DialogHeader>
    
    <div class="space-y-4 xl:space-y-4">
      <div>
        <label for="customer_name" class="text-sm xl:text-sm font-medium block mb-2 xl:mb-2">Nama Pelanggan</label>
        <Input 
          id="customer_name"
          bind:value={customerName} 
          placeholder="Masukkan nama pelanggan (opsional)"
          class="w-full h-10 sm:h-11 xl:h-10 text-base xl:text-base"
        />
        <p class="text-xs xl:text-xs text-gray-500 mt-1 xl:mt-1">Kosongkan untuk pelanggan umum</p>
      </div>
      
      <div>
        <label for="payment_method" class="text-sm xl:text-sm font-medium block mb-2 xl:mb-2">Metode Pembayaran</label>
        <select 
          id="payment_method"
          bind:value={paymentMethod} 
          class="w-full px-3 py-2 sm:px-4 sm:py-3 xl:px-3 xl:py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 text-base xl:text-base"
        >
          <option value="Cash">Cash / Tunai</option>
          <option value="Card">Kartu Debit/Kredit</option>
          <option value="Transfer">Transfer Bank</option>
          <option value="E-Wallet">E-Wallet (GoPay, OVO, etc.)</option>
          <option value="QRIS">QRIS</option>
        </select>
      </div>
      
      <div class="bg-gray-50 dark:bg-gray-900 p-4 xl:p-4 rounded-lg">
        <h4 class="font-medium text-base xl:text-base mb-2 xl:mb-2">Ringkasan Pesanan:</h4>
        <div class="space-y-1 xl:space-y-1 text-sm xl:text-sm">
          {#each cart as item}
            <div class="flex justify-between">
              <span>{item.name} x{item.quantity}</span>
              <span class="font-medium">{formatCurrency(item.price * item.quantity)}</span>
            </div>
          {/each}
        </div>
        <hr class="my-2 xl:my-2">
        <div class="flex justify-between items-center text-lg xl:text-lg font-semibold">
          <span>Total:</span>
          <span class="text-green-600">{formatCurrency(cartTotal)}</span>
        </div>
      </div>
    </div>
    
    <DialogFooter class="mt-4 xl:mt-4">
      <div class="flex flex-col sm:flex-row gap-2 sm:gap-3 xl:gap-2 w-full sm:w-auto">
        <Button 
          variant="outline" 
          on:click={() => showCheckoutDialog = false}
          class="w-full sm:w-auto h-10 sm:h-11 xl:h-10 text-base xl:text-base"
        >
          Batal
        </Button>
        <Button 
          on:click={processCheckout} 
          disabled={isProcessing}
          class="w-full sm:w-auto h-10 sm:h-11 xl:h-10 text-base xl:text-base"
        >
          {#if isProcessing}
            <IconWrapper icon={Clock} className="mr-2 h-4 w-4 xl:h-4 xl:w-4 animate-spin" />
            Memproses...
          {:else}
            <IconWrapper icon={CreditCard} className="mr-2 h-4 w-4 xl:h-4 xl:w-4" />
            Konfirmasi Pembayaran
          {/if}
        </Button>
      </div>
    </DialogFooter>
  </DialogContent>
</Dialog>

<style>
  @media (min-width: 640px) and (max-width: 1279px) {
    .touch-target {
      min-height: 44px;
      min-width: 44px;
    }
    
    .tablet-text {
      font-size: 1.125rem;
      line-height: 1.75;
    }
    
    .tablet-spacing {
      padding: 1.25rem;
      margin: 0.75rem;
    }
  }

  @media (min-width: 1280px) {
    .desktop-compact {
      font-size: 0.875rem;
      padding: 0.5rem;
    }
  }

  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>

