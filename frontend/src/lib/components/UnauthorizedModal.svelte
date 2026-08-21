<script lang="ts">
  import { authModal, closeModalAndRedirect } from '$lib/stores/authStore';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { fade, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { AlertTriangle } from 'lucide-svelte';

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
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    in:fade={{ duration: 200 }}
    out:fade={{ duration: 150 }}
    on:click={handleBackdropClick}
    on:keydown={(e) => { if (e.key === 'Escape') handleClose(); }}
    role="presentation"
  >
      <div
        class="relative mx-4 w-full max-w-md"
        in:scale={{ duration: 200, easing: quintOut, start: 0.95 }}
        out:scale={{ duration: 150, easing: quintOut, start: 1 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
      <Card class="shadow-lg">
        <CardHeader class="text-center pb-4">
          <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle class="h-7 w-7 text-destructive" />
          </div>

          <CardTitle class="text-xl font-semibold text-foreground" id="modal-title">
            {modalState.title}
          </CardTitle>
        </CardHeader>

        <CardContent class="space-y-6 px-6 pb-6">
          <p class="text-center text-muted-foreground text-base leading-relaxed">
            {modalState.message}
          </p>

          <Button
            variant="default"
            class="w-full h-12"
            on:click={handleClose}
          >
            Ke Halaman Login
          </Button>

          <p class="text-center text-xs text-muted-foreground">
            Anda akan diarahkan ke halaman login
          </p>
        </CardContent>
      </Card>
    </div>
  </div>
{/if}
