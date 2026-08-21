<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent } from "$lib/components/ui/card";
  import { useAlert } from "$lib/composables/useAlert";
  import { api } from "$lib/apiConfig";

  const { showAlertMessage } = useAlert();

  const DAYS = [
    { value: 1, label: "Senin" },
    { value: 2, label: "Selasa" },
    { value: 3, label: "Rabu" },
    { value: 4, label: "Kamis" },
    { value: 5, label: "Jumat" },
    { value: 6, label: "Sabtu" },
    { value: 7, label: "Minggu" }
  ];

  type Shift = {
    id: number;
    day_of_week: number;
    start_time: string;
    end_time: string;
    label: string;
    cashiers: { id: number; username: string }[];
  };

  let shifts: Shift[] = [];
  let isLoading = true;

  $: byDay = DAYS.map((day) => ({
    ...day,
    shifts: shifts.filter((shift) => shift.day_of_week === day.value)
  }));

  function jam(value: string) {
    return String(value).slice(0, 5);
  }

  async function loadShifts() {
    isLoading = true;
    const result = await api.get<Shift[]>("/api/shifts");
    isLoading = false;

    if (!result.success) {
      showAlertMessage("error", result.error?.message || "Gagal memuat jadwal");
      return;
    }
    shifts = result.data || [];
  }

  async function hapusShift(shift: Shift) {
    if (!confirm(`Hapus ${shift.label} ${DAYS[shift.day_of_week - 1].label} ${jam(shift.start_time)}-${jam(shift.end_time)}?`)) {
      return;
    }

    const result = await api.delete(`/api/shifts/${shift.id}`);
    if (!result.success) {
      showAlertMessage("error", result.error?.message || "Gagal menghapus sesi");
      return;
    }
    showAlertMessage("success", "Sesi berhasil dihapus.");
    await loadShifts();
  }

  onMount(loadShifts);
</script>

<Card>
  <CardContent class="pt-6">
    {#if isLoading}
      <p class="text-muted-foreground py-8 text-center">Memuat jadwal shift...</p>
    {:else}
      <div class="space-y-6">
        {#each byDay as day}
          <div>
            <h3 class="text-sm font-semibold text-foreground mb-2">{day.label}</h3>

            {#if day.shifts.length === 0}
              <p class="text-sm text-muted-foreground pl-1">Belum ada sesi.</p>
            {:else}
              <div class="space-y-2">
                {#each day.shifts as shift}
                  <div class="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                    <span class="font-medium text-sm w-20">{shift.label}</span>
                    <span class="text-sm text-muted-foreground w-28">
                      {jam(shift.start_time)} - {jam(shift.end_time)}
                    </span>
                    <span class="text-sm flex-1 min-w-[8rem]">
                      {shift.cashiers.map((c) => c.username).join(", ")}
                    </span>
                    <Button variant="outline" size="sm" on:click={() => hapusShift(shift)}>
                      Hapus
                    </Button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </CardContent>
</Card>
