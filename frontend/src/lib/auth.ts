import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { BACKEND_URL, getAuthHeaders } from './apiConfig';

export const isAuthenticated = writable<boolean>(false);
export const userRole = writable<string | null>(null);
export const userId = writable<string | null>(null);

export function initializeAuth() {
  if (!browser) return;
  
  const token = localStorage.getItem('pos_token');
  const role = localStorage.getItem('pos_user_role');
  const id = localStorage.getItem('pos_user_id');
  
  isAuthenticated.set(!!token);
  userRole.set(role);
  userId.set(id);
}

export function isLoggedIn(): boolean {
  if (!browser) return false;
  
  return get(isAuthenticated);
}

export function getUserRole(): string | null {
  if (!browser) return null;
  
  return get(userRole);
}

export function checkAccess(allowedRoles: string[]): boolean {
  const role = getUserRole();
  return role !== null && allowedRoles.includes(role);
}

export async function login(username: string, password: string): Promise<{ success: boolean; message: string }> {
  const { loadingManager } = await import('./loadingStore');
  const { handleApiError } = await import('./errorHandler');
  
  return loadingManager.withLoading('login', async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        const error = handleApiError({ status: response.status, message: data.message });
        return { success: false, message: error.message };
      }
      
      localStorage.setItem('pos_token', data.token);
      localStorage.setItem('pos_user_role', data.user.role);
      localStorage.setItem('pos_user_id', data.user.id);
      localStorage.setItem('pos_username', data.user.username);
      
      isAuthenticated.set(true);
      userRole.set(data.user.role);
      userId.set(data.user.id);
      
      return { success: true, message: "Login berhasil" };
    } catch (error) {
      console.error('Login error:', error);
      const apiError = handleApiError(error);
      return { success: false, message: apiError.message };
    }
  }, { minDuration: 500 });
}

export async function logout() {
  try {
    await fetch(`${BACKEND_URL}/api/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
  } catch (error) {
    console.error('Error during logout API call:', error);
  }

  localStorage.removeItem('pos_token');
  localStorage.removeItem('pos_user_role');
  localStorage.removeItem('pos_user_id');
  localStorage.removeItem('pos_username');
  
  isAuthenticated.set(false);
  userRole.set(null);
  userId.set(null);
  
  goto('/login');
}

export function getAuthToken(): string | null {
  if (!browser) return null;
  return localStorage.getItem('pos_token');
}

