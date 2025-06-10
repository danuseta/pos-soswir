<script lang="ts">
  import { page } from '$app/stores';
  import { LayoutDashboard, Package, Calendar, BarChart3, MoreHorizontal, Users, Store, Truck, FileText, Activity, Settings, ChevronUp } from 'lucide-svelte';
  import IconWrapper from './IconWrapper.svelte';

  let showMoreMenu = false;

  const primaryNavItems = [
    { href: '/superadmin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/superadmin/products', label: 'Produk', icon: Package },
    { href: '/superadmin/daily-stock', label: 'Stok PUBJ', icon: Calendar },
    { href: '/superadmin/revenue', label: 'Revenue', icon: BarChart3 }
  ];

  const moreNavItems = [
    { href: '/superadmin/categories', label: 'Kategori', icon: Store },
    { href: '/superadmin/cashiers', label: 'Manage Kasir', icon: Users },
    { href: '/superadmin/suppliers', label: 'Supplier PUBJ', icon: Truck },
    { href: '/superadmin/transactions', label: 'Log Transaksi', icon: FileText },
    { href: '/superadmin/activities', label: 'Manajemen Aktivitas', icon: Activity },
    { href: '/superadmin/settings', label: 'Pengaturan', icon: Settings }
  ];

  $: currentPath = $page.url.pathname;

  function isActive(href: string) {
    return currentPath === href;
  }

  function isMoreActive() {
    return moreNavItems.some(item => isActive(item.href));
  }

  function toggleMoreMenu() {
    showMoreMenu = !showMoreMenu;
  }

  function closeMoreMenu() {
    showMoreMenu = false;
  }

  function handleDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    if (!target?.closest('.more-menu-container')) {
      showMoreMenu = false;
    }
  }
</script>

<svelte:document on:click={handleDocumentClick} />

<!-- Mobile Bottom Navigation -->
<div class="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border shadow-lg">
  <!-- More Menu Overlay -->
  {#if showMoreMenu}
    <div class="absolute bottom-full left-0 right-0 bg-background border-t border-border shadow-xl max-h-64 overflow-y-auto">
      <div class="p-2">
        <div class="text-xs font-medium text-muted-foreground px-3 py-2 uppercase tracking-wide">
          Menu Lainnya
        </div>
        <div class="grid grid-cols-2 gap-1">
          {#each moreNavItems as item}
            {@const active = isActive(item.href)}
            <a
              href={item.href}
              on:click={closeMoreMenu}
              class="flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200
              {active 
                ? 'text-primary bg-primary/10' 
                : 'text-foreground hover:text-foreground hover:bg-accent'
              }"
            >
              <IconWrapper 
                icon={item.icon} 
                className="h-5 w-5 mr-3 {active ? 'text-primary' : 'text-muted-foreground'}" 
              />
              <span class="truncate">{item.label}</span>
            </a>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <!-- Bottom Navigation Bar -->
  <div class="grid grid-cols-5 h-16">
    <!-- Primary Navigation Items -->
    {#each primaryNavItems as item}
      {@const active = isActive(item.href)}
      <a
        href={item.href}
        class="flex flex-col items-center justify-center px-1 py-2 text-xs font-medium transition-all duration-200 relative
        {active 
          ? 'text-primary bg-primary/10' 
          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        }"
      >
        <!-- Active indicator -->
        {#if active}
          <div class="absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-primary rounded-b-full"></div>
        {/if}
        
        <!-- Icon -->
        <div class="flex items-center justify-center mb-1">
          <IconWrapper 
            icon={item.icon} 
            className="h-5 w-5 transition-all duration-200 {active ? 'text-primary' : 'text-muted-foreground'}" 
          />
        </div>
        
        <!-- Label -->
        <span class="truncate max-w-full leading-tight">
          {item.label}
        </span>
      </a>
    {/each}

    <!-- More Menu Button -->
    <button
      on:click={toggleMoreMenu}
      class="more-menu-container flex flex-col items-center justify-center px-1 py-2 text-xs font-medium transition-all duration-200 relative
      {isMoreActive() || showMoreMenu
        ? 'text-primary bg-primary/10' 
        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
      }"
    >
      <!-- Active indicator -->
      {#if isMoreActive() || showMoreMenu}
        <div class="absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-primary rounded-b-full"></div>
      {/if}
      
      <!-- Icon -->
      <div class="flex items-center justify-center mb-1">
        <IconWrapper 
          icon={showMoreMenu ? ChevronUp : MoreHorizontal} 
          className="h-5 w-5 transition-all duration-200 {isMoreActive() || showMoreMenu ? 'text-primary' : 'text-muted-foreground'}" 
        />
      </div>
      
      <!-- Label -->
      <span class="truncate max-w-full leading-tight">
        Lainnya
      </span>
    </button>
  </div>
</div>

<!-- Spacer for bottom navigation on mobile to prevent content overlap -->
<div class="md:hidden h-16"></div> 