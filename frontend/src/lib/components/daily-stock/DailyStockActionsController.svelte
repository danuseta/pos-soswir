<script lang="ts">
  import DailyStockDialogs from './DailyStockDialogs.svelte';
  import { completeDailyStock, completeDailyStockDay, markDailyStockPaid, saveDailyStock } from '$lib/services/dailyStockService';
  import { createDailyStockEntry, formatDailyStockDate, getGlobalCompletionData, getTodayWIB } from '$lib/utils/dailyStock';
  import { useAlert } from '$lib/composables/useAlert';

  export let entries: any[] = [];
  export let products: any[] = [];
  export let suppliers: any[] = [];
  export let selectedDate = '';
  export let onRefresh: () => Promise<void>;

  const { showAlertMessage } = useAlert();
  let showEntry = false;
  let editingEntry: any = null;
  let entry = createDailyStockEntry();
  let showCompletion = false;
  let completionEntry: any = null;
  let showGlobalCompletion = false;
  let isGlobalCompleting = false;
  let globalCompletion = { totalEntries: 0, totalProducts: 0, totalStock: 0 };
  let showPaid = false;
  let paidEntry: any = null;

  $: availableProducts = entry.supplier_id
    ? products.filter((product) => product.supplier_id === parseInt(entry.supplier_id))
    : products;

  export function openAdd() {
    editingEntry = null;
    entry = createDailyStockEntry(selectedDate);
    showEntry = true;
  }

  export function openEdit(selected: any) {
    editingEntry = selected;
    entry = {
      id: selected.id,
      product_id: selected.product_id,
      supplier_id: selected.supplier_id,
      entry_date: selected.entry_date,
      quantity_in: selected.quantity_in,
      notes: selected.notes || ''
    };
    showEntry = true;
  }

  export function openComplete(selected: any) {
    completionEntry = selected;
    showCompletion = true;
  }

  export function openMarkPaid(selected: any) {
    paidEntry = selected;
    showPaid = true;
  }

  export function openCompleteDay() {
    const { activeToday, summary } = getGlobalCompletionData(entries);
    if (!activeToday.length) {
      showAlertMessage('info', 'Tidak ada entry aktif untuk hari ini yang perlu diselesaikan');
      return;
    }
    globalCompletion = summary;
    showGlobalCompletion = true;
  }

  async function handleSave() {
    if (!entry.product_id || !entry.supplier_id || !entry.quantity_in) {
      showAlertMessage('error', 'Semua field wajib harus diisi');
      return;
    }
    if (entry.quantity_in <= 0) {
      showAlertMessage('error', 'Jumlah stok harus lebih dari 0');
      return;
    }
    try {
      showAlertMessage('info', editingEntry ? 'Memperbarui entry...' : 'Menambah entry baru...');
      await saveDailyStock({
        product_id: entry.product_id,
        supplier_id: entry.supplier_id,
        entry_date: entry.entry_date,
        quantity_in: parseInt(String(entry.quantity_in)),
        notes: entry.notes || null
      }, editingEntry?.id);
      await onRefresh();
      showEntry = false;
      showAlertMessage('success', editingEntry ? 'Entry berhasil diperbarui.' : 'Entry baru berhasil ditambahkan.');
    } catch (error) {
      showAlertMessage('error', `Error: ${error.message}`);
    }
  }

  async function handleMarkPaid() {
    if (!paidEntry) return;
    try {
      await markDailyStockPaid(paidEntry.id);
      showPaid = false;
      paidEntry = null;
      await onRefresh();
      showAlertMessage('success', 'Entry ditandai sudah dibayar.');
    } catch (error) {
      showAlertMessage('error', `Error: ${error.message}`);
    }
  }

  async function handleComplete() {
    if (!completionEntry) return;
    try {
      showAlertMessage('info', 'Menyelesaikan stok harian...');
      const result = await completeDailyStock(completionEntry.id);
      showCompletion = false;
      showAlertMessage('success', `Stok harian "${completionEntry.product_name}" berhasil diselesaikan. Sisa ${result.quantity_returned} unit dikembalikan ke supplier.`);
      await onRefresh();
      completionEntry = null;
    } catch (error) {
      showAlertMessage('error', `Error: ${error.message}`);
    }
  }

  async function handleCompleteDay() {
    isGlobalCompleting = true;
    try {
      showAlertMessage('info', 'Menyelesaikan semua stok harian aktif...');
      const result = await completeDailyStockDay(getTodayWIB());
      showGlobalCompletion = false;
      showAlertMessage('success', `${result.completed_count} entry berhasil diselesaikan untuk hari ini`);
      await onRefresh();
    } catch (error) {
      showAlertMessage('error', `Error: ${error.message}`);
    } finally {
      isGlobalCompleting = false;
    }
  }
</script>

<DailyStockDialogs
  {showEntry} {editingEntry} {entry} {suppliers} products={availableProducts}
  {showCompletion} {completionEntry}
  {showGlobalCompletion} {globalCompletion} {isGlobalCompleting}
  {showPaid} paidEntry={paidEntry} formatDate={formatDailyStockDate}
  onCloseEntry={() => showEntry = false} onSaveEntry={handleSave}
  onCloseCompletion={() => showCompletion = false} onComplete={handleComplete}
  onCloseGlobal={() => showGlobalCompletion = false} onCompleteGlobal={handleCompleteDay}
  onClosePaid={() => showPaid = false} onMarkPaid={handleMarkPaid}
/>
