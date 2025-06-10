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
    
    if (!token || userRole !== 'superadmin') {
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

<div class="flex-1 space-y-6 p-4 md:p-8 pt-6">
  <div class="flex items-center justify-between">
    <h2 class="text-3xl font-bold tracking-tight">Profil Saya</h2>
    <Button 
    on:click={handleSaveProfile} 
    disabled={isSaving}
            class=""
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
          <IconWrapper icon={User} className="h-5 w-5" />
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
          />
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <IconWrapper icon={Lock} className="h-5 w-5" />
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
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              on:click={() => showCurrentPassword = !showCurrentPassword}
            >
              <IconWrapper icon={showCurrentPassword ? EyeOff : Eye} className="h-4 w-4" />
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
              placeholder="Masukkan password baru (minimal 6 karakter)"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              on:click={() => showNewPassword = !showNewPassword}
            >
              <IconWrapper icon={showNewPassword ? EyeOff : Eye} className="h-4 w-4" />
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
      </CardContent>
    </Card>
  </div>
</div>
