import { writable } from 'svelte/store';
import { goto } from '$app/navigation';
import { browser } from '$app/environment';

interface AuthModalState {
  isOpen: boolean;
  message: string;
  title: string;
}

export const authModal = writable<AuthModalState>({
  isOpen: false,
  message: '',
  title: ''
});

export function showUnauthorizedModal(customMessage?: string) {
  if (!browser) return;
  
  authModal.set({
    isOpen: true,
    title: 'Sesi Berakhir',
    message: customMessage || 'Silahkan Login Kembali'
  });
}

export function closeModalAndRedirect() {
  if (!browser) return;
  
  localStorage.removeItem('pos_token');
  localStorage.removeItem('pos_user_role');
  localStorage.removeItem('pos_username');
  
  authModal.set({
    isOpen: false,
    message: '',
    title: ''
  });
  
  goto('/login');
}

export function handleApiError(error: any, response?: Response) {
  if (!browser) return;
  
  if (response?.status === 401 || response?.status === 403) {
    showUnauthorizedModal('Token tidak valid. Silahkan login kembali.');
    return;
  }
  
  if (error?.message?.includes('fetch')) {
    showUnauthorizedModal('Koneksi ke server terputus. Silahkan login kembali.');
    return;
  }
  
  if (error?.message?.includes('token') || error?.message?.includes('unauthorized')) {
    showUnauthorizedModal('Sesi telah berakhir. Silahkan login kembali.');
    return;
  }
}

export function isAuthenticated(): boolean {
  if (!browser) return false;
  
  const token = localStorage.getItem('pos_token');
  const role = localStorage.getItem('pos_user_role');
  
  return !!(token && role);
} 