<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";

  export let item;
  export const index = 0;
  export const currentPage = 1;
  export const itemsPerPage = 10;
</script>

<div class="text-center">
  <Badge variant={item.is_reseller ? "secondary" : "default"} class="text-xs">
    {item.is_reseller ? 'PUBJ' : 'Toko'}
  </Badge>
</div> 