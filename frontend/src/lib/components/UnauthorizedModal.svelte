<script lang="ts">
  import { authModal, closeModalAndRedirect } from '$lib/stores/authStore';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { fade, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  $: modalState = $authModal;

  function handleClose() {
    closeModalAndRedirect();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }
</script>

{#if modalState.isOpen}
    <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    in:fade={{ duration: 300 }}
    out:fade={{ duration: 200 }}
    on:click={handleBackdropClick}
    on:keydown={(e) => { if (e.key === 'Escape') handleClose(); }}
    role="presentation"
  >
      <div
        class="relative mx-4 w-full max-w-md"
        in:scale={{ duration: 400, delay: 100, easing: quintOut, start: 0.9 }}
        out:scale={{ duration: 200, easing: quintOut, start: 1 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
      <Card class="border-0 shadow-2xl bg-white dark:bg-gray-900">
        <CardHeader class="text-center pb-4">
          <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-orange-500">
            <span class="text-2xl text-white">⚠️</span>
          </div>
          
          <CardTitle class="text-xl font-bold text-gray-900 dark:text-white" id="modal-title">
            {modalState.title}
          </CardTitle>
        </CardHeader>

        <CardContent class="space-y-6 px-6 pb-6">
          <p class="text-center text-gray-600 dark:text-gray-300 text-base leading-relaxed">
            {modalState.message}
          </p>

          <Button 
            variant="default"
            class="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
            on:click={handleClose}
          >
            <div class="flex items-center space-x-2">
              <span>🔐</span>
              <span>Ke Halaman Login</span>
            </div>
          </Button>

          <p class="text-center text-xs text-gray-400 dark:text-gray-500">
            Anda akan diarahkan ke halaman login
          </p>
        </CardContent>
      </Card>
    </div>
  </div>
{/if}

<style>
  @keyframes backdropFade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style> 