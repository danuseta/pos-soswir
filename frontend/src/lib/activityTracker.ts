import { browser } from '$app/environment';
import { BACKEND_URL, getAuthHeaders } from './apiConfig';

let lastRoute = '';

export async function trackActivity(routePath: string) {
  if (!browser || !routePath || routePath === lastRoute) return;
  
  try {
    const token = localStorage.getItem('pos_token');
    const userRole = localStorage.getItem('pos_user_role');
    
    if (!token || userRole !== 'cashier') return;
    
    await fetch(`${BACKEND_URL}/api/auth/track-activity`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ route_path: routePath })
    });
    
    lastRoute = routePath;
  } catch (error) {
    console.error('Error tracking activity:', error);
  }
}

export async function logoutUser() {
  if (!browser) return;
  
  try {
    const token = localStorage.getItem('pos_token');
    if (!token) return;
    
    await fetch(`${BACKEND_URL}/api/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
  } catch (error) {
    console.error('Error during logout:', error);
  }
}
