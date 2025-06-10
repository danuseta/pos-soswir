<script lang="ts">
  export let size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  export let variant: 'spinner' | 'dots' | 'pulse' | 'bars' = 'spinner';
  export let color: 'primary' | 'secondary' | 'white' | 'gray' = 'primary';
  export let text: string = '';
  export let overlay: boolean = false;
  export let fullscreen: boolean = false;

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6', 
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  const colorClasses = {
    primary: 'text-primary border-primary',
    secondary: 'text-secondary border-secondary', 
    white: 'text-white border-white',
    gray: 'text-gray-500 border-gray-500'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base', 
    xl: 'text-lg'
  };
</script>

{#if fullscreen}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl">
      <div class="flex flex-col items-center space-y-4">
        <svelte:self {size} {variant} {color} />
        {#if text}
          <p class="text-gray-700 dark:text-gray-300 {textSizeClasses[size]} font-medium">
            {text}
          </p>
        {/if}
      </div>
    </div>
  </div>
{:else if overlay}
  <div class="absolute inset-0 z-10 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
    <div class="flex flex-col items-center space-y-2">
      <svelte:self {size} {variant} {color} />
      {#if text}
        <p class="text-gray-700 dark:text-gray-300 {textSizeClasses[size]} font-medium">
          {text}
        </p>
      {/if}
    </div>
  </div>
{:else}
  <div class="flex items-center justify-center space-x-2">
    {#if variant === 'spinner'}
      <div class="{sizeClasses[size]} {colorClasses[color]} border-2 border-t-transparent rounded-full animate-spin"></div>
    {:else if variant === 'dots'}
      <div class="flex space-x-1">
        <div class="w-2 h-2 {colorClasses[color]} bg-current rounded-full animate-bounce" style="animation-delay: 0ms"></div>
        <div class="w-2 h-2 {colorClasses[color]} bg-current rounded-full animate-bounce" style="animation-delay: 150ms"></div>
        <div class="w-2 h-2 {colorClasses[color]} bg-current rounded-full animate-bounce" style="animation-delay: 300ms"></div>
      </div>
    {:else if variant === 'pulse'}
      <div class="{sizeClasses[size]} {colorClasses[color]} bg-current rounded-full animate-pulse"></div>
    {:else if variant === 'bars'}
      <div class="flex space-x-1 items-end">
        <div class="w-1 bg-current {colorClasses[color]} animate-pulse" style="height: {size === 'sm' ? '12px' : size === 'md' ? '16px' : size === 'lg' ? '20px' : '24px'}; animation-delay: 0ms"></div>
        <div class="w-1 bg-current {colorClasses[color]} animate-pulse" style="height: {size === 'sm' ? '8px' : size === 'md' ? '12px' : size === 'lg' ? '16px' : '20px'}; animation-delay: 150ms"></div>
        <div class="w-1 bg-current {colorClasses[color]} animate-pulse" style="height: {size === 'sm' ? '16px' : size === 'md' ? '20px' : size === 'lg' ? '24px' : '28px'}; animation-delay: 300ms"></div>
        <div class="w-1 bg-current {colorClasses[color]} animate-pulse" style="height: {size === 'sm' ? '12px' : size === 'md' ? '16px' : size === 'lg' ? '20px' : '24px'}; animation-delay: 450ms"></div>
      </div>
    {/if}
    
    {#if text && !overlay && !fullscreen}
      <span class="text-gray-700 dark:text-gray-300 {textSizeClasses[size]} font-medium">
        {text}
      </span>
    {/if}
  </div>
{/if}

<style>
  @keyframes bounce {
    0%, 80%, 100% {
      transform: scale(0);
    }
    40% {
      transform: scale(1);
    }
  }
  
  .animate-bounce {
    animation: bounce 1.4s infinite ease-in-out both;
  }
</style> 