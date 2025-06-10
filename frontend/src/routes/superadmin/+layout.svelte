<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { ChevronDown, Settings, LogOut, LayoutDashboard, Package, Users, Store, FileText, Menu, X, Sun, Moon, User, Truck, Calendar, BarChart3, Activity } from "lucide-svelte";
  import { logout } from "$lib/auth";
  import IconWrapper from "$lib/components/IconWrapper.svelte";
  import BottomNavigation from "$lib/components/BottomNavigation.svelte";
  import { theme } from '$lib/themeStore';

  let showProfileDropdown = false;
  let showMobileSidebar = false;
  let username = '';
  let isDarkMode = false;

  onMount(() => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_token") : null;
    const userRole = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_user_role") : null;
    
    if (!token || userRole !== 'superadmin') {
      goto("/login");
      return;
    }

    if (browser) {
      const storedUsername = localStorage.getItem('pos_username');
      username = storedUsername || 'Super Admin';
      
      const theme = localStorage.getItem('theme') || 'light';
      isDarkMode = theme === 'dark';
      document.documentElement.classList.toggle('dark', isDarkMode);
    }

    const handleClickOutside = (event) => {
      if (!event.target.closest('.profile-dropdown')) {
        showProfileDropdown = false;
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });

  function toggleProfileDropdown() {
    showProfileDropdown = !showProfileDropdown;
  }

  function toggleMobileSidebar() {
    showMobileSidebar = !showMobileSidebar;
  }

  function handleLogout() {
    logout();
  }

  function toggleTheme() {
    isDarkMode = !isDarkMode;
    const theme = isDarkMode ? 'dark' : 'light';
    if (browser) {
      localStorage.setItem('theme', theme);
      document.documentElement.classList.toggle('dark', isDarkMode);
    }
  }

  const navItems = [
    { href: '/superadmin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/superadmin/products', label: 'Produk', icon: Package },
    { href: '/superadmin/categories', label: 'Kategori', icon: Store },
    { href: '/superadmin/cashiers', label: 'Manage Kasir', icon: Users },
    { href: '/superadmin/suppliers', label: 'Supplier PUBJ', icon: Truck },
    { href: '/superadmin/daily-stock', label: 'Stok Harian PUBJ', icon: Calendar },
    { href: '/superadmin/revenue', label: 'Total Pendapatan', icon: BarChart3 },
    { href: '/superadmin/transactions', label: 'Log Transaksi', icon: FileText },
    { href: '/superadmin/activities', label: 'Manajemen Aktivitas', icon: Activity },
    { href: '/superadmin/settings', label: 'Pengaturan', icon: Settings }
  ];

  function isCurrentPage(href) {
    const currentPath = $page.url.pathname;
    return currentPath === href;
  }

  $: currentPath = $page.url.pathname;

  function isActivePage(href) {
    return $page.url.pathname.startsWith(href);
  }
</script>

  <div class="min-h-screen bg-muted flex">
    <div class="hidden md:flex md:flex-shrink-0">
      <div class="flex flex-col w-64 fixed h-full">
        <div class="flex-1 flex flex-col min-h-0 bg-card border-r border-border shadow-sm">
          <div class="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div class="flex items-center flex-shrink-0 px-4 mb-8">
              <div class="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 p-2 mr-3 overflow-hidden group">
                <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                {#if isDarkMode}
                  <img 
                    src="/Logo Soswir White.png" 
                    alt="Soswir Logo" 
                    class="w-full h-full object-contain relative z-10 filter drop-shadow-sm"
                  />
                {:else}
                  <img 
                    src="/Logo Soswir noBG.png" 
                    alt="Soswir Logo" 
                    class="w-full h-full object-contain relative z-10 filter drop-shadow-sm"
                  />
                {/if}
              </div>
              <div>
                <h1 class="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Soswir Admin
                </h1>
                <p class="text-xs text-muted-foreground font-medium">Management System</p>
              </div>
            </div>
            
            <nav class="mt-5 flex-1 px-2 space-y-1">
              {#each navItems as item}
                {@const isActive = currentPath === item.href}
                <a
                  href={item.href}
                  class="group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 {isActive ? 'bg-primary/10 text-primary border-r-2 border-primary' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
                >
                                      <IconWrapper icon={item.icon} className="mr-3 h-5 w-5 transition-all duration-200 {isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-accent-foreground'}" />
                  {item.label}
                </a>
              {/each}
            </nav>
          </div>
        </div>
      </div>
    </div>

    {#if showMobileSidebar}
      <div class="md:hidden fixed inset-0 flex z-50">
        <div 
          class="fixed inset-0 bg-background/80 backdrop-blur-sm" 
          on:click={toggleMobileSidebar}
          on:keydown={(e) => e.key === 'Escape' && toggleMobileSidebar()}
          role="button"
          tabindex="0"
          aria-label="Close mobile sidebar"
        ></div>
        
        <div class="relative flex-1 flex flex-col max-w-xs w-full bg-card shadow-xl">
          <div class="absolute top-0 right-0 -mr-12 pt-2">
            <button
              on:click={toggleMobileSidebar}
              class="ml-1 flex items-center justify-center h-10 w-10 rounded-full bg-background/20 backdrop-blur-sm text-foreground hover:bg-background/30 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring transition-all"
            >
              <IconWrapper icon={X} className="h-6 w-6" />
            </button>
          </div>
          
          <div class="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
            <div class="flex-shrink-0 flex items-center px-4 mb-8">
              <div class="relative w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 p-1.5 mr-3 overflow-hidden group">
                <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                {#if isDarkMode}
                  <img 
                    src="/Logo Soswir White.png" 
                    alt="Soswir Logo" 
                    class="w-full h-full object-contain relative z-10 filter drop-shadow-sm"
                  />
                {:else}
                  <img 
                    src="/Logo Soswir noBG.png" 
                    alt="Soswir Logo" 
                    class="w-full h-full object-contain relative z-10 filter drop-shadow-sm"
                  />
                {/if}
              </div>
              <div>
                <h1 class="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Soswir Admin</h1>
                <p class="text-xs text-muted-foreground">Management</p>
              </div>
            </div>
            
            <nav class="mt-5 px-2 space-y-1">
              {#each navItems as item}
                {@const isActive = currentPath === item.href}
                <a
                  href={item.href}
                  on:click={toggleMobileSidebar}
                  class="group flex items-center px-3 py-3 text-base font-medium rounded-lg transition-all duration-200 {isActive ? 'bg-primary/10 text-primary border-r-2 border-primary' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
                >
                                      <IconWrapper icon={item.icon} className="mr-4 h-6 w-6 transition-all duration-200 {isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-accent-foreground'}" />
                  {item.label}
                </a>
              {/each}
            </nav>
          </div>
        </div>
      </div>
    {/if}

    <div class="flex-1 flex flex-col min-w-0 md:ml-64">
      <div class="relative z-10 flex-shrink-0 flex h-16 bg-card shadow-sm border-b border-border">
        <button
          on:click={toggleMobileSidebar}
          class="px-4 border-r border-border text-muted-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring md:hidden transition-colors"
        >
          <IconWrapper icon={Menu} className="h-6 w-6" />
        </button>
        
        <div class="flex-1 px-4 flex justify-between items-center">
          <div class="flex-1 flex">
            <div class="hidden sm:flex items-center">
              <h2 class="text-lg font-semibold text-card-foreground">
                {navItems.find(item => currentPath === item.href)?.label || 'Dashboard'}
              </h2>
            </div>
          </div>
          
          <div class="ml-4 flex items-center space-x-2 sm:space-x-4">
            <button
              on:click={toggleTheme}
              class="p-2 rounded-lg text-muted-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              title="Toggle theme"
            >
              {#if isDarkMode}
                <IconWrapper icon={Sun} className="h-5 w-5" />
              {:else}
                <IconWrapper icon={Moon} className="h-5 w-5" />
              {/if}
            </button>

            <div class="relative profile-dropdown">
              <button
                on:click={toggleProfileDropdown}
                class="flex items-center text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring transition-all"
              >
                                  <div class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-card-foreground hover:bg-accent">
                                      <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium text-sm">
                    SA
                  </div>
                  <span class="hidden sm:block">{username}</span>
                  <IconWrapper icon={ChevronDown} className="h-4 w-4 transition-transform {showProfileDropdown ? 'rotate-180' : ''}" />
                </div>
              </button>

              {#if showProfileDropdown}
                <div class="origin-top-right absolute right-0 mt-2 w-56 rounded-lg shadow-lg py-1 bg-popover ring-1 ring-border focus:outline-none z-50 border border-border">
                                      <div class="px-4 py-3 text-sm text-muted-foreground border-b border-border">
                      <div class="font-medium text-popover-foreground">{username}</div>
                    <div class="text-xs">Super Administrator</div>
                  </div>
                  <a
                    href="/superadmin/profile"
                    class="flex items-center gap-2 px-4 py-2 text-sm text-popover-foreground hover:bg-accent transition-colors"
                    on:click={() => showProfileDropdown = false}
                  >
                    <IconWrapper icon={User} className="h-4 w-4" />
                    Profil
                  </a>
                  <a
                    href="/superadmin/settings"
                    class="flex items-center gap-2 px-4 py-2 text-sm text-popover-foreground hover:bg-accent transition-colors"
                    on:click={() => showProfileDropdown = false}
                  >
                    <IconWrapper icon={Settings} className="h-4 w-4" />
                    Pengaturan
                  </a>
                  <hr class="my-1 border-border">
                  <button
                    on:click={handleLogout}
                    class="flex items-center gap-2 w-full px-4 py-2 text-sm text-destructive hover:bg-accent text-left transition-colors"
                  >
                    <IconWrapper icon={LogOut} className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>

      <main class="flex-1 relative overflow-hidden focus:outline-none pb-16 md:pb-0">
        <slot />
      </main>
    </div>

    <BottomNavigation />
  </div>
