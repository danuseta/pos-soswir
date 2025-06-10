<script lang="ts">
  import { onMount } from 'svelte';

  export let src: string;
  export let alt: string;
  export let width: number | undefined = undefined;
  export let height: number | undefined = undefined;
  export let className: string = '';
  export let loading: 'lazy' | 'eager' = 'lazy';
  export let priority: boolean = false;
  export let sizes: string = '';
  export let placeholder: string = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvYWRpbmcuLi48L3RleHQ+PC9zdmc+';

  let imgElement: HTMLDivElement;
  let isLoaded = false;
  let isInView = false;
  let observer: IntersectionObserver;

  $: webpSrc = src?.replace(/\.(png|jpg|jpeg)$/i, '.webp') || src;
  $: avifSrc = src?.replace(/\.(png|jpg|jpeg)$/i, '.avif') || src;

  onMount(() => {
    if (loading === 'lazy' && !priority) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              isInView = true;
              observer.unobserve(entry.target);
            }
          });
        },
        {
          rootMargin: '50px 0px',
          threshold: 0.1
        }
      );

      if (imgElement) {
        observer.observe(imgElement);
      }
    } else {
      isInView = true;
    }

    return () => {
      if (observer && imgElement) {
        observer.unobserve(imgElement);
      }
    };
  });

  function handleLoad() {
    isLoaded = true;
  }

  function handleError() {
    console.warn(`Failed to load image: ${src}`);
  }
</script>

<div class="relative overflow-hidden {className}" bind:this={imgElement}>
  {#if isInView || priority}
    <picture>
      <source srcset={avifSrc} type="image/avif" />
      <source srcset={webpSrc} type="image/webp" />
      
      <img
        {src}
        {alt}
        {width}
        {height}
        {sizes}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        class="transition-opacity duration-300 {isLoaded ? 'opacity-100' : 'opacity-0'}"
        on:load={handleLoad}
        on:error={handleError}
      />
    </picture>
    
    {#if !isLoaded}
      <img
        src={placeholder}
        {alt}
        {width}
        {height}
        class="absolute inset-0 w-full h-full object-cover opacity-50"
        aria-hidden="true"
      />
    {/if}
  {:else}
    <div class="w-full h-full bg-gray-200 animate-pulse" aria-hidden="true"></div>
  {/if}
</div>

<style>
  img {
    max-width: 100%;
    height: auto;
  }
</style> 