<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "$lib/components/ui/dialog";
  import { Label } from "$lib/components/ui/label";
  import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
  import { Search, PlusCircle, Edit, Trash2, Users, Eye, EyeOff, Filter, SortAsc, SortDesc, Clock, Activity, Circle, User, ArrowUpDown } from "lucide-svelte";
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { BACKEND_URL, getAuthHeaders } from "$lib/apiConfig";
  import { browser } from '$app/environment';
  import IconWrapper from "$lib/components/IconWrapper.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import AlertMessage from "$lib/components/AlertMessage.svelte";
  import { useAlert } from "$lib/composables/useAlert";

  let searchTerm = "";
  let cashiers = [];
  let isLoading = true;
  let error = null;

  let statusInterval;

  let currentPage = 1;
  let itemsPerPage = 10;
  let sortField = 'username';
  let sortDirection = 'asc';

  const { showAlertMessage } = useAlert();

  let showAddEditDialog = false;
  let editingCashier = null;
  let currentCashier = {
    id: null,
    username: "",
    password: "",
    confirmPassword: ""
  };
  let showPassword = false;
  let showConfirmPassword = false;

  let showActivityModal = false;
  let selectedCashierActivities = [];
  let selectedCashierName = '';
  let loadingActivities = false;



  onMount(async () => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_token") : null;
    const userRole = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_user_role") : null;
    
    if (!token || userRole !== 'superadmin') {
      goto("/login");
      return;
    }
    
    try {
      if (!browser) {
        isLoading = false;
        return;
      }
      
      showAlertMessage('info', 'Memuat data kasir...');
      
      const response = await fetch(`${BACKEND_URL}/api/users/cashiers`, {
        headers: getAuthHeaders()
      });
      
            if (response.ok) {
        cashiers = await response.json();
        
        const luckyUser = cashiers.find(c => c.username === 'lucky');
        if (luckyUser) {
          console.log('🔍 DEBUG - Lucky user created_at:', luckyUser.created_at);
          console.log('🔍 DEBUG - Lucky user created_at type:', typeof luckyUser.created_at);
        }
        
        showAlertMessage('success', `Berhasil memuat ${cashiers.length} kasir`);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal memuat data kasir");
      }
    } catch (err) {
      console.error("Error loading cashiers:", err);
      error = err.message;
      showAlertMessage('error', `Gagal memuat data: ${err.message}`);
    } finally {
      isLoading = false;
    }

    statusInterval = setInterval(async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/users/cashiers`, {
          headers: getAuthHeaders()
        });
        if (response.ok) {
          cashiers = await response.json();
        }
      } catch (err) {
        console.error("Error refreshing cashier status:", err);
      }
    }, 30000);
  });

  onDestroy(() => {
    if (statusInterval) {
      clearInterval(statusInterval);
    }
  });

  function openAddDialog() {
    editingCashier = null;
    currentCashier = { id: null, username: "", password: "", confirmPassword: "" };
    showAddEditDialog = true;
  }

  function openEditDialog(cashier) {
    editingCashier = cashier;
    currentCashier = { ...cashier, password: "", confirmPassword: "" };
    showAddEditDialog = true;
  }

  async function openActivityModal(cashier) {
    selectedCashierName = cashier.username;
    showActivityModal = true;
    loadingActivities = true;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/users/cashiers/${cashier.id}/activities`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        selectedCashierActivities = await response.json();
      } else {
        showAlertMessage('error', 'Gagal memuat aktivitas kasir');
        selectedCashierActivities = [];
      }
    } catch (err) {
      console.error("Error loading activities:", err);
      showAlertMessage('error', 'Gagal memuat aktivitas kasir');
      selectedCashierActivities = [];
    } finally {
      loadingActivities = false;
    }
  }

  async function handleSaveCashier() {
    try {
      if (!currentCashier.username) {
        showAlertMessage('error', "Username tidak boleh kosong");
        return;
      }
      
      if (currentCashier.username.length < 3) {
        showAlertMessage('error', "Username minimal 3 karakter");
        return;
      }

      if (!editingCashier && !currentCashier.password) {
        showAlertMessage('error', "Password tidak boleh kosong untuk kasir baru");
        return;
      }

      if (currentCashier.password && currentCashier.password.length < 6) {
        showAlertMessage('error', "Password minimal 6 karakter");
        return;
      }

      if (currentCashier.password !== currentCashier.confirmPassword) {
        showAlertMessage('error', "Konfirmasi password tidak cocok");
        return;
      }

      showAlertMessage('info', editingCashier ? "Memperbarui kasir..." : "Menambah kasir baru...");

      const cashierData: any = {
        username: currentCashier.username
      };

      if (currentCashier.password) {
        cashierData.password = currentCashier.password;
      }
      
      let response;
      
      if (editingCashier) {
        response = await fetch(`${BACKEND_URL}/api/users/cashiers/${editingCashier.id}`, {
          method: 'PUT',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(cashierData)
        });
      } else {
        response = await fetch(`${BACKEND_URL}/api/users/cashiers`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(cashierData)
        });
      }
      
      if (response.ok) {
        const refreshResponse = await fetch(`${BACKEND_URL}/api/users/cashiers`, {
          headers: getAuthHeaders()
        });
        
        if (refreshResponse.ok) {
          cashiers = await refreshResponse.json();
        }
        
        showAddEditDialog = false;
        showAlertMessage('success', editingCashier ? "Kasir berhasil diperbarui." : "Kasir baru berhasil ditambahkan.");
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal menyimpan kasir.");
      }
    } catch (err) {
      console.error("Error saving cashier:", err);
      showAlertMessage('error', `Error: ${err.message}`);
    }
  }

  async function handleDeleteCashier(cashierId) {
    if (!confirm("Apakah Anda yakin ingin menghapus kasir ini?")) {
      return;
    }

    try {
      showAlertMessage('info', "Menghapus kasir...");
      
      const response = await fetch(`${BACKEND_URL}/api/users/cashiers/${cashierId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        cashiers = cashiers.filter(c => c.id !== cashierId);
        showAlertMessage('success', "Kasir berhasil dihapus.");
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal menghapus kasir.");
      }
    } catch (err) {
      console.error("Error deleting cashier:", err);
      showAlertMessage('error', `Error: ${err.message}`);
    }
  }

  function formatDate(dateString) {
    if (!dateString) return '';
    
    let date = new Date(dateString);
    
    if (!dateString.includes('Z') && !dateString.includes('+') && !dateString.includes('-')) {
      date = new Date(dateString + 'Z');
    }
    
    const options: Intl.DateTimeFormatOptions = { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta'
    };
    
    return date.toLocaleString('id-ID', options);
  }

  function formatTime(dateString) {
    if (!dateString) return '';
    
    let date = new Date(dateString);
    
    if (!dateString.includes('Z') && !dateString.includes('+') && !dateString.includes('-')) {
      date = new Date(dateString + 'Z');
    }
    
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta'
    };
    return date.toLocaleTimeString('id-ID', options);
  }

  function formatDateOnly(dateString) {
    if (!dateString) return '';
    
    let date = new Date(dateString);
    
    if (!dateString.includes('Z') && !dateString.includes('+') && !dateString.includes('-')) {
      date = new Date(dateString + 'Z');
    }
    
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Jakarta'
    };
    return date.toLocaleDateString('id-ID', options);
  }

  function formatLastLogin(dateString) {
    if (!dateString) return 'Belum pernah login';
    
    let lastLogin = new Date(dateString);
    
    if (!dateString.includes('Z') && !dateString.includes('+') && !dateString.includes('-')) {
      lastLogin = new Date(dateString + 'Z');
    }
    
    const now = new Date();
    
    const diffMs = now.getTime() - lastLogin.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit yang lalu`;
    if (diffHours < 24) return `${diffHours} jam yang lalu`;
    if (diffDays < 7) return `${diffDays} hari yang lalu`;
    
    return lastLogin.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      timeZone: 'Asia/Jakarta'
    });
  }

  function getInitials(username) {
    if (!username) return 'U';
    const words = username.trim().split(' ');
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    return words.slice(0, 2).map(word => word[0]).join('').toUpperCase();
  }

  function getAvatarColor(username) {
    const colors = [
              'bg-primary',
        'bg-success',
        'bg-purple-500',
        'bg-destructive',
      'bg-yellow-500',
      'bg-indigo-500',
      'bg-pink-500',
      'bg-teal-500'
    ];
    const index = username ? username.charCodeAt(0) % colors.length : 0;
    return colors[index];
  }

  $: filteredCashiers = cashiers
    .filter(c => 
      c.username.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aValue = a[sortField] || '';
      let bValue = b[sortField] || '';
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  
  function isOnline(cashier) {
    if (!cashier.last_login) return false;
    
    const now = new Date();
    const activityTimestamp = cashier.last_activity || cashier.last_login;
    let lastActivity = new Date(activityTimestamp);
    
    if (!activityTimestamp.includes('Z') && !activityTimestamp.includes('+') && !activityTimestamp.includes('-')) {
      lastActivity = new Date(activityTimestamp + 'Z');
    }
    
    const diffMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);
    
    return diffMinutes < 5;
  }

  $: paginatedCashiers = (() => {
    if (itemsPerPage >= filteredCashiers.length) {
      return filteredCashiers;
    }
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredCashiers.slice(start, end);
  })();

  function handlePageChange(page: number) {
    currentPage = page;
  }

  function handleItemsPerPageChange(items: number) {
    itemsPerPage = items;
    currentPage = 1;
  }

  function toggleSort(field: string) {
    if (sortField === field) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDirection = 'asc';
    }
  }

  function clearFilters() {
    searchTerm = '';
    sortField = 'username';
    sortDirection = 'asc';
    currentPage = 1;
  }
</script>

<div class="flex-1 space-y-4 p-4 md:p-8 pt-6 max-w-full overflow-hidden">
  <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
    <h2 class="text-2xl md:text-3xl font-bold tracking-tight">Manajemen Kasir</h2>
    <Button 
      on:click={openAddDialog} 
      class="w-full sm:w-auto"
    >
      <IconWrapper icon={PlusCircle} className="mr-2 h-4 w-4" />
      Tambah Kasir
    </Button>
  </div>

  <AlertMessage />

  <div class="bg-card rounded-lg shadow p-4 max-w-full">
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
      <div class="flex items-center gap-2 min-w-0">
        <IconWrapper icon={Search} className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <Input 
          type="text" 
          placeholder="Cari kasir..." 
          bind:value={searchTerm}
          class="min-w-0"
        />
      </div>
      
      <div class="flex gap-2 min-w-0">
        <Button 
          variant="outline" 
          on:click={clearFilters} 
          size="sm" 
          class="flex-shrink-0"
        >
          <IconWrapper icon={Filter} className="mr-2 h-4 w-4" />
          Reset Filter
        </Button>
      </div>
    </div>
    
    
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm text-muted-foreground">
      <span class="flex-shrink-0">Menampilkan {filteredCashiers.length} dari {cashiers.length} kasir</span>
      <div class="flex items-center gap-2 flex-shrink-0">
        <span class="hidden sm:inline">Urutkan:</span>
        <select 
          bind:value={sortField}
          class="px-2 py-1 border rounded text-sm bg-background min-w-0"
        >
          <option value="username">Username</option>
          <option value="created_at">Tanggal Dibuat</option>
          <option value="last_login">Login Terakhir</option>
        </select>
        <Button 
          variant="outline" 
          size="sm"
          on:click={() => toggleSort(sortField)}
          class="flex-shrink-0"
        >
          <IconWrapper 
            icon={sortDirection === 'asc' ? SortAsc : SortDesc} 
            className="h-4 w-4" 
          />
        </Button>
      </div>
    </div>
  </div>

  {#if isLoading}
    <div class="bg-card p-8 rounded-lg shadow flex justify-center">
      <div class="text-center">
        <div class="inline-block animate-spin h-8 w-8 border-4 border-t-primary border-r-transparent border-b-primary border-l-transparent rounded-full mb-4"></div>
        <p>Memuat data kasir...</p>
      </div>
    </div>
  {:else if error}
    <div class="bg-card p-8 rounded-lg shadow">
      <div class="text-center text-destructive">
        <p class="mb-2 font-semibold">Error:</p>
        <p>{error}</p>
        <Button class="mt-4" on:click={() => { if (typeof window !== 'undefined') window.location.reload(); }}>Muat Ulang</Button>
      </div>
    </div>
  {:else}
    <div class="bg-card rounded-lg shadow border border-border overflow-hidden">
      <ScrollArea class="h-[calc(100vh-400px)]" orientation="both">
        <div class="min-w-[800px] p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-[60px] text-center">No.</TableHead>
                <TableHead class="cursor-pointer w-[200px] text-center" on:click={() => toggleSort('username')}>
                  <div class="flex items-center justify-center">
                    Username
                    <IconWrapper 
                      icon={sortField === 'username' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                    />
                  </div>
                </TableHead>
                <TableHead class="text-center w-[120px]">Status</TableHead>
                <TableHead class="text-center w-[150px]">Login Terakhir</TableHead>
                <TableHead class="text-center cursor-pointer w-[120px]" on:click={() => toggleSort('created_at')}>
                  <div class="flex items-center justify-center">
                    Dibuat
                    <IconWrapper 
                      icon={sortField === 'created_at' ? (sortDirection === 'asc' ? SortAsc : SortDesc) : ArrowUpDown} 
                      className="ml-2 h-4 w-4" 
                    />
                  </div>
                </TableHead>
                <TableHead class="text-center w-[120px]">Aktivitas</TableHead>
                <TableHead class="text-center w-[120px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {#each paginatedCashiers as cashier, index (cashier.id)}
                <TableRow>
                  <TableCell class="font-medium text-center">{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
                  <TableCell class="w-[200px] text-center">
                    <div class="flex items-center gap-3 justify-center">
                                          <div class="w-10 h-10 bg-success/10 rounded-full flex items-center justify-center">
                      <IconWrapper icon={User} className="h-5 w-5 text-success" />
                    </div>
                      <div class="min-w-0 flex-1 text-left">
                        <p class="font-medium truncate">{cashier.username}</p>
                        <p class="text-sm text-muted-foreground">Kasir</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell class="text-center">
                    <div class="flex items-center justify-center">
                      {#if isOnline(cashier)}
                        <div class="flex items-center gap-2">
                                                  <div class="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                        <span class="text-success text-sm font-medium">Online</span>
                        </div>
                      {:else}
                        <div class="flex items-center gap-2">
                                                  <div class="w-2 h-2 bg-muted-foreground rounded-full"></div>
                        <span class="text-muted-foreground text-sm">Offline</span>
                        </div>
                      {/if}
                    </div>
                  </TableCell>
                  <TableCell class="text-center">
                    {#if cashier.last_login}
                      <div class="text-sm">
                        <div class="font-medium">{formatDate(cashier.last_login)}</div>
                      </div>
                    {:else}
                      <span class="text-muted-foreground text-sm">Belum pernah login</span>
                    {/if}
                  </TableCell>
                  <TableCell class="text-center">
                    <div class="text-sm">
                      <div class="font-medium">{formatDateOnly(cashier.created_at)}</div>
                      <div class="text-muted-foreground text-xs">{formatTime(cashier.created_at)}</div>
                    </div>
                  </TableCell>
                  <TableCell class="text-center">
                    <div class="flex items-center justify-center gap-1">
                      <IconWrapper icon={Activity} className="h-4 w-4 text-primary" />
                      <span class="font-medium text-sm">{cashier.total_activities || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell class="text-center">
                    <div class="flex justify-center space-x-1">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        on:click={() => openActivityModal(cashier)} 
                        title="Lihat Aktivitas"
                        class=""
                      >
                        <IconWrapper icon={Eye} className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" on:click={() => openEditDialog(cashier)} title="Edit">
                        <IconWrapper icon={Edit} className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="sm" on:click={() => handleDeleteCashier(cashier.id)} title="Hapus">
                        <IconWrapper icon={Trash2} className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              {/each}
              {#if paginatedCashiers.length === 0}
                <TableRow>
                  <TableCell colspan={7} class="h-24 text-center">
                    {filteredCashiers.length === 0 && cashiers.length > 0 ? 'Tidak ada kasir yang sesuai dengan filter.' : 'Belum ada kasir yang tersedia.'}
                  </TableCell>
                </TableRow>
              {/if}
            </TableBody>
          </Table>
        </div>
      </ScrollArea>
      
      <Pagination 
        {currentPage}
        totalItems={filteredCashiers.length}
        {itemsPerPage}
        onPageChange={handlePageChange}
        onItemsPerPageChange={handleItemsPerPageChange}
      />
    </div>
  {/if}
</div>

{#if showAddEditDialog}
  <Dialog open={showAddEditDialog} onOpenChange={(open) => { if (!open) showAddEditDialog = false; }}>
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>{editingCashier ? "Edit Kasir" : "Tambah Kasir Baru"}</DialogTitle>
        <DialogDescription>
          {editingCashier ? "Ubah detail kasir di bawah ini." : "Isi detail untuk kasir baru."}
        </DialogDescription>
      </DialogHeader>
      <div class="grid gap-4 py-4">
        <div class="grid grid-cols-4 items-center gap-4">
          <Label for="username" class="text-right">Username</Label>
          <Input id="username" bind:value={currentCashier.username} class="col-span-3" />
        </div>
        <div class="grid grid-cols-4 items-center gap-4">
          <Label for="password" class="text-right">Password</Label>
          <div class="col-span-3 relative">
            <Input 
              id="password" 
              type={showPassword ? "text" : "password"}
              bind:value={currentCashier.password} 
              placeholder={editingCashier ? "Kosongkan jika tidak ingin mengubah" : "Password kasir"}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              on:click={() => showPassword = !showPassword}
            >
              <IconWrapper icon={showPassword ? EyeOff : Eye} className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div class="grid grid-cols-4 items-center gap-4">
          <Label for="confirmPassword" class="text-right">Konfirmasi</Label>
          <div class="col-span-3 relative">
            <Input 
              id="confirmPassword" 
              type={showConfirmPassword ? "text" : "password"}
              bind:value={currentCashier.confirmPassword} 
              placeholder="Konfirmasi password"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              on:click={() => showConfirmPassword = !showConfirmPassword}
            >
              <IconWrapper icon={showConfirmPassword ? EyeOff : Eye} className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" on:click={() => showAddEditDialog = false}>Batal</Button>
        <Button on:click={handleSaveCashier}>Simpan</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/if}

{#if showActivityModal}
  <Dialog open={showActivityModal} onOpenChange={(open) => { if (!open) showActivityModal = false; }}>
    <DialogContent class="sm:max-w-[600px] max-h-[80vh]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
                                <IconWrapper icon={Activity} className="h-5 w-5 text-primary" />
          Detail Aktivitas - {selectedCashierName}
        </DialogTitle>
        <DialogDescription>
          Riwayat aktivitas kasir dalam 50 record terakhir
        </DialogDescription>
      </DialogHeader>
      
      <div class="py-4">
        {#if loadingActivities}
          <div class="flex justify-center items-center py-8">
            <div class="inline-block animate-spin h-6 w-6 border-4 border-t-primary border-r-transparent rounded-full mr-3"></div>
            <span>Memuat aktivitas...</span>
          </div>
        {:else if selectedCashierActivities.length === 0}
                  <div class="text-center py-8 text-muted-foreground">
          <IconWrapper icon={Activity} className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p>Belum ada aktivitas tercatat</p>
          </div>
        {:else}
          <ScrollArea class="h-[400px] w-full rounded-md border">
            <div class="p-4">
              <div class="space-y-3">
                {#each selectedCashierActivities as activity}
                  <div class="flex items-start gap-3 p-3 bg-muted rounded-lg">
                    <div class="flex-shrink-0 mt-1">
                      {#if activity.activity_type === 'login'}
                        <div class="w-8 h-8 bg-success/10 rounded-full flex items-center justify-center">
                          <IconWrapper icon={User} className="h-4 w-4 text-success" />
                        </div>
                      {:else if activity.activity_type === 'logout'}
                        <div class="w-8 h-8 bg-destructive/10 rounded-full flex items-center justify-center">
                          <IconWrapper icon={Circle} className="h-4 w-4 text-destructive" />
                        </div>
                      {:else}
                        <div class="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <IconWrapper icon={Activity} className="h-4 w-4 text-primary" />
                        </div>
                      {/if}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="font-medium text-sm capitalize">
                          {activity.activity_type === 'login' ? 'Login' : 
                           activity.activity_type === 'logout' ? 'Logout' : 
                           'Navigasi'}
                        </span>
                        {#if activity.activity_type === 'route_change' && activity.route_path}
                          <span class="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                            {activity.route_path}
                          </span>
                        {/if}
                      </div>
                                              <div class="text-xs text-muted-foreground">
                        <div>{formatDate(activity.created_at)}</div>
                        {#if activity.ip_address}
                          <div class="mt-1">IP: {activity.ip_address}</div>
                        {/if}
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          </ScrollArea>
          
          <div class="mt-4 text-sm text-muted-foreground text-center">
            Total aktivitas: {selectedCashierActivities.length} record
          </div>
        {/if}
      </div>
      
      <DialogFooter>
        <Button variant="outline" on:click={() => showActivityModal = false}>Tutup</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/if}
