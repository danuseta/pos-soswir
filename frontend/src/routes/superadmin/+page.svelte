<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  
  onMount(() => {
    goto("/superadmin/dashboard");
  });
</script>

<div class="flex items-center justify-center h-screen">
  <p>Redirecting to dashboard...</p>
</div>
