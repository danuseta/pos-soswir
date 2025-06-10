<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
  import { Save, Store, Clock } from "lucide-svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { BACKEND_URL, getAuthHeaders } from "$lib/apiConfig";
  import { browser } from '$app/environment';
  import IconWrapper from "$lib/components/IconWrapper.svelte";
  import AlertMessage from "$lib/components/AlertMessage.svelte";
  import { useAlert } from "$lib/composables/useAlert";

  let settings = {
    store_name: '',
    store_address: '',
    store_phone: '',
    store_email: '',
    operating_hours_monday: '08:00-22:00',
    operating_hours_tuesday: '08:00-22:00',
    operating_hours_wednesday: '08:00-22:00',
    operating_hours_thursday: '08:00-22:00',
    operating_hours_friday: '08:00-22:00'
  };

  let isLoading = true;
  let isSaving = false;
  let error = null;

  const { showAlertMessage } = useAlert();

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
      
      showAlertMessage('info', 'Memuat pengaturan toko...');
      
      const response = await fetch(`${BACKEND_URL}/api/settings`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        settings = { ...settings, ...data };
        showAlertMessage('success', 'Pengaturan berhasil dimuat');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal memuat pengaturan");
      }
    } catch (err) {
      console.error("Error loading settings:", err);
      error = err.message;
      showAlertMessage('error', `Gagal memuat pengaturan: ${err.message}`);
    } finally {
      isLoading = false;
    }
  });

  async function handleSaveSettings() {
    try {
      isSaving = true;
      showAlertMessage('info', 'Menyimpan pengaturan...');
      
      const response = await fetch(`${BACKEND_URL}/api/settings`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      
      if (response.ok) {
        showAlertMessage('success', 'Pengaturan berhasil disimpan');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal menyimpan pengaturan");
      }
    } catch (err) {
      console.error("Error saving settings:", err);
      showAlertMessage('error', `Gagal menyimpan pengaturan: ${err.message}`);
    } finally {
      isSaving = false;
    }
  }

  const weekdays = [
    { key: 'monday', name: 'Senin' },
    { key: 'tuesday', name: 'Selasa' },
    { key: 'wednesday', name: 'Rabu' },
    { key: 'thursday', name: 'Kamis' },
    { key: 'friday', name: 'Jumat' }
  ];
</script>

<div class="flex-1 space-y-6 p-4 md:p-8 pt-6">
  <div class="flex items-center justify-between">
    <h2 class="text-3xl font-bold tracking-tight">Pengaturan Toko</h2>
    <Button 
      on:click={handleSaveSettings} 
      disabled={isSaving}
              class=""
    >
      <IconWrapper icon={Save} className="mr-2 h-4 w-4" />
      {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
    </Button>
  </div>

  <AlertMessage />

  {#if isLoading}
    <div class="flex justify-center items-center h-64">
      <div class="text-center">
        <div class="inline-block animate-spin h-8 w-8 border-4 border-t-primary border-r-transparent border-b-primary border-l-transparent rounded-full mb-4"></div>
        <p>Memuat pengaturan toko...</p>
      </div>
    </div>
  {:else if error}
    <Card>
      <CardContent class="p-8">
        <div class="text-center text-destructive">
          <p class="mb-2 font-semibold">Error:</p>
          <p>{error}</p>
          <Button 
            class="mt-4" 
            on:click={() => { if (typeof window !== 'undefined') window.location.reload(); }}
          >
            Muat Ulang
          </Button>
        </div>
      </CardContent>
    </Card>
  {:else}
    <div class="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <IconWrapper icon={Store} className="h-5 w-5" />
            Informasi Toko
          </CardTitle>
          <CardDescription>
            Pengaturan dasar informasi toko Anda
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="store_name">Nama Toko</Label>
              <Input id="store_name" bind:value={settings.store_name} placeholder="Nama toko Anda" />
            </div>
            <div class="space-y-2">
              <Label for="store_email">Email</Label>
              <Input id="store_email" type="email" bind:value={settings.store_email} placeholder="email@toko.com" />
            </div>
          </div>
          
          <div class="space-y-2">
            <Label for="store_address">Alamat</Label>
            <Input id="store_address" bind:value={settings.store_address} placeholder="Alamat lengkap toko" />
          </div>
          
          <div class="space-y-2">
            <Label for="store_phone">Nomor Telepon</Label>
            <Input id="store_phone" bind:value={settings.store_phone} placeholder="+62 21 1234 5678" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <IconWrapper icon={Clock} className="h-5 w-5" />
            Jam Operasional
          </CardTitle>
          <CardDescription>
            Atur jam buka dan tutup toko (Senin - Jumat)
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          {#each weekdays as day}
            <div class="flex items-center gap-4">
              <div class="w-20 text-sm font-medium">{day.name}</div>
              <Input 
                bind:value={settings[`operating_hours_${day.key}`]} 
                placeholder="08:00-22:00"
                class="flex-1"
              />
            </div>
          {/each}
        </CardContent>
      </Card>
    </div>
  {/if}
</div>
