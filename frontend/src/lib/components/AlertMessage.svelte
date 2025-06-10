<script lang="ts">
  import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
  import { alertStore, hideAlert } from "$lib/stores/alertStore";
  
  export let duration = 3000;

  $: if ($alertStore.show && duration > 0) {
    setTimeout(() => {
      hideAlert();
    }, duration);
  }

  function getTitle(type: string) {
    switch (type) {
      case 'success': return 'Berhasil!';
      case 'error': return 'Error!';
      case 'info': return 'Info';
      default: return 'Info';
    }
  }

  function getClasses(type: string) {
    switch (type) {
      case 'success':
        return 'border-l-success bg-success/10';
      case 'error':
        return 'border-l-destructive bg-destructive/10';
      case 'info':
        return 'border-l-primary bg-primary/10';
      default:
        return 'border-l-primary bg-primary/10';
    }
  }
</script>

{#if $alertStore.show}
  <div 
    class="fixed top-4 right-4 z-50 transition-all duration-300 {$alertStore.show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}" 
    style="min-width: 300px; max-width: 400px;"
  >
    <Alert 
      variant={$alertStore.type === 'error' ? 'destructive' : 'default'} 
      class="border-l-4 {getClasses($alertStore.type)}"
    >
      <AlertTitle>{getTitle($alertStore.type)}</AlertTitle>
      <AlertDescription>{$alertStore.message}</AlertDescription>
    </Alert>
  </div>
{/if} 