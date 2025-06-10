<script lang="ts">
  import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
  
  export let show = false;
  export let type: 'success' | 'error' | 'info' = 'info';
  export let title = '';
  export let message = '';
  export let duration = 3000;

  $: if (show && duration > 0) {
    setTimeout(() => {
      show = false;
    }, duration);
  }

  function getAlertClass(type: string) {
    switch (type) {
      case 'success':
        return 'border-l-4 border-l-success bg-success/10';
      case 'error':
        return 'border-l-4 border-l-destructive bg-destructive/10';
      case 'info':
      default:
        return 'border-l-4 border-l-primary bg-primary/10';
    }
  }

  function getTitle(type: string) {
    switch (type) {
      case 'success':
        return 'Berhasil!';
      case 'error':
        return 'Error!';
      case 'info':
      default:
        return 'Info';
    }
  }
</script>

{#if show}
  <div class="fixed top-4 right-4 z-50 transition-all duration-300 {show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}" style="min-width: 300px; max-width: 400px;">
    <Alert variant={type === 'error' ? 'destructive' : 'default'} class={getAlertClass(type)}>
      <AlertTitle>{title || getTitle(type)}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  </div>
{/if} 