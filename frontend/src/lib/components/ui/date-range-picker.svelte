<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  
  const dispatch = createEventDispatcher();
  
  let fromDate: string = '';
  let toDate: string = '';
  
  function formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  function handleChange() {
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;
    
    dispatch('datechange', { from, to });
  }
  
  function setLastWeek() {
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);
    
    fromDate = formatDateForInput(lastWeek);
    toDate = formatDateForInput(today);
    handleChange();
  }
  
  function setLastMonth() {
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(today.getMonth() - 1);
    
    fromDate = formatDateForInput(lastMonth);
    toDate = formatDateForInput(today);
    handleChange();
  }
  
  function resetDates() {
    fromDate = '';
    toDate = '';
    handleChange();
  }
</script>

<div class="flex items-center gap-2 flex-wrap">
  <div class="flex items-center gap-2">
    <input
      type="date"
      bind:value={fromDate}
      on:change={handleChange}
      class="px-3 py-2 rounded border-input bg-background text-foreground text-sm focus:ring-2 focus:ring-ring focus:border-ring"
      placeholder="Dari"
    />
    <span class="text-sm text-foreground">s/d</span>
    <input
      type="date"
      bind:value={toDate}
      on:change={handleChange}
      class="px-3 py-2 rounded border-input bg-background text-foreground text-sm focus:ring-2 focus:ring-ring focus:border-ring"
      placeholder="Sampai"
    />
  </div>
  <div class="flex gap-1">
    <Button variant="outline" size="sm" on:click={setLastWeek}>7 Hari</Button>
    <Button variant="outline" size="sm" on:click={setLastMonth}>30 Hari</Button>
    <Button variant="outline" size="sm" on:click={resetDates}>Reset</Button>
  </div>
</div>
