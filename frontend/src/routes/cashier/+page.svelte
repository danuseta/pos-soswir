<script lang="ts">
  import { onMount } from 'svelte';
import { BACKEND_URL, getAuthHeaders } from '$lib/apiConfig';
  import { showAlertMessage } from '$lib/alert';
  import { formatCurrency } from '$lib/format';
  import { Image, Plus, Minus } from 'lucide-svelte';
  import IconWrapper from '$lib/components/IconWrapper.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';

  let products = [];
  let dailyStocks = [];
  let categories = [];
  let cart = [];
  let isLoading = true;
  let cartTotal = 0;
  let isProcessing = false;
  let customerName = "";
  let paymentMethod = "cash";

  onMount(async () => {
    try {
      await Promise.all([
        loadProducts(),
        loadCategories(),
        loadDailyStocks()
      ]);
      isLoading = false;
    } catch (err) {
      console.error("Error loading data:", err);
      isLoading = false;
    }
  });

  async function loadProducts() {
  }

  async function loadCategories() {
  }

  async function loadDailyStocks() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`${BACKEND_URL}/api/daily-stock?date=${today}&status=active`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        dailyStocks = await response.json();
      } else {
        console.warn("Failed to load daily stocks");
        dailyStocks = [];
      }
    } catch (err) {
      console.warn("Error loading daily stocks:", err);
      dailyStocks = [];
    }
  }

  function getAvailableStock(product) {
    if (product.category_is_reseller) {
      const dailyStock = dailyStocks.find(ds => ds.product_id === product.id);
      return dailyStock ? (dailyStock.quantity_in - dailyStock.quantity_sold) : 0;
    }
    return product.stock;
  }

  function getProductPrice(product) {
    if (product.category_is_reseller) {
      const dailyStock = dailyStocks.find(ds => ds.product_id === product.id);
      return dailyStock ? parseFloat(dailyStock.price_per_unit) : product.price;
    }
    return product.price;
  }

  function addToCart(product) {
    const availableStock = getAvailableStock(product);
    const productPrice = getProductPrice(product);
    
    if (availableStock <= 0) {
      if (product.category_is_reseller) {
        showAlertMessage('error', `Produk PUBJ ${product.name} belum ada stok hari ini`);
      } else {
        showAlertMessage('error', `Produk ${product.name} sedang habis`);
      }
      return;
    }

    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      if (existingItem.quantity >= availableStock) {
        showAlertMessage('error', `Stok ${product.name} tidak mencukupi`);
        return;
      }
      existingItem.quantity += 1;
      existingItem.total = existingItem.quantity * productPrice;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: productPrice,
        quantity: 1,
        total: productPrice,
        stock: availableStock,
        is_pubj: product.category_is_reseller
      });
    }
    
    cart = cart;
    updateCartTotal();
  }

  function updateQuantity(productId, newQuantity) {
    const cartItem = cart.find(item => item.id === productId);
    const product = products.find(p => p.id === productId);
    
    if (!cartItem || !product) return;
    
    const availableStock = getAvailableStock(product);
    
    if (newQuantity > availableStock) {
      showAlertMessage('error', `Stok tidak mencukupi. Tersedia: ${availableStock}`);
      return;
    }
    
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    cartItem.quantity = newQuantity;
    cartItem.total = cartItem.quantity * cartItem.price;
    cart = cart;
    updateCartTotal();
  }

  function updateCartTotal() {
    cartTotal = cart.reduce((total, item) => total + item.total, 0);
  }

  function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartTotal();
  }

  async function processPayment() {
    if (cart.length === 0) {
      showAlertMessage('error', 'Keranjang masih kosong');
      return;
    }

    if (cartTotal <= 0) {
      showAlertMessage('error', 'Total pembayaran harus lebih dari 0');
      return;
    }

    isProcessing = true;

    try {
      for (const item of cart) {
        if (item.is_pubj) {
          const availableStock = getAvailableStock(products.find(p => p.id === item.id));
          if (availableStock < item.quantity) {
            throw new Error(`Stok ${item.name} tidak mencukupi. Tersedia: ${availableStock}`);
          }
        }
      }

      const saleData = {
        items: cart.map(item => ({
          product_id: item.id,
          quantity: item.quantity,
          price: item.price
        })),
        customer_name: customerName || "Umum",
        payment_method: paymentMethod
      };

      const response = await fetch(`${BACKEND_URL}/api/sales`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(saleData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Gagal memproses pembayaran');
      }

      const result = await response.json();
      
      await Promise.all([
        loadProducts(),
        loadDailyStocks()
      ]);
      
      cart = [];
      customerName = "";
      updateCartTotal();
      
      showAlertMessage('success', `Pembayaran berhasil! Total: ${formatCurrency(result.total_amount)}`);
      
    } catch (err) {
      console.error("Error processing payment:", err);
      showAlertMessage('error', `Error: ${err.message}`);
    } finally {
      isProcessing = false;
    }
  }
</script>

{#if isLoading}
  <div>Loading...</div>
{:else}
  <div>
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {#each products as product (product.id)}
        {@const availableStock = getAvailableStock(product)}
        {@const productPrice = getProductPrice(product)}
        <div class="bg-card rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer border {availableStock <= 0 ? 'opacity-50' : ''}" 
             role="button"
             tabindex="0"
             on:click={() => addToCart(product)}
             on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addToCart(product); } }}>
          <div class="aspect-square relative overflow-hidden rounded-t-lg">
            {#if product.image_url}
              <img 
                src={product.image_url} 
                alt={product.name}
                class="w-full h-full object-cover"
              />
            {:else}
              <div class="w-full h-full bg-muted flex items-center justify-center">
                <IconWrapper icon={Image} className="h-8 w-8 text-muted-foreground" />
              </div>
            {/if}
            
            <div class="absolute top-2 right-2">
              <Badge variant={availableStock <= 0 ? 'destructive' : availableStock <= 5 ? 'secondary' : 'default'} 
                     class="text-xs">
                {availableStock}
              </Badge>
            </div>
            
            {#if product.category_is_reseller}
              <div class="absolute top-2 left-2">
                <Badge variant="outline" class="text-xs bg-orange-100 text-orange-800 border-orange-300">
                  PUBJ
                </Badge>
              </div>
            {/if}
          </div>
          
          <div class="p-3">
            <h3 class="font-medium text-sm mb-1 line-clamp-2">{product.name}</h3>
            <p class="text-lg font-bold text-primary">{formatCurrency(productPrice)}</p>
            
            {#if product.category_is_reseller}
              {@const dailyStock = dailyStocks.find(ds => ds.product_id === product.id)}
              {#if dailyStock}
                <p class="text-xs text-muted-foreground mt-1">
                  Masuk: {dailyStock.quantity_in} | Terjual: {dailyStock.quantity_sold}
                </p>
              {:else}
                <p class="text-xs text-destructive mt-1">Belum input stok hari ini</p>
              {/if}
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <div>
      {#each cart as item (item.id)}
        <div class="flex items-center justify-between py-2 border-b">
          <div class="flex-1">
            <h4 class="font-medium text-sm">{item.name}</h4>
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatCurrency(item.price)}</span>
              {#if item.is_pubj}
                <Badge variant="outline" class="text-xs">PUBJ</Badge>
              {/if}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              class="h-6 w-6 p-0"
              on:click={() => updateQuantity(item.id, item.quantity - 1)}
            >
              <IconWrapper icon={Minus} className="h-3 w-3" />
            </Button>
            <span class="w-8 text-center text-sm font-medium">{item.quantity}</span>
            <Button 
              variant="outline" 
              size="sm" 
              class="h-6 w-6 p-0"
              on:click={() => updateQuantity(item.id, item.quantity + 1)}
            >
              <IconWrapper icon={Plus} className="h-3 w-3" />
            </Button>
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}