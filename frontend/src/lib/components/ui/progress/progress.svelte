<script lang="ts">
  export let value: number = 0;
  export let className: string = "";
  
  $: percentage = Math.min(Math.max(value, 0), 100);
</script>

<div class="w-full bg-secondary rounded-full h-2.5 {className}">
  <div 
    class="bg-primary h-2.5 rounded-full transition-all duration-300"
    style="width: {percentage}%"
  ></div>
</div> 