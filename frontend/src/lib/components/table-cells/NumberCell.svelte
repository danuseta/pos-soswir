<script lang="ts">
  export const item = null;
  export let index;
  export let currentPage;
  export let itemsPerPage;
</script>

<span class="font-medium">{(currentPage - 1) * itemsPerPage + index + 1}</span> 