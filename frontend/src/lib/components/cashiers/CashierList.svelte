<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { onMount, onDestroy } from "svelte";
  import { api, apiData } from "$lib/apiConfig";
  import { browser } from '$app/environment';
  import AlertMessage from "$lib/components/AlertMessage.svelte";
  import { useAlert } from "$lib/composables/useAlert";
  import CashierActivityDialog from './CashierActivityDialog.svelte';
  import CashierFormDialog from './CashierFormDialog.svelte';
  import ShiftDialog from './ShiftDialog.svelte';
  import CashierTable from './CashierTable.svelte';
  import CashierControls from './CashierControls.svelte';
  import {
    filterCashiers,
    formatCashierDate,
    formatCashierDateOnly,
    formatCashierTime,
    formatShiftTime,
    groupCashiers,
    isCashierOnline,
    validateCashier
  } from '$lib/utils/cashier';

  let searchTerm = "";
  let cashiers = [];
  let isLoading = true;
  let error = null;

  let statusInterval;

  let sortField = 'username';
  let sortDirection = 'asc';

  const { showAlertMessage } = useAlert();

  let showAddEditDialog = false;
  let editingCashier = null;
  let currentCashier = {
    id: null,
    username: "",
    password: "",
    confirmPassword: ""
  };
  let showActivityModal = false;
  let selectedCashierActivities = [];
  let selectedCashierName = '';
  let loadingActivities = false;

  let shifts = [];
  let showShiftDialog = false;
  let editingShift = null;
  let shiftForm = { label: "", start_time: "08:00", end_time: "10:00" };
  let isSavingShift = false;

  async function loadShifts() {
    try {
      shifts = await apiData(api.get('/api/shifts'));
    } catch (err) {
      showAlertMessage('error', 'Gagal memuat daftar sesi');
      console.error('Error loading shifts:', err);
    }
  }

  async function loadCashiers() {
    cashiers = await apiData(api.get('/api/users/cashiers'));
  }

  async function pindahSesi(cashier, shiftId) {
    const tujuan = shiftId === "" ? null : Number(shiftId);
    try {
      await apiData(api.put(`/api/shifts/assign/${cashier.id}`, { shift_id: tujuan }));
    } catch (err) {
      showAlertMessage('error', err.message || 'Gagal memindahkan kasir');
      return;
    }

    cashiers = cashiers.map((c) => (c.id === cashier.id ? { ...c, shift_id: tujuan } : c));
    const namaSesi = shifts.find((sh) => sh.id === tujuan);
    showAlertMessage('success', namaSesi ? `${cashier.username} dipindah ke ${namaSesi.label}.` : `${cashier.username} dikeluarkan dari sesi.`);
  }

  function bukaTambahSesi() {
    editingShift = null;
    shiftForm = { label: "", start_time: "08:00", end_time: "10:00" };
    showShiftDialog = true;
  }

  function bukaEditSesi(shift) {
    editingShift = shift;
    shiftForm = { label: shift.label, start_time: formatShiftTime(shift.start_time), end_time: formatShiftTime(shift.end_time) };
    showShiftDialog = true;
  }

  async function simpanSesi() {
    isSavingShift = true;
    const payload = {
      label: shiftForm.label,
      start_time: `${shiftForm.start_time}:00`,
      end_time: `${shiftForm.end_time}:00`
    };

    try {
      if (editingShift) {
        await apiData(api.put(`/api/shifts/${editingShift.id}`, payload));
      } else {
        await apiData(api.post('/api/shifts', payload));
      }
    } catch (err) {
      showAlertMessage('error', err.message || 'Gagal menyimpan sesi');
      return;
    } finally {
      isSavingShift = false;
    }

    showAlertMessage('success', editingShift ? 'Sesi berhasil diperbarui.' : 'Sesi baru berhasil ditambahkan.');
    showShiftDialog = false;
    await loadShifts();
  }

  async function hapusSesi(shift) {
    if (!confirm(`Hapus ${shift.label} (${formatShiftTime(shift.start_time)}-${formatShiftTime(shift.end_time)})? Kasir di sesi ini jadi tanpa jadwal dan tidak bisa login.`)) {
      return;
    }

    try {
      await apiData(api.delete(`/api/shifts/${shift.id}`));
    } catch (err) {
      showAlertMessage('error', err.message || 'Gagal menghapus sesi');
      return;
    }

    showAlertMessage('success', 'Sesi dihapus.');
    cashiers = cashiers.map((c) => (c.shift_id === shift.id ? { ...c, shift_id: null } : c));
    await loadShifts();
  }



  onMount(async () => {
    try {
      if (!browser) {
        isLoading = false;
        return;
      }
      
      
      await loadShifts();

      await loadCashiers();
    } catch (err) {
      console.error("Error loading cashiers:", err);
      error = err.message;
      showAlertMessage('error', `Gagal memuat data: ${err.message}`);
    } finally {
      isLoading = false;
    }

    statusInterval = setInterval(async () => {
      try {
        await loadCashiers();
      } catch (err) {
        console.error("Error refreshing cashier status:", err);
      }
    }, 30000);
  });

  onDestroy(() => {
    if (statusInterval) {
      clearInterval(statusInterval);
    }
  });

  function openAddDialog() {
    editingCashier = null;
    currentCashier = { id: null, username: "", password: "", confirmPassword: "" };
    showAddEditDialog = true;
  }

  function openEditDialog(cashier) {
    editingCashier = cashier;
    currentCashier = { ...cashier, password: "", confirmPassword: "" };
    showAddEditDialog = true;
  }

  async function openActivityModal(cashier) {
    selectedCashierName = cashier.username;
    showActivityModal = true;
    loadingActivities = true;
    
    try {
      selectedCashierActivities = await apiData(api.get(`/api/users/cashiers/${cashier.id}/activities`));
    } catch (err) {
      console.error("Error loading activities:", err);
      showAlertMessage('error', 'Gagal memuat aktivitas kasir');
      selectedCashierActivities = [];
    } finally {
      loadingActivities = false;
    }
  }

  async function handleSaveCashier() {
    try {
      const validationError = validateCashier(currentCashier, Boolean(editingCashier));
      if (validationError) return showAlertMessage('error', validationError);

      showAlertMessage('info', editingCashier ? "Memperbarui kasir..." : "Menambah kasir baru...");

      const cashierData: any = {
        username: currentCashier.username
      };

      if (currentCashier.password) {
        cashierData.password = currentCashier.password;
      }
      
      if (editingCashier) {
        await apiData(api.put(`/api/users/cashiers/${editingCashier.id}`, cashierData));
      } else {
        await apiData(api.post('/api/users/cashiers', cashierData));
      }

      await loadCashiers();
      showAddEditDialog = false;
      showAlertMessage('success', editingCashier ? "Kasir berhasil diperbarui." : "Kasir baru berhasil ditambahkan.");
    } catch (err) {
      console.error("Error saving cashier:", err);
      showAlertMessage('error', `Error: ${err.message}`);
    }
  }

  async function handleDeleteCashier(cashierId) {
    if (!confirm("Apakah Anda yakin ingin menghapus kasir ini?")) {
      return;
    }

    try {
      showAlertMessage('info', "Menghapus kasir...");
      
      await apiData(api.delete(`/api/users/cashiers/${cashierId}`));
      cashiers = cashiers.filter(c => c.id !== cashierId);
      showAlertMessage('success', "Kasir berhasil dihapus.");
    } catch (err) {
      console.error("Error deleting cashier:", err);
      showAlertMessage('error', `Error: ${err.message}`);
    }
  }

  $: filteredCashiers = filterCashiers(cashiers, searchTerm, sortField, sortDirection);
  $: grup = groupCashiers(filteredCashiers, shifts);


  function toggleSort(field: string) {
    if (sortField === field) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDirection = 'asc';
    }
  }

  function clearFilters() {
    searchTerm = '';
    sortField = 'username';
    sortDirection = 'asc';
  }
</script>

<div class="space-y-4 max-w-full overflow-hidden">
  <CashierControls bind:searchTerm bind:sortField {sortDirection} filteredCount={filteredCashiers.length} totalCount={cashiers.length} onAddCashier={openAddDialog} onAddShift={bukaTambahSesi} onClear={clearFilters} onSort={toggleSort} />

  <AlertMessage />

  {#if isLoading}
    <div class="bg-card p-8 rounded-lg shadow flex justify-center">
      <div class="text-center">
        <div class="inline-block animate-spin h-8 w-8 border-4 border-t-primary border-r-transparent border-b-primary border-l-transparent rounded-full mb-4"></div>
        <p>Memuat data kasir...</p>
      </div>
    </div>
  {:else if error}
    <div class="bg-card p-8 rounded-lg shadow">
      <div class="text-center text-destructive">
        <p class="mb-2 font-semibold">Error:</p>
        <p>{error}</p>
        <Button class="mt-4" on:click={() => { if (typeof window !== 'undefined') window.location.reload(); }}>Muat Ulang</Button>
      </div>
    </div>
  {:else}
    <CashierTable groups={grup} {shifts} filteredCount={filteredCashiers.length} allCashiersCount={cashiers.length} {sortField} {sortDirection} formatDate={formatCashierDate} formatDateOnly={formatCashierDateOnly} formatTime={formatCashierTime} {formatShiftTime} isOnline={isCashierOnline} onSort={toggleSort} onMoveShift={pindahSesi} onEditShift={bukaEditSesi} onDeleteShift={hapusSesi} onActivity={openActivityModal} onEdit={openEditDialog} onDelete={handleDeleteCashier} />
  {/if}
</div>

<CashierFormDialog open={showAddEditDialog} cashier={currentCashier} isEditing={Boolean(editingCashier)} onClose={() => showAddEditDialog = false} onSave={handleSaveCashier} />

<CashierActivityDialog open={showActivityModal} cashierName={selectedCashierName} activities={selectedCashierActivities} isLoading={loadingActivities} formatDate={formatCashierDate} onClose={() => showActivityModal = false} />

<ShiftDialog open={showShiftDialog} shift={shiftForm} isEditing={Boolean(editingShift)} isSaving={isSavingShift} onClose={() => showShiftDialog = false} onSave={simpanSesi} />
