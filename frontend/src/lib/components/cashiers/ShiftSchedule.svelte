<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent } from "$lib/components/ui/card";
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "$lib/components/ui/dialog";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
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

  type Cashier = { id: number; username: string };

  let shifts: Shift[] = [];
  let isLoading = true;

  let cashiers: Cashier[] = [];
  let showDialog = false;
  let isSaving = false;
  let editingShift: Shift | null = null;

  let formDay = 1;
  let formLabel = "";
  let formStart = "08:00";
  let formEnd = "10:00";
  let formUserIds: number[] = [];

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

  async function loadCashiers() {
    const result = await api.get<Cashier[]>("/api/users/cashiers");
    if (!result.success) {
      showAlertMessage("error", result.error?.message || "Gagal memuat daftar kasir");
      return;
    }
    cashiers = result.data || [];
  }

  function bukaTambah(dayValue: number) {
    editingShift = null;
    formDay = dayValue;
    formLabel = "";
    formStart = "08:00";
    formEnd = "10:00";
    formUserIds = [];
    showDialog = true;
  }

  function bukaEdit(shift: Shift) {
    editingShift = shift;
    formDay = shift.day_of_week;
    formLabel = shift.label;
    formStart = jam(shift.start_time);
    formEnd = jam(shift.end_time);
    formUserIds = shift.cashiers.map((c) => c.id);
    showDialog = true;
  }

  function toggleKasir(id: number) {
    formUserIds = formUserIds.includes(id)
      ? formUserIds.filter((existing) => existing !== id)
      : [...formUserIds, id];
  }

  async function simpanShift() {
    isSaving = true;

    const payload = {
      day_of_week: formDay,
      start_time: `${formStart}:00`,
      end_time: `${formEnd}:00`,
      label: formLabel,
      user_ids: formUserIds
    };

    const result = editingShift
      ? await api.put(`/api/shifts/${editingShift.id}`, payload)
      : await api.post("/api/shifts", payload);

    isSaving = false;

    if (!result.success) {
      showAlertMessage("error", result.error?.message || "Gagal menyimpan sesi");
      return;
    }

    showAlertMessage("success", editingShift ? "Sesi berhasil diperbarui." : "Sesi baru berhasil ditambahkan.");
    showDialog = false;
    await loadShifts();
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

  onMount(async () => {
    await Promise.all([loadShifts(), loadCashiers()]);
  });
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
                    <Button variant="outline" size="sm" on:click={() => bukaEdit(shift)}>
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" on:click={() => hapusShift(shift)}>
                      Hapus
                    </Button>
                  </div>
                {/each}
              </div>
            {/if}

            <Button variant="outline" size="sm" class="mt-2" on:click={() => bukaTambah(day.value)}>
              + Tambah Sesi
            </Button>
          </div>
        {/each}
      </div>
    {/if}
  </CardContent>
</Card>

<Dialog open={showDialog} onOpenChange={(open) => { if (!open) showDialog = false; }}>
  <DialogContent class="sm:max-w-[480px]">
    <DialogHeader>
      <DialogTitle>{editingShift ? "Edit Sesi" : "Tambah Sesi"}</DialogTitle>
      <DialogDescription>
        Kasir yang dipilih hanya bisa login selama jam sesi ini, dengan toleransi 15 menit.
      </DialogDescription>
    </DialogHeader>

    <div class="space-y-4 py-2">
      <div class="space-y-2">
        <Label for="shift-day">Hari</Label>
        <select
          id="shift-day"
          bind:value={formDay}
          class="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {#each DAYS as day}
            <option value={day.value}>{day.label}</option>
          {/each}
        </select>
      </div>

      <div class="space-y-2">
        <Label for="shift-label">Label sesi</Label>
        <Input id="shift-label" bind:value={formLabel} placeholder="Sesi 1" />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-2">
          <Label for="shift-start">Jam mulai</Label>
          <Input id="shift-start" type="time" bind:value={formStart} />
        </div>
        <div class="space-y-2">
          <Label for="shift-end">Jam selesai</Label>
          <Input id="shift-end" type="time" bind:value={formEnd} />
        </div>
      </div>

      <div class="space-y-2">
        <Label>Kasir yang jaga</Label>
        {#if cashiers.length === 0}
          <p class="text-sm text-muted-foreground">Belum ada kasir terdaftar.</p>
        {:else}
          <div class="max-h-40 overflow-y-auto rounded-md border border-border p-2 space-y-1">
            {#each cashiers as cashier}
              <label class="flex items-center gap-2 text-sm py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formUserIds.includes(cashier.id)}
                  on:change={() => toggleKasir(cashier.id)}
                />
                {cashier.username}
              </label>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <DialogFooter>
      <Button variant="outline" on:click={() => (showDialog = false)} disabled={isSaving}>
        Batal
      </Button>
      <Button on:click={simpanShift} disabled={isSaving}>
        {isSaving ? "Menyimpan..." : "Simpan"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
