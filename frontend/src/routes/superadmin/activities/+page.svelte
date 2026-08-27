<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { RefreshCw } from "lucide-svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { api, apiData } from "$lib/apiConfig";
  import { browser } from '$app/environment';
  import IconWrapper from "$lib/components/IconWrapper.svelte";
  import AlertMessage from "$lib/components/AlertMessage.svelte";
  import { useAlert } from "$lib/composables/useAlert";
  import CleanupStats from '$lib/components/activities/CleanupStats.svelte';
  import CleanupControlPanel from '$lib/components/activities/CleanupControlPanel.svelte';
  import CleanupDialogs from '$lib/components/activities/CleanupDialogs.svelte';

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
      cleanupStatus = await apiData(api.get('/api/activity-cleanup/status'));
    } catch (err) {
      console.error("Error loading cleanup status:", err);
      error = err.message;
      showAlertMessage('error', `Gagal memuat status: ${err.message}`);
    }
  }

  async function loadCleanupLogs() {
    try {
      cleanupLogs = await apiData(api.get('/api/activity-cleanup/logs'));
    } catch (err) {
      console.error("Error loading cleanup logs:", err);
      showAlertMessage('error', `Gagal memuat logs: ${err.message}`);
    }
  }

  async function loadRetentionOptions() {
    try {
      retentionOptions = await apiData(api.get('/api/activity-cleanup/retention-options'));
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
      const result = await apiData<any>(api.post('/api/activity-cleanup/manual', {}));
      showAlertMessage('success', 
        `Cleanup manual berhasil! ${formatNumber(result.data.deletedActivities)} aktivitas dihapus.`
      );
      showManualCleanupDialog = false;
      await loadData();
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
      testResult = await apiData(api.post('/api/activity-cleanup/test', {}));
      showTestDialog = true;
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
      await apiData(api.post('/api/activity-cleanup/update-retention', {
        retentionDays: selectedRetentionDays,
        cleanupInterval: selectedInterval,
        intervalUnit: selectedIntervalUnit
      }));
      showAlertMessage('success', 
        `Pengaturan berhasil diupdate! ` + 
        `Aktivitas akan dihapus setelah ${selectedRetentionDays} hari, ` +
        `pembersihan ${selectedInterval} ${selectedIntervalUnit.toLowerCase()}.`
      );
      showRetentionDialog = false;
      await loadData();
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


    <CleanupStats status={cleanupStatus} {formatNumber} />

    <CleanupControlPanel status={cleanupStatus} logs={cleanupLogs} {isLoadingAction} {formatDateTime} {formatNumber} onRetention={() => showRetentionDialog = true} onTest={performTestCleanup} onCleanup={() => showManualCleanupDialog = true} />
  {/if}
</div>

<CleanupDialogs bind:showManual={showManualCleanupDialog} bind:showTest={showTestDialog} bind:showRetention={showRetentionDialog} {cleanupStatus} {testResult} {retentionOptions} bind:selectedRetentionDays bind:selectedInterval bind:selectedIntervalUnit {isLoadingAction} {formatDateTime} {formatNumber} onCleanup={performManualCleanup} onUpdate={updateRetentionSettings} />
