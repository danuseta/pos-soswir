/**
 * Utility functions for working with theme CSS variables
 * This helps with Tailwind CSS 4.x compatibility
 */

/**
 * Returns a class string with all theme CSS variable replacements
 * @param classNames String of class names that might contain theme variables
 * @returns String with proper CSS variable usage
 */
export function applyThemeClasses(classNames: string): string {
  return classNames
    .replace(/bg-background/g, 'bg-[hsl(var(--background))]')
    .replace(/bg-card/g, 'bg-[hsl(var(--card))]')
    .replace(/bg-primary/g, 'bg-[hsl(var(--primary))]')
    .replace(/bg-secondary/g, 'bg-[hsl(var(--secondary))]')
    .replace(/bg-muted/g, 'bg-[hsl(var(--muted))]')
    .replace(/bg-accent/g, 'bg-[hsl(var(--accent))]')
    .replace(/bg-destructive/g, 'bg-[hsl(var(--destructive))]')
    .replace(/bg-popover/g, 'bg-[hsl(var(--popover))]')
    
    .replace(/hover:bg-primary\/90/g, 'hover:bg-[hsl(var(--primary)/0.9)]')
    .replace(/hover:bg-destructive\/90/g, 'hover:bg-[hsl(var(--destructive)/0.9)]')
    .replace(/hover:bg-accent/g, 'hover:bg-[hsl(var(--accent))]')
    .replace(/hover:bg-secondary\/80/g, 'hover:bg-[hsl(var(--secondary)/0.8)]')
    
    .replace(/text-foreground/g, 'text-[hsl(var(--foreground))]')
    .replace(/text-primary-foreground/g, 'text-[hsl(var(--primary-foreground))]')
    .replace(/text-secondary-foreground/g, 'text-[hsl(var(--secondary-foreground))]')
    .replace(/text-card-foreground/g, 'text-[hsl(var(--card-foreground))]')
    .replace(/text-muted-foreground/g, 'text-[hsl(var(--muted-foreground))]')
    .replace(/text-accent-foreground/g, 'text-[hsl(var(--accent-foreground))]')
    .replace(/text-destructive-foreground/g, 'text-[hsl(var(--destructive-foreground))]')
    .replace(/text-popover-foreground/g, 'text-[hsl(var(--popover-foreground))]')
    .replace(/text-primary/g, 'text-[hsl(var(--primary))]')
    .replace(/text-destructive/g, 'text-[hsl(var(--destructive))]')
    
    .replace(/hover:text-accent-foreground/g, 'hover:text-[hsl(var(--accent-foreground))]')
    
    .replace(/border-border/g, 'border-[hsl(var(--border)/0.2)]')
    .replace(/border-input/g, 'border-[hsl(var(--input))]')
    .replace(/border-destructive\/50/g, 'border-[hsl(var(--destructive)/0.5)]')
    
    .replace(/ring-offset-background/g, 'ring-offset-[hsl(var(--background))]')
    .replace(/focus-visible:ring-ring/g, 'focus-visible:ring-[hsl(var(--ring))]')
    
    .replace(/placeholder:text-muted-foreground/g, 'placeholder:text-[hsl(var(--muted-foreground))]');
}

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export const theme = writable<'light' | 'dark'>('light');
export const userRole = writable<'superadmin' | 'cashier' | null>(null);

const colorConfigs = {
  superadmin: {
    light: {
      primary: '220 91% 58%',
      primaryForeground: '220 8% 98%',
      success: '142 76% 36%',
      ring: '220 91% 58%'
    },
    dark: {
      primary: '220 91% 58%',
      primaryForeground: '220 8% 98%', 
      success: '142 76% 36%',
      ring: '220 91% 58%'
    }
  },
  cashier: {
    light: {
      primary: '142 76% 36%',
      primaryForeground: '142 8% 98%',
      success: '142 76% 36%',
      ring: '142 76% 36%'
    },
    dark: {
      primary: '142 76% 36%',
      primaryForeground: '142 8% 98%',
      success: '142 76% 36%',
      ring: '142 76% 36%'
    }
  }
};

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

export function initializeUserRole(): void {
  if (!browser) return;
  
  const role = localStorage.getItem("pos_user_role") as 'superadmin' | 'cashier' | null;
  if (role) {
    setUserRole(role);
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
  
  updateRoleColors();
}

export function setUserRole(role: 'superadmin' | 'cashier'): void {
  if (!browser) return;
  
  userRole.set(role);
  updateRoleColors();
}

function updateRoleColors(): void {
  if (!browser) return;
  
  let currentTheme: 'light' | 'dark' = 'light';
  let currentRole: 'superadmin' | 'cashier' | null = null;
  
  theme.subscribe(value => currentTheme = value)();
  userRole.subscribe(value => currentRole = value)();
  
  if (!currentRole) return;
  
  const colors = colorConfigs[currentRole][currentTheme];
  const root = document.documentElement;
  
  root.style.setProperty('--primary', colors.primary);
  root.style.setProperty('--primary-foreground', colors.primaryForeground);
  root.style.setProperty('--success', colors.success);
  root.style.setProperty('--ring', colors.ring);
}

export function toggleTheme(): void {
  if (!browser) return;
  
  let currentTheme: 'light' | 'dark';
  theme.subscribe(value => {
    currentTheme = value;
  })();
  
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
}
