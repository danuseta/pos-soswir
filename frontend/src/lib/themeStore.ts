import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export const theme = writable<'light' | 'dark'>('light');

export function initializeTheme(): void {
  if (!browser) return;
  
  const storedTheme = localStorage.getItem('pos-theme');
  
  if (storedTheme === 'dark') {
    setTheme('dark');
  } else if (storedTheme === 'light') {
    setTheme('light');
  } else {
    setTheme('light');
  }
}

export function setTheme(newTheme: 'light' | 'dark'): void {
  if (!browser) return;
  
  theme.set(newTheme);
  localStorage.setItem('pos-theme', newTheme);
  
  if (newTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function toggleTheme(): void {
  if (!browser) return;
  
  let currentTheme: 'light' | 'dark';
  theme.subscribe(value => {
    currentTheme = value;
  })();
  
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
}
