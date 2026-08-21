<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
  import { goto } from "$app/navigation";
  import { login } from "$lib/auth";
  import { onMount } from "svelte";
  import ThemeToggle from "$lib/components/theme-toggle.svelte";
  import { browser } from '$app/environment';
  import { fade } from 'svelte/transition';
  import { theme } from '$lib/themeStore';
  import { Eye, EyeOff } from 'lucide-svelte';

  let username = "";
  let password = "";
  let errorMessage = "";
  let isLoading = false;
  let showPassword = false;
  let currentTheme: 'light' | 'dark' = 'light';

  theme.subscribe(value => {
    currentTheme = value;
  });

  onMount(() => {
    if (!browser) return;

    const reason = sessionStorage.getItem('pos_logout_reason');
    if (reason) {
      errorMessage = reason;
      sessionStorage.removeItem('pos_logout_reason');
    }

    const token = localStorage.getItem('pos_token');
    const role = localStorage.getItem('pos_user_role');

    if (token && role) {
      if (role === 'superadmin') {
        goto('/superadmin/dashboard');
      } else if (role === 'cashier') {
        goto('/cashier/dashboard');
      }
    }
  });

  async function handleLogin() {
    errorMessage = "";
    isLoading = true;

    if (!username || !password) {
      errorMessage = "Username dan password tidak boleh kosong.";
      isLoading = false;
      return;
    }

    try {
      const result = await login(username, password);

      if (!result.success) {
        errorMessage = result.message;
        isLoading = false;
        return;
      }

      const role = localStorage.getItem('pos_user_role');
      if (role === 'superadmin') {
        goto('/superadmin/dashboard');
      } else if (role === 'cashier') {
        goto('/cashier/dashboard');
      } else {
        errorMessage = "Role pengguna tidak valid";
        isLoading = false;
      }
    } catch (error) {
      console.error("Login error:", error);
      errorMessage = "Terjadi kesalahan saat menghubungi server.";
      isLoading = false;
    }
  }

  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !isLoading) {
      handleLogin();
    }
  }

  function togglePasswordVisibility() {
    showPassword = !showPassword;
  }
</script>

<svelte:window on:keydown={handleKeyPress} />

<div class="relative flex min-h-screen items-center justify-center bg-muted p-4 sm:p-6">
  <div class="absolute top-4 right-4 sm:top-6 sm:right-6">
    <ThemeToggle />
  </div>

  <div class="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center space-x-3">
    <div class="w-8 h-8 sm:w-10 sm:h-10">
      {#if currentTheme === 'dark'}
        <img src="/Logo Soswir White.png" alt="Soswir Logo" class="w-full h-full object-contain" />
      {:else}
        <img src="/Logo Soswir noBG.png" alt="Soswir Logo" class="w-full h-full object-contain" />
      {/if}
    </div>
    <div class="text-left">
      <h1 class="text-base sm:text-lg font-semibold text-foreground">Soswir POS</h1>
      <p class="text-xs text-muted-foreground hidden sm:block">Advanced Point of Sale</p>
    </div>
  </div>

  <div class="w-full max-w-sm" in:fade={{ duration: 200 }}>
    <Card>
      <CardHeader class="space-y-3 text-center pb-6 pt-8">
        <div class="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-muted p-3">
          {#if currentTheme === 'dark'}
            <img src="/Logo Soswir White.png" alt="Soswir Logo" class="w-full h-full object-contain" />
          {:else}
            <img src="/Logo Soswir noBG.png" alt="Soswir Logo" class="w-full h-full object-contain" />
          {/if}
        </div>

        <div>
          <CardTitle class="text-2xl font-semibold text-foreground">
            Welcome Back
          </CardTitle>
          <CardDescription class="text-muted-foreground text-sm mt-2">
            Sign in to your Soswir POS account
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent class="space-y-5 px-6 pb-2">
        {#if errorMessage}
          <div in:fade={{ duration: 150 }}>
            <Alert variant="destructive" class="text-sm">
              <AlertTitle class="text-sm font-semibold">Authentication Error</AlertTitle>
              <AlertDescription class="text-sm">{errorMessage}</AlertDescription>
            </Alert>
          </div>
        {/if}

        <div class="space-y-2">
          <Label for="username" class="text-sm font-medium text-foreground">Username</Label>
          <Input
            id="username"
            type="text"
            placeholder="Enter your username"
            bind:value={username}
            disabled={isLoading}
            class="h-11 text-base"
          />
        </div>

        <div class="space-y-2">
          <Label for="password" class="text-sm font-medium text-foreground">Password</Label>
          <div class="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              bind:value={password}
              disabled={isLoading}
              class="h-11 text-base pr-12"
            />
            <button
              type="button"
              on:click={togglePasswordVisibility}
              class="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label={showPassword ? "Hide password" : "Show password"}
              disabled={isLoading}
            >
              {#if showPassword}
                <EyeOff class="w-5 h-5" />
              {:else}
                <Eye class="w-5 h-5" />
              {/if}
            </button>
          </div>
        </div>
      </CardContent>

      <CardFooter class="px-6 pb-8 pt-6">
        <Button
          variant="default"
          class="w-full h-12 text-base font-semibold"
          on:click={handleLogin}
          disabled={isLoading || !username || !password}
        >
          {#if isLoading}
            <div class="flex items-center space-x-2">
              <div class="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
              <span>Signing you in...</span>
            </div>
          {:else}
            <span>Sign In to Dashboard</span>
          {/if}
        </Button>
      </CardFooter>
    </Card>
  </div>

  <p class="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
    © 2025 MDSW. All rights reserved.
  </p>
</div>
