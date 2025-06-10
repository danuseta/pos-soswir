<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";
  import IconWrapper from "$lib/components/IconWrapper.svelte";
  import { Store, Users } from "lucide-svelte";

  export let item;
  export const index = 0;
  export const currentPage = 1;
  export const itemsPerPage = 10;
</script>

<div class="flex items-center gap-2">
  <IconWrapper icon={item.is_reseller ? Users : Store} className="h-5 w-5 {item.is_reseller ? 'text-accent-foreground' : 'text-primary'}" />
  <span class="font-medium truncate">{item.name}</span>
</div> 