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
  import { fade, fly, scale, blur } from 'svelte/transition';
  import { theme } from '$lib/themeStore';
  import { Eye, EyeOff } from 'lucide-svelte';

  let username = "";
  let password = "";
  let errorMessage = "";
  let isLoading = false;
  let showCard = false;
  let showParticles = false;
  let showPassword = false;
  let currentTheme: 'light' | 'dark' = 'light';

  theme.subscribe(value => {
    currentTheme = value;
  });

  onMount(() => {
    if (!browser) return;
    
    const token = localStorage.getItem('pos_token');
    const role = localStorage.getItem('pos_user_role');
    
    if (token && role) {
      if (role === 'superadmin') {
        goto('/superadmin/dashboard');
      } else if (role === 'cashier') {
        goto('/cashier/dashboard');
      }
    }

    setTimeout(() => {
      showParticles = true;
    }, 300);
    
    setTimeout(() => {
      showCard = true;
    }, 600);
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

<div class="fixed inset-0 overflow-hidden">
  <div class="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/50 transition-all duration-1000"></div>
  
  <div class="absolute inset-0">
    <div class="absolute inset-0 opacity-[0.03] dark:opacity-[0.02]">
      <svg class="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="elegantWaves" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M0,50 Q25,25 50,50 T100,50" stroke="currentColor" stroke-width="1" fill="none"/>
            <path d="M0,25 Q25,0 50,25 T100,25" stroke="currentColor" stroke-width="0.5" fill="none"/>
            <path d="M0,75 Q25,50 50,75 T100,75" stroke="currentColor" stroke-width="0.5" fill="none"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#elegantWaves)" class="text-primary/20"/>
      </svg>
    </div>
    
    <div class="absolute inset-0 bg-gradient-to-tr from-primary/[0.02] via-transparent to-accent/[0.02]"></div>
    <div class="absolute inset-0 bg-gradient-to-bl from-secondary/[0.01] via-transparent to-primary/[0.01]"></div>
  </div>
  
  {#if showParticles}
    <div class="absolute inset-0" in:fade={{ duration: 1500 }}>
      <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-3xl animate-float opacity-40"></div>
      <div class="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-br from-accent/5 to-transparent rounded-full blur-3xl animate-float-delayed opacity-30"></div>
      
      <div class="particle-container">
        {#each Array(8) as _, i}
          <div class="elegant-particle elegant-particle-{i}" style="animation-delay: {i * 0.8}s;"></div>
        {/each}
      </div>
    </div>
  {/if}
  
  <div class="absolute inset-0 bg-elegant-grid opacity-[0.02] dark:opacity-[0.01]"></div>
</div>

<div class="relative flex min-h-screen items-center justify-center p-3 sm:p-4 md:p-6">
  <div class="absolute top-3 right-3 sm:top-4 sm:right-4 md:top-6 md:right-6 z-20" in:scale={{ duration: 400, delay: 200 }}>
    <div class="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-white/10 dark:bg-gray-900/20 backdrop-blur-md border border-white/20 dark:border-gray-700/30 shadow-lg">
    <ThemeToggle />
    </div>
  </div>
  
  <div class="absolute top-3 left-3 sm:top-4 sm:left-4 md:top-8 md:left-8 z-20" in:fly={{ x: -50, duration: 600, delay: 100 }}>
    <div class="flex items-center space-x-2 sm:space-x-3 md:space-x-4 p-2 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl bg-white/10 dark:bg-gray-900/20 backdrop-blur-md border border-white/20 dark:border-gray-700/30">
      <div class="relative w-8 h-8 sm:w-10 sm:h-10 md:w-14 md:h-14 rounded-lg sm:rounded-xl md:rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 p-1 sm:p-1.5 md:p-2 overflow-hidden group"> 
        <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
        {#if currentTheme === 'dark'}
          <img 
            src="/Logo Soswir White.png" 
            alt="Soswir Logo" 
            class="w-full h-full object-contain relative z-10 filter drop-shadow-lg"
          />
        {:else}
          <img 
            src="/Logo Soswir noBG.png" 
            alt="Soswir Logo" 
            class="w-full h-full object-contain relative z-10 filter drop-shadow-lg"
          />
        {/if}
      </div>
      <div class="text-left">
        <h1 class="text-sm sm:text-lg md:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Soswir POS
        </h1>
        <p class="text-xs sm:text-sm text-muted-foreground font-medium hidden sm:block">Advanced Point of Sale</p>
      </div>
    </div>
  </div>
  
  {#if showCard}
    <div class="w-full max-w-xs sm:max-w-sm md:max-w-md relative" 
         in:fly={{ y: 50, duration: 800, delay: 300 }} 
         out:scale={{ duration: 300 }}>
      
      <div class="absolute inset-0 bg-gradient-to-r from-primary/15 to-accent/15 sm:from-primary/20 sm:to-accent/20 rounded-2xl sm:rounded-3xl blur-xl scale-105 opacity-70"></div>
      
      <Card class="relative shadow-xl sm:shadow-2xl border-0 bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
        
        <CardHeader class="space-y-3 sm:space-y-4 text-center pb-4 sm:pb-6 md:pb-8 pt-4 sm:pt-6 md:pt-8 relative">
          <div class="mx-auto relative group" in:scale={{ duration: 600, delay: 500 }}>
            <div class="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10 p-3 sm:p-4 backdrop-blur-sm border border-white/20 shadow-lg group-hover:scale-105 transition-transform duration-300">
              <div class="relative w-full h-full">
                {#if currentTheme === 'dark'}
                  <img 
                    src="/Logo Soswir White.png" 
                    alt="Soswir Logo" 
                    class="w-full h-full object-contain filter drop-shadow-lg"
                  />
                {:else}
                  <img 
                    src="/Logo Soswir noBG.png" 
                    alt="Soswir Logo" 
                    class="w-full h-full object-contain filter drop-shadow-lg"
                  />
                {/if}
                <div class="absolute inset-0 rounded-2xl sm:rounded-3xl border-2 border-primary/30 animate-pulse"></div>
              </div>
            </div>
          </div>
          
          <div in:fade={{ duration: 600, delay: 700 }}>
            <CardTitle class="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
              Welcome Back
          </CardTitle>
            <CardDescription class="text-muted-foreground text-sm sm:text-base mt-2 font-medium px-2 sm:px-0">
              Sign in to your Soswir POS account
      </CardDescription>
          </div>
    </CardHeader>

        <CardContent class="space-y-4 sm:space-y-6 px-4 sm:px-6 md:px-8 pb-2">
          <div in:fade={{ duration: 600, delay: 900 }}>
      {#if errorMessage}
              <div in:fly={{ x: -20, duration: 400 }} out:fade={{ duration: 200 }}>
                <Alert variant="destructive" class="border border-destructive/30 bg-destructive/10 backdrop-blur-sm text-sm">
                  <div class="flex items-start space-x-2">
                    <div class="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-destructive/20 flex items-center justify-center mt-0.5">
                      <span class="text-destructive text-xs">!</span>
                    </div>
                    <div class="flex-1">
                      <AlertTitle class="text-destructive font-semibold text-sm">Authentication Error</AlertTitle>
                      <AlertDescription class="text-destructive/90 text-xs sm:text-sm">{errorMessage}</AlertDescription>
                    </div>
                  </div>
        </Alert>
            </div>
      {/if}

            <div class="space-y-4 sm:space-y-5">
              <div class="space-y-2 group">
                <Label for="username" class="text-sm font-semibold text-foreground flex items-center space-x-2">
                  <span class="w-1 h-3 sm:h-4 bg-gradient-to-b from-primary to-accent rounded-full"></span>
                  <span>Username</span>
              </Label>
                <div class="relative">
              <Input 
                id="username" 
                type="text" 
                    placeholder="Enter your username"
                bind:value={username}
                disabled={isLoading}
                    class="h-11 sm:h-12 border-2 border-border/50 focus:border-primary bg-background/50 backdrop-blur-sm text-foreground placeholder:text-muted-foreground rounded-xl transition-all duration-300 focus:scale-[1.02] focus:shadow-lg text-base"
              />
                  <div class="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                </div>
            </div>
            
              <div class="space-y-2 group">
                <Label for="password" class="text-sm font-semibold text-foreground flex items-center space-x-2">
                  <span class="w-1 h-3 sm:h-4 bg-gradient-to-b from-primary to-accent rounded-full"></span>
                  <span>Password</span>
              </Label>
                <div class="relative">
              <Input 
                id="password" 
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                bind:value={password}
                disabled={isLoading}
                    class="h-11 sm:h-12 border-2 border-border/50 focus:border-primary bg-background/50 backdrop-blur-sm text-foreground placeholder:text-muted-foreground rounded-xl transition-all duration-300 focus:scale-[1.02] focus:shadow-lg text-base pr-12"
                  />
                  <button
                    type="button"
                    on:click={togglePasswordVisibility}
                    class="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    disabled={isLoading}
                  >
                    {#if showPassword}
                      <EyeOff class="w-4 h-4 sm:w-5 sm:h-5" />
                    {:else}
                      <Eye class="w-4 h-4 sm:w-5 sm:h-5" />
                    {/if}
                  </button>
                  <div class="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                </div>
              </div>
      </div>
      </div>
    </CardContent>

        <CardFooter class="px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8 pt-4 sm:pt-6">
          <Button 
            variant="default" 
            class="w-full h-12 sm:h-14 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-semibold text-sm sm:text-base rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none relative overflow-hidden group touch-manipulation" 
            on:click={handleLogin} 
            disabled={isLoading || !username || !password}
          >
            <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            
        {#if isLoading}
              <div class="flex items-center space-x-2 sm:space-x-3">
                <div class="w-4 h-4 sm:w-5 sm:h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                <span>Signing you in...</span>
              </div>
        {:else}
              <div class="flex items-center space-x-2 sm:space-x-3 relative z-10">
                <div class="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center">
                  {#if currentTheme === 'dark'}
                    <img 
                      src="/Logo Soswir White.png" 
                      alt="Soswir Logo" 
                      class="w-full h-full object-contain filter drop-shadow-sm"
                    />
                  {:else}
                    <img 
                      src="/Logo Soswir noBG.png" 
                      alt="Soswir Logo" 
                      class="w-full h-full object-contain filter drop-shadow-sm"
                    />
                  {/if}
                </div>
                <span>Sign In to Dashboard</span>
              </div>
        {/if}
      </Button>
    </CardFooter>
  </Card>
</div>
  {/if}

  <div class="absolute bottom-3 sm:bottom-4 md:bottom-6 left-1/2 transform -translate-x-1/2 text-center px-3" 
       in:fade={{ duration: 600, delay: 1200 }}>
    <div class="px-3 sm:px-4 md:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl bg-white/10 dark:bg-gray-900/20 backdrop-blur-md border border-white/20 dark:border-gray-700/30">
      <p class="text-xs sm:text-sm text-muted-foreground font-medium">
        © 2025 MDSW. All rights reserved.
      </p>
    </div>
  </div>
</div>

<style> 
  @keyframes float {
    0%, 100% { 
      transform: translateY(0px) rotate(0deg); 
      opacity: 0.4;
    }
    50% { 
      transform: translateY(-15px) rotate(180deg); 
      opacity: 0.7;
    }
  }
  
  @keyframes float-delayed {
    0%, 100% { 
      transform: translateY(0px) rotate(0deg) scale(1); 
      opacity: 0.3;
    }
    50% { 
      transform: translateY(-20px) rotate(-180deg) scale(1.05); 
      opacity: 0.6;
    }
  }
  
  @keyframes elegant-drift {
    0%, 100% { 
      transform: translateY(0px) translateX(0px); 
      opacity: 0.3;
    }
    25% { 
      transform: translateY(-10px) translateX(5px); 
      opacity: 0.5;
    }
    50% { 
      transform: translateY(-15px) translateX(-3px); 
      opacity: 0.7;
    }
    75% { 
      transform: translateY(-8px) translateX(8px); 
      opacity: 0.4;
    }
  }
  
  .animate-float {
    animation: float 8s ease-in-out infinite;
  }
  
  .animate-float-delayed {
    animation: float-delayed 10s ease-in-out infinite;
    animation-delay: 2s;
  }
  
  /* Elegant particle system */
  .particle-container {
    position: absolute;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  
  .elegant-particle {
    position: absolute;
    width: 3px;
    height: 3px;
    background: linear-gradient(135deg, hsl(var(--primary)/0.4), hsl(var(--accent)/0.3));
    border-radius: 50%;
    animation: elegant-drift 12s ease-in-out infinite;
    box-shadow: 0 0 6px hsl(var(--primary)/0.2);
  }
  
  .elegant-particle-0 { top: 15%; left: 20%; animation-duration: 12s; }
  .elegant-particle-1 { top: 25%; left: 75%; animation-duration: 14s; }
  .elegant-particle-2 { top: 45%; left: 30%; animation-duration: 11s; }
  .elegant-particle-3 { top: 35%; left: 80%; animation-duration: 13s; }
  .elegant-particle-4 { top: 65%; left: 25%; animation-duration: 15s; }
  .elegant-particle-5 { top: 55%; left: 85%; animation-duration: 10s; }
  .elegant-particle-6 { top: 75%; left: 40%; animation-duration: 16s; }
  .elegant-particle-7 { top: 85%; left: 70%; animation-duration: 12s; }
  
  /* Elegant grid pattern */
  .bg-elegant-grid {
    background-image: 
      radial-gradient(circle at 25% 25%, hsl(var(--primary)/0.05) 2px, transparent 2px),
      radial-gradient(circle at 75% 75%, hsl(var(--accent)/0.03) 1px, transparent 1px),
      linear-gradient(hsl(var(--border)/0.1) 1px, transparent 1px),
      linear-gradient(90deg, hsl(var(--border)/0.1) 1px, transparent 1px);
    background-size: 100px 100px, 60px 60px, 20px 20px, 20px 20px;
    background-position: 0 0, 30px 30px, 0 0, 0 0;
  }
  
  /* Dark theme adjustments */
  :global(.dark) .bg-elegant-grid {
    background-image: 
      radial-gradient(circle at 25% 25%, hsl(var(--primary)/0.03) 2px, transparent 2px),
      radial-gradient(circle at 75% 75%, hsl(var(--accent)/0.02) 1px, transparent 1px),
      linear-gradient(hsl(var(--border)/0.05) 1px, transparent 1px),
      linear-gradient(90deg, hsl(var(--border)/0.05) 1px, transparent 1px);
  }
  
  :global(.dark) .elegant-particle {
    background: linear-gradient(135deg, hsl(var(--primary)/0.3), hsl(var(--accent)/0.2));
    box-shadow: 0 0 4px hsl(var(--primary)/0.15);
  }
</style>

