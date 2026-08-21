<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
  import CashierList from "$lib/components/cashiers/CashierList.svelte";
  import ShiftSchedule from "$lib/components/cashiers/ShiftSchedule.svelte";

  let allowed = false;

  onMount(() => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_token") : null;
    const role = typeof localStorage !== 'undefined' ? localStorage.getItem("pos_user_role") : null;

    if (!token || role !== 'superadmin') {
      goto("/login");
      return;
    }
    allowed = true;
  });
</script>

<svelte:head>
  <title>Manajemen Kasir - Superadmin</title>
</svelte:head>

{#if allowed}
  <div class="p-4 sm:p-6 space-y-6">
    <h2 class="text-2xl md:text-3xl font-bold tracking-tight">Manajemen Kasir</h2>

    <Tabs value="daftar">
      <TabsList>
        <TabsTrigger value="daftar">Daftar Kasir</TabsTrigger>
        <TabsTrigger value="jadwal">Jadwal Shift</TabsTrigger>
      </TabsList>

      <TabsContent value="daftar">
        <CashierList />
      </TabsContent>

      <TabsContent value="jadwal">
        <ShiftSchedule />
      </TabsContent>
    </Tabs>
  </div>
{/if}
