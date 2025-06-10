<script lang="ts">
  import { getContext, setContext } from "svelte";

  export let config = {};

  setContext("chart", { config });
</script>

<div class="chart-container">
  <slot />
</div>

<style>
  .chart-container {
    width: 100%;
    height: 100%;
  }
</style>
