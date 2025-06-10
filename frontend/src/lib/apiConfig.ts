import { browser } from '$app/environment';
import { handleApiError, withRetry, type ApiResponse, createSuccessResponse, createErrorResponse } from './errorHandler';
import { loadingManager } from './loadingStore';

export const BACKEND_URL = browser 
  ? (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001')
  : (process.env.VITE_BACKEND_URL || 'http://localhost:3001');

export function getAuthHeaders() {
  if (!browser) return {};
  
  const token = localStorage.getItem('pos_token');
  return token 
    ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } 
    : { 'Content-Type': 'application/json' };
}

export async function apiRequest<T = any>(
  endpoint: string, 
  options: RequestInit = {},
  enableRetry: boolean = false
): Promise<ApiResponse<T>> {
  const url = `${BACKEND_URL}${endpoint}`;
  
  const defaultHeaders = browser ? getAuthHeaders() : {};
  
  const requestOptions: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  };

  try {
    const makeRequest = async () => {
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
        throw { 
          status: response.status, 
          message: errorData.message || `HTTP ${response.status}`,
          details: errorData 
        };
      }
      
      return await response.json();
    };

    const data = enableRetry 
      ? await withRetry(makeRequest, 2, 1000)
      : await makeRequest();
      
    return createSuccessResponse(data);
    
  } catch (error) {
    const apiError = handleApiError(error);
    
    if (apiError.code === 'AUTH_ERROR' && browser) {
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_user_role');
      localStorage.removeItem('pos_user_id');
      window.location.href = '/login';
    }
    
    return createErrorResponse(apiError);
  }
}

export const api = {
  get: <T = any>(endpoint: string, enableRetry = false) => 
    apiRequest<T>(endpoint, { method: 'GET' }, enableRetry),
  
  post: <T = any>(endpoint: string, data: any, enableRetry = false) => 
    apiRequest<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    }, enableRetry),
  
  put: <T = any>(endpoint: string, data: any, enableRetry = false) => 
    apiRequest<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    }, enableRetry),
  
  delete: <T = any>(endpoint: string, enableRetry = false) => 
    apiRequest<T>(endpoint, { method: 'DELETE' }, enableRetry),
  
  upload: <T = any>(endpoint: string, formData: FormData, enableRetry = false) => 
    apiRequest<T>(endpoint, {
      method: 'POST',
      body: formData,
      headers: browser ? { 'Authorization': `Bearer ${localStorage.getItem('pos_token')}` } : {}
    }, enableRetry),

  withLoading: <T = any>(taskName: string, apiCall: () => Promise<ApiResponse<T>>) => 
    loadingManager.withLoading(taskName, apiCall)
};
