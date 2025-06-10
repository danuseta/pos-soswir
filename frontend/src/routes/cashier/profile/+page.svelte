<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
  import { Save, User, Lock, Eye, EyeOff } from "lucide-svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { BACKEND_URL, getAuthHeaders } from "$lib/apiConfig";
  import { browser } from '$app/environment';
  import IconWrapper from "$lib/components/IconWrapper.svelte";
  import AlertMessage from "$lib/components/AlertMessage.svelte";
  import { useAlert } from "$lib/composables/useAlert";

  let currentProfile = {
    username: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  let isLoading = false;
  let isSaving = false;
  let error = null;

  let showCurrentPassword = false;
  let showNewPassword = false;
  let showConfirmPassword = false;

  const { showAlertMessage } = useAlert();

  onMount(async () => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_token") : null;
    const userRole = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_user_role") : null;
    
    if (!token || userRole !== 'cashier') {
      goto("/login");
      return;
    }
    
    if (browser) {
      const storedUsername = localStorage.getItem('pos_username');
      currentProfile.username = storedUsername || '';
    }
  });

  async function handleSaveProfile() {
    try {
      isSaving = true;
      
      if (!currentProfile.username) {
        showAlertMessage('error', 'Username tidak boleh kosong');
        return;
      }
      
      if (currentProfile.username.length < 3) {
        showAlertMessage('error', 'Username minimal 3 karakter');
        return;
      }

      if (currentProfile.newPassword || currentProfile.currentPassword) {
        if (!currentProfile.currentPassword) {
          showAlertMessage('error', 'Password lama harus diisi');
          return;
        }
        
        if (!currentProfile.newPassword) {
          showAlertMessage('error', 'Password baru harus diisi');
          return;
        }
        
        if (currentProfile.newPassword.length < 6) {
          showAlertMessage('error', 'Password baru minimal 6 karakter');
          return;
        }
        
        if (currentProfile.newPassword !== currentProfile.confirmPassword) {
          showAlertMessage('error', 'Konfirmasi password tidak cocok');
          return;
        }
      }

      showAlertMessage('info', 'Memperbarui profil...');

      const updateData: any = {
        username: currentProfile.username
      };

      if (currentProfile.newPassword) {
        updateData.currentPassword = currentProfile.currentPassword;
        updateData.newPassword = currentProfile.newPassword;
      }
      
      const response = await fetch(`${BACKEND_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });
      
      if (response.ok) {
        if (browser) {
          localStorage.setItem('pos_username', currentProfile.username);
        }
        
        currentProfile.currentPassword = '';
        currentProfile.newPassword = '';
        currentProfile.confirmPassword = '';
        
        showAlertMessage('success', 'Profil berhasil diperbarui');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal memperbarui profil");
      }
    } catch (err) {
      console.error("Error updating profile:", err);
      showAlertMessage('error', `Gagal memperbarui profil: ${err.message}`);
    } finally {
      isSaving = false;
    }
  }
</script>

<svelte:head>
  <title>Profil Saya - Cashier</title>
</svelte:head>

<div class="flex-1 space-y-6 p-4 md:p-8 pt-6">
  <div class="flex items-center justify-between">
    <h2 class="text-3xl font-bold tracking-tight">Profil Saya</h2>
    <Button 
      on:click={handleSaveProfile} 
      disabled={isSaving}
      class="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
    > 
      <IconWrapper icon={Save} className="mr-2 h-4 w-4" />
      {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
    </Button>
  </div>

  <AlertMessage />

  <div class="grid gap-6">
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <IconWrapper icon={User} className="h-5 w-5 text-green-600" />
          Informasi Profil
        </CardTitle>
        <CardDescription>
          Ubah informasi dasar akun Anda
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <Label for="username">Username</Label>
          <Input 
            id="username" 
            bind:value={currentProfile.username} 
            placeholder="Masukkan username baru"
            class="border-green-200 focus:border-green-500 focus:ring-green-500"
          />
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <IconWrapper icon={Lock} className="h-5 w-5 text-green-600" />
          Ubah Password
        </CardTitle>
        <CardDescription>
          Kosongkan jika tidak ingin mengubah password
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <Label for="currentPassword">Password Lama</Label>
          <div class="relative">
            <Input 
              id="currentPassword" 
              type={showCurrentPassword ? "text" : "password"}
              bind:value={currentProfile.currentPassword} 
              placeholder="Masukkan password lama"
              class="border-green-200 focus:border-green-500 focus:ring-green-500"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              on:click={() => showCurrentPassword = !showCurrentPassword}
            >
              <IconWrapper 
                icon={showCurrentPassword ? EyeOff : Eye} 
                className="h-4 w-4 text-gray-500 hover:text-green-600" 
              />
            </Button>
          </div>
        </div>

        <div class="space-y-2">
          <Label for="newPassword">Password Baru</Label>
          <div class="relative">
            <Input 
              id="newPassword" 
              type={showNewPassword ? "text" : "password"}
              bind:value={currentProfile.newPassword} 
              placeholder="Masukkan password baru"
              class="border-green-200 focus:border-green-500 focus:ring-green-500"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              on:click={() => showNewPassword = !showNewPassword}
            >
              <IconWrapper 
                icon={showNewPassword ? EyeOff : Eye} 
                className="h-4 w-4 text-gray-500 hover:text-green-600" 
              />
            </Button>
          </div>
        </div>

        <div class="space-y-2">
          <Label for="confirmPassword">Konfirmasi Password Baru</Label>
          <div class="relative">
            <Input 
              id="confirmPassword" 
              type={showConfirmPassword ? "text" : "password"}
              bind:value={currentProfile.confirmPassword} 
              placeholder="Konfirmasi password baru"
              class="border-green-200 focus:border-green-500 focus:ring-green-500"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              on:click={() => showConfirmPassword = !showConfirmPassword}
            >
              <IconWrapper 
                icon={showConfirmPassword ? EyeOff : Eye} 
                className="h-4 w-4 text-gray-500 hover:text-green-600" 
              />
            </Button>
          </div>
        </div>

        <div class="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div class="flex">
            <div class="ml-3">
              <h3 class="text-sm font-medium text-green-800 dark:text-green-200">
                Tips Keamanan
              </h3>
              <div class="mt-2 text-sm text-green-700 dark:text-green-300">
                <ul class="list-disc list-inside space-y-1">
                  <li>Gunakan password minimal 6 karakter</li>
                  <li>Kombinasikan huruf, angka, dan simbol</li>
                  <li>Jangan gunakan password yang mudah ditebak</li>
                  <li>Ubah password secara berkala</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</div>