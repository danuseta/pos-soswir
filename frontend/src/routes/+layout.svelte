<script lang="ts">
	import '../app.css';
	import { onMount } from "svelte";
	import { initializeAuth } from "$lib/auth";
	import { initializeTheme, theme } from "$lib/themeStore";
	import UnauthorizedModal from "$lib/components/UnauthorizedModal.svelte";
	
	if (typeof window !== 'undefined') {
		initializeTheme();
	}
	
	onMount(() => {
		initializeAuth();
	});
</script>

<svelte:head>
	<title>Soswir POS - Point of Sale</title>
	<meta name="description" content="Sistem Point of Sale untuk Departemen Sosial dan Kewirausahaan" />
</svelte:head>

<div class="min-h-screen bg-background text-foreground">
  <slot />
  
  <UnauthorizedModal />
</div>
