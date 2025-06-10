<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
  import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
  import { Badge } from "$lib/components/ui/badge";
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "$lib/components/ui/dialog";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { 
    Activity, 
    Trash2, 
    RefreshCw, 
    Settings, 
    Clock, 
    Database, 
    AlertTriangle,
    CheckCircle,
    Info,
    Play,
    Eye,
    Sliders
  } from "lucide-svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { BACKEND_URL, getAuthHeaders } from "$lib/apiConfig";
  import { browser } from '$app/environment';
  import IconWrapper from "$lib/components/IconWrapper.svelte";
  import AlertMessage from "$lib/components/AlertMessage.svelte";
  import { useAlert } from "$lib/composables/useAlert";

  let cleanupStatus = null;
  let cleanupLogs = null;
  let isLoading = true;
  let isLoadingAction = false;
  let error = null;

  const { showAlertMessage } = useAlert();

  let showManualCleanupDialog = false;
  let showTestDialog = false;
  let testResult = null;
  let showRetentionDialog = false;
  
  let retentionOptions = null;
  let selectedRetentionDays = 3;
  let selectedInterval = 1;
  let selectedIntervalUnit = 'DAY';

  function formatDateTime(dateString) {
    if (!dateString) return 'Belum pernah';
    return new Date(dateString).toLocaleString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatNumber(num) {
    return new Intl.NumberFormat('id-ID').format(num || 0);
  }

  async function loadCleanupStatus() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/activity-cleanup/status`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        cleanupStatus = await response.json();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal memuat status cleanup");
      }
    } catch (err) {
      console.error("Error loading cleanup status:", err);
      error = err.message;
      showAlertMessage('error', `Gagal memuat status: ${err.message}`);
    }
  }

  async function loadCleanupLogs() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/activity-cleanup/logs`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        cleanupLogs = await response.json();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal memuat logs cleanup");
      }
    } catch (err) {
      console.error("Error loading cleanup logs:", err);
      showAlertMessage('error', `Gagal memuat logs: ${err.message}`);
    }
  }

  async function loadRetentionOptions() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/activity-cleanup/retention-options`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        retentionOptions = await response.json();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal memuat opsi retensi");
      }
    } catch (err) {
      console.error("Error loading retention options:", err);
      showAlertMessage('error', `Gagal memuat opsi retensi: ${err.message}`);
    }
  }

  async function loadData() {
    isLoading = true;
    await Promise.all([loadCleanupStatus(), loadCleanupLogs(), loadRetentionOptions()]);
    isLoading = false;
  }

  async function performManualCleanup() {
    try {
      isLoadingAction = true;
      const response = await fetch(`${BACKEND_URL}/api/activity-cleanup/manual`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const result = await response.json();
        showAlertMessage('success', 
          `Cleanup manual berhasil! ${formatNumber(result.data.deletedActivities)} aktivitas dihapus.`
        );
        showManualCleanupDialog = false;
        await loadData();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal melakukan cleanup manual");
      }
    } catch (err) {
      console.error("Error during manual cleanup:", err);
      showAlertMessage('error', `Cleanup manual gagal: ${err.message}`);
    } finally {
      isLoadingAction = false;
    }
  }

  async function performTestCleanup() {
    try {
      isLoadingAction = true;
      const response = await fetch(`${BACKEND_URL}/api/activity-cleanup/test`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        testResult = await response.json();
        showTestDialog = true;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal melakukan test cleanup");
      }
    } catch (err) {
      console.error("Error during test cleanup:", err);
      showAlertMessage('error', `Test cleanup gagal: ${err.message}`);
    } finally {
      isLoadingAction = false;
    }
  }

  async function updateRetentionSettings() {
    try {
      isLoadingAction = true;
      const response = await fetch(`${BACKEND_URL}/api/activity-cleanup/update-retention`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          retentionDays: selectedRetentionDays,
          cleanupInterval: selectedInterval,
          intervalUnit: selectedIntervalUnit
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        showAlertMessage('success', 
          `Pengaturan berhasil diupdate! ` + 
          `Aktivitas akan dihapus setelah ${selectedRetentionDays} hari, ` +
          `pembersihan ${selectedInterval} ${selectedIntervalUnit.toLowerCase()}.`
        );
        showRetentionDialog = false;
        await loadData();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal mengupdate pengaturan");
      }
    } catch (err) {
      console.error("Error updating retention:", err);
      showAlertMessage('error', `Update pengaturan gagal: ${err.message}`);
    } finally {
      isLoadingAction = false;
    }
  }

  onMount(async () => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_token") : null;
    const userRole = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_user_role") : null;
    
    if (!token || userRole !== 'superadmin') {
      goto("/login");
      return;
    }
    
    if (browser) {
      await loadData();
    }
  });

  $: cleanupEfficiency = cleanupStatus?.data ? 
    Math.round((cleanupStatus.data.totalActivities - cleanupStatus.data.oldActivities) / cleanupStatus.data.totalActivities * 100) : 0;
</script>

<div class="flex-1 space-y-6 p-4 md:p-8 pt-6">
  <div class="flex items-center justify-between space-y-2">
    <div>
      <h2 class="text-3xl font-bold tracking-tight">Manajemen Aktivitas</h2>
      <p class="text-muted-foreground">
        Kelola pembersihan otomatis data aktivitas pengguna
      </p>
    </div>
    <Button 
      on:click={loadData} 
      disabled={isLoading}
      class=""
    >
      <IconWrapper icon={RefreshCw} className="mr-2 h-4 w-4 {isLoading ? 'animate-spin' : ''}" />
      Refresh
    </Button>
  </div>

  <AlertMessage />

  {#if isLoading}
    <div class="bg-card p-8 rounded-lg shadow flex justify-center">
      <div class="text-center">
        <div class="inline-block animate-spin h-8 w-8 border-4 border-t-primary border-r-transparent border-b-primary border-l-transparent rounded-full mb-4"></div>
        <p>Memuat data aktivitas...</p>
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
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Status Auto Cleanup</CardTitle>
          <IconWrapper 
            icon={cleanupStatus?.data?.isAutoCleanupActive ? CheckCircle : AlertTriangle} 
            className={`h-4 w-4 ${cleanupStatus?.data?.isAutoCleanupActive ? 'text-success' : 'text-destructive'}`}
          />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">
            {cleanupStatus?.data?.isAutoCleanupActive ? 'Aktif' : 'Non-aktif'}
          </div>
          <p class="text-xs text-muted-foreground">
            Interval: {cleanupStatus?.data?.cleanupInterval || 'Tidak diatur'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Total Aktivitas</CardTitle>
          <IconWrapper icon={Activity} className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">
            {formatNumber(cleanupStatus?.data?.totalActivities)}
          </div>
          <p class="text-xs text-muted-foreground">
            Data aktivitas tersimpan
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Aktivitas > 3 Hari</CardTitle>
          <IconWrapper 
            icon={Clock} 
            className={`h-4 w-4 ${cleanupStatus?.data?.oldActivities > 0 ? 'text-destructive' : 'text-success'}`}
          />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">
            {formatNumber(cleanupStatus?.data?.oldActivities)}
          </div>
          <p class="text-xs text-muted-foreground">
            {cleanupStatus?.data?.oldActivities > 0 ? 'Perlu dibersihkan' : 'Database bersih'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Event Scheduler</CardTitle>
          <IconWrapper 
            icon={Database} 
            className={`h-4 w-4 ${cleanupStatus?.data?.eventSchedulerStatus === 'ENABLED' ? 'text-success' : 'text-destructive'}`}
          />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">
            {cleanupStatus?.data?.eventSchedulerStatus || 'Unknown'}
          </div>
          <p class="text-xs text-muted-foreground">
            MySQL Event Status
          </p>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader>
        <CardTitle class="flex items-center">
          <IconWrapper icon={Settings} className="mr-2 h-5 w-5" />
          Aksi Cleanup
        </CardTitle>
        <CardDescription>Kelola pembersihan data aktivitas</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="flex flex-wrap gap-4">
          <Button 
            on:click={() => showRetentionDialog = true} 
            variant="outline"
            disabled={isLoadingAction}
            class="text-purple-700 border-purple-200"
          >
            <IconWrapper icon={Sliders} className="mr-2 h-4 w-4" />
            Atur Periode Retensi
          </Button>
          
          <Button 
            on:click={performTestCleanup} 
            variant="outline"
            disabled={isLoadingAction}
            class=""
          >
            <IconWrapper icon={Eye} className="mr-2 h-4 w-4" />
            Test Cleanup (Dry Run)
          </Button>
          
          <Button 
            on:click={() => showManualCleanupDialog = true} 
            disabled={isLoadingAction || cleanupStatus?.data?.oldActivities === 0}
            class=""
          >
            <IconWrapper icon={Play} className="mr-2 h-4 w-4" />
            Manual Cleanup
          </Button>       
        </div>

        <div class="bg-muted p-4 rounded-lg">
          <div class="flex items-center gap-2 mb-2">
            <IconWrapper icon={Info} className="h-4 w-4 text-primary" />
            <span class="font-medium">Informasi Auto Cleanup</span>
          </div>
          <div class="grid gap-3 text-sm">
            <div class="flex justify-between items-center">
              <span>Periode Retensi:</span>
              <Badge variant="outline" class="text-primary border-primary/20">
                3 hari (tetap)
              </Badge>
            </div>
            <div class="flex justify-between items-start">
              <span>Cleanup Berikutnya:</span>
              <div class="text-right">
                <div class="font-mono text-success">
                  {cleanupStatus?.data?.nextCleanup || 'Tidak tersedia'}
                </div>
                <div class="text-xs text-muted-foreground">
                  {#if cleanupStatus?.data?.cleanupInterval?.includes('DAY')}
                    Otomatis setiap hari (jam tetap)
                  {:else}
                    Otomatis setiap {cleanupStatus?.data?.cleanupInterval || 'jam'}
                  {/if}
                </div>
              </div>
            </div>
            <div class="flex justify-between items-center">
              <span>Cleanup Terakhir:</span>
              <span class="font-mono">
                {formatDateTime(cleanupStatus?.data?.lastCleanupLogged || cleanupStatus?.data?.lastCleanupScheduled)}
              </span>
            </div>
            
            <div class="mt-3 pt-3 border-t border-border">
              <div class="flex items-center gap-2">
                {#if cleanupStatus?.data?.oldActivities === 0}
                  <IconWrapper icon={CheckCircle} className="h-4 w-4 text-success" />
                  <span class="text-success font-medium">
                    Database bersih - Tidak ada data lama
                  </span>
                {:else}
                  <IconWrapper icon={AlertTriangle} className="h-4 w-4 text-yellow-500" />
                  <span class="text-yellow-600 dark:text-yellow-400 font-medium">
                    {formatNumber(cleanupStatus?.data?.oldActivities)} aktivitas perlu dibersihkan
                  </span>
                {/if}
              </div>
              
              <div class="mt-2 text-xs text-muted-foreground">
                • Total aktivitas saat ini: <strong>{formatNumber(cleanupStatus?.data?.totalActivities)}</strong><br/>
                • Aktivitas yang melewati 3 hari: <strong>{formatNumber(cleanupStatus?.data?.oldActivities)}</strong><br/>
                {#if cleanupStatus?.data?.cleanupInterval?.includes('DAY')}
                  • System akan otomatis menghapus aktivitas > 3 hari setiap hari
                {:else}
                  • System akan otomatis menghapus aktivitas > 3 hari setiap {cleanupStatus?.data?.cleanupInterval || 'interval'}
                {/if}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    {#if cleanupLogs?.data}
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center">
            <IconWrapper icon={Activity} className="mr-2 h-5 w-5" />
            Statistik Aktivitas (7 Hari Terakhir)
          </CardTitle>
          <CardDescription>Distribusi aktivitas pengguna per hari</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea class="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jumlah Aktivitas</TableHead>
                  <TableHead>Persentase</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {#each cleanupLogs.data.dailyActivities as day}
                  {@const percentage = Math.round(day.activity_count / cleanupLogs.data.statistics.total_activities * 100)}
                  <TableRow>
                    <TableCell class="font-medium">
                      {formatDateTime(day.activity_date)}
                    </TableCell>
                    <TableCell>{formatNumber(day.activity_count)}</TableCell>
                    <TableCell>
                      <div class="flex items-center gap-2">
                                  <div class="w-20 bg-muted rounded-full h-2">
                          <div 
              class="bg-primary h-2 rounded-full transition-all duration-300"
                            style="width: {percentage}%"
                          ></div>
                        </div>
                        <span class="text-sm">{percentage}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                {/each}
                {#if cleanupLogs.data.dailyActivities.length === 0}
                  <TableRow>
                    <TableCell colspan={3} class="text-center text-muted-foreground">
                      Tidak ada data aktivitas
                    </TableCell>
                  </TableRow>
                {/if}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    {/if}
  {/if}
</div>

<Dialog bind:open={showManualCleanupDialog}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Konfirmasi Manual Cleanup</DialogTitle>
      <DialogDescription>
        Anda akan menghapus <strong>{formatNumber(cleanupStatus?.data?.oldActivities)} aktivitas</strong> 
        yang lebih lama dari {cleanupStatus?.data?.retentionDays} hari.
      </DialogDescription>
    </DialogHeader>
    
    <div class="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
      <div class="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
        <IconWrapper icon={AlertTriangle} className="h-4 w-4" />
        <span class="font-medium">Peringatan</span>
      </div>
      <p class="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
        Aksi ini tidak dapat dibatalkan. Data yang dihapus tidak dapat dikembalikan.
      </p>
    </div>
    
    <DialogFooter>
      <Button 
        variant="outline" 
        on:click={() => showManualCleanupDialog = false}
        class=""
      >
        Batal
      </Button>
      <Button 
        on:click={performManualCleanup} 
        disabled={isLoadingAction}
        class=""
      >
        {#if isLoadingAction}
          <IconWrapper icon={RefreshCw} className="mr-2 h-4 w-4 animate-spin" />
        {:else}
          <IconWrapper icon={Trash2} className="mr-2 h-4 w-4" />
        {/if}
        Hapus Sekarang
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

<Dialog bind:open={showTestDialog}>
  <DialogContent class="max-w-2xl">
    <DialogHeader>
      <DialogTitle>Hasil Test Cleanup (Dry Run)</DialogTitle>
      <DialogDescription>
        Simulasi pembersihan data tanpa menghapus data sesungguhnya
      </DialogDescription>
    </DialogHeader>
    
    {#if testResult?.data}
      <div class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
          <div class="bg-primary/10 p-4 rounded-lg">
            <div class="text-2xl font-bold text-primary">
              {formatNumber(testResult.data.wouldDelete)}
            </div>
            <div class="text-sm text-primary">
              Aktivitas akan dihapus
            </div>
          </div>
          
          <div class="bg-success/10 p-4 rounded-lg">
            <div class="text-2xl font-bold text-success">
              {testResult.data.retentionDays}
            </div>
            <div class="text-sm text-success">
              Hari periode retensi
            </div>
          </div>
        </div>

        {#if testResult.data.wouldDelete > 0}
          <div>
            <h4 class="font-medium mb-2">Rentang Data yang Akan Dihapus:</h4>
            <div class="text-sm text-muted-foreground">
              <div>Terlama: {formatDateTime(testResult.data.oldestToDelete)}</div>
              <div>Terbaru: {formatDateTime(testResult.data.newestToDelete)}</div>
            </div>
          </div>

          {#if testResult.data.examples?.length > 0}
            <div>
              <h4 class="font-medium mb-2">Contoh Data (10 pertama):</h4>
              <ScrollArea class="h-[200px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead>Waktu</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {#each testResult.data.examples as example}
                      <TableRow>
                        <TableCell>{example.id}</TableCell>
                        <TableCell>{example.username}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{example.activity_type}</Badge>
                        </TableCell>
                        <TableCell>{formatDateTime(example.created_at)}</TableCell>
                      </TableRow>
                    {/each}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          {/if}
        {:else}
          <div class="text-center p-4 bg-success/10 rounded-lg">
            <IconWrapper icon={CheckCircle} className="mx-auto h-8 w-8 text-success mb-2" />
            <p class="text-success">
              Tidak ada data yang perlu dihapus saat ini.
            </p>
          </div>
        {/if}
      </div>
    {/if}
    
    <DialogFooter>
      <Button 
        variant="outline" 
        on:click={() => showTestDialog = false}
        class=""
      >
        Tutup
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

<Dialog bind:open={showRetentionDialog}>
  <DialogContent class="max-w-2xl">
    <DialogHeader>
      <DialogTitle>Pengaturan Periode Retensi Aktivitas</DialogTitle>
      <DialogDescription>
        Ubah periode penyimpanan dan frekuensi pembersihan data aktivitas pengguna
      </DialogDescription>
    </DialogHeader>
    
    <div class="space-y-6">
      <div class="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
        <div class="flex items-center mb-2">
          <IconWrapper icon={AlertTriangle} className="mr-2 h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          <span class="font-medium text-yellow-900 dark:text-yellow-100">Peringatan Penting</span>
        </div>
        <p class="text-yellow-800 dark:text-yellow-200 text-sm">
          Mengubah pengaturan ini akan merubah event scheduler MySQL dan berlaku segera. 
          Pastikan pengaturan yang dipilih sesuai dengan kebutuhan sistem.
        </p>
      </div>

      {#if retentionOptions?.data}
        <div>
          <label for="retention-days" class="block text-sm font-medium text-foreground mb-2">
            Hapus aktivitas setelah:
          </label>    
          <select 
            id="retention-days"
            bind:value={selectedRetentionDays}
            class="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary bg-background text-foreground"
          >
            {#each retentionOptions.data.retentionDays as option}
              <option value={option.value}>
                {option.label} - {option.description}
              </option>
            {/each}
          </select>
        </div>

        <div>
          <label for="cleanup-interval" class="block text-sm font-medium text-foreground mb-2">
            Frekuensi pembersihan:
          </label>
          <select 
            id="cleanup-interval"
            bind:value={selectedInterval}
            on:change={(e) => {
              const target = e.currentTarget;
              const selectedOption = retentionOptions?.data?.intervals?.find(
                interval => interval.value == target.value && interval.unit == selectedIntervalUnit
              ) || retentionOptions?.data?.intervals?.find(
                interval => interval.value == target.value
              );
              if (selectedOption) {
                selectedIntervalUnit = selectedOption.unit;
              }
            }}
            class="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary bg-background text-foreground"
          >
            {#each retentionOptions.data.intervals as option}
              <option value={option.value} data-unit={option.unit}>
                {option.label} - {option.description}
              </option>
            {/each}
          </select>
        </div>

        <div class="bg-muted p-4 rounded-lg border border-border">
          <h4 class="font-medium text-foreground mb-3 flex items-center">
            <IconWrapper icon={Eye} className="mr-2 h-4 w-4" />
            Preview Pengaturan Baru:
          </h4>
          <div class="grid gap-2 text-sm">
            <div class="flex items-center gap-2">
              <IconWrapper icon={Clock} className="h-4 w-4 text-success" />
              <span>Aktivitas akan dihapus setelah <strong>{selectedRetentionDays} hari</strong></span>
            </div>
            <div class="flex items-center gap-2">
              <IconWrapper icon={RefreshCw} className="h-4 w-4 text-primary" />
              <span>Pembersihan otomatis <strong>setiap {selectedInterval} {selectedIntervalUnit.toLowerCase()}</strong></span>
            </div>
            <div class="flex items-center gap-2">
              <IconWrapper icon={Database} className="h-4 w-4 text-purple-500" />
              <span>Event scheduler MySQL akan diperbarui</span>
            </div>
          </div>
          
          <div class="mt-4 pt-4 border-t border-border">
            <div class="grid md:grid-cols-2 gap-4 text-xs">
              <div>
                <div class="font-medium text-muted-foreground mb-1">Pengaturan Saat Ini:</div>
                <div class="text-muted-foreground">
                  • Hapus setelah 3 hari<br/>
                  • Pembersihan setiap hari
                </div>
              </div>
              <div>
                <div class="font-medium text-purple-600 dark:text-purple-400 mb-1">Pengaturan Baru:</div>
                <div class="text-purple-600 dark:text-purple-400">
                  • Hapus setelah <strong>{selectedRetentionDays} hari</strong><br/>
                  • Pembersihan <strong>setiap {selectedInterval} {selectedIntervalUnit.toLowerCase()}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      {:else}
        <div class="flex items-center justify-center py-8">
          <IconWrapper icon={RefreshCw} className="mr-2 h-5 w-5 animate-spin" />
          <span>Memuat opsi pengaturan...</span>
        </div>
      {/if}
    </div>
    
    <DialogFooter>
      <Button 
        variant="outline" 
        on:click={() => showRetentionDialog = false}
        disabled={isLoadingAction}
      >
        Batal
      </Button>
      <Button 
        on:click={updateRetentionSettings}
        disabled={isLoadingAction || !retentionOptions?.data}
        class="bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800"
      >
        {#if isLoadingAction}
          <IconWrapper icon={RefreshCw} className="mr-2 h-4 w-4 animate-spin" />
        {:else}
          <IconWrapper icon={Settings} className="mr-2 h-4 w-4" />
        {/if}
        Update Pengaturan
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog> 