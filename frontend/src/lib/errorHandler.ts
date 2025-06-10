import { browser } from '$app/environment';

export interface ApiError {
  message: string;
  status: number;
  code?: string;
  details?: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
}

export const ERROR_TYPES = {
  NETWORK: 'NETWORK_ERROR',
  AUTH: 'AUTH_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  SERVER: 'SERVER_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  TIMEOUT: 'TIMEOUT_ERROR'
} as const;

export const ERROR_MESSAGES = {
  NETWORK: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.',
  AUTH: 'Sesi Anda telah berakhir. Silakan login kembali.',
  VALIDATION: 'Data yang dimasukkan tidak valid.',
  SERVER: 'Terjadi kesalahan server. Silakan coba lagi.',
  NOT_FOUND: 'Data yang dicari tidak ditemukan.',
  FORBIDDEN: 'Anda tidak memiliki akses untuk melakukan aksi ini.',
  TIMEOUT: 'Permintaan terlalu lama. Silakan coba lagi.',
  UNKNOWN: 'Terjadi kesalahan yang tidak diketahui.'
} as const;

export function handleApiError(error: any): ApiError {
  console.error('API Error:', error);

  if (!navigator.onLine) {
    return {
      message: ERROR_MESSAGES.NETWORK,
      status: 0,
      code: ERROR_TYPES.NETWORK
    };
  }

  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      message: ERROR_MESSAGES.NETWORK,
      status: 0,
      code: ERROR_TYPES.NETWORK
    };
  }

  if (error?.status) {
    switch (error.status) {
      case 401:
        return {
          message: error.message || ERROR_MESSAGES.AUTH,
          status: 401,
          code: ERROR_TYPES.AUTH
        };
      case 403:
        return {
          message: error.message || ERROR_MESSAGES.FORBIDDEN,
          status: 403,
          code: ERROR_TYPES.FORBIDDEN
        };
      case 404:
        return {
          message: error.message || ERROR_MESSAGES.NOT_FOUND,
          status: 404,
          code: ERROR_TYPES.NOT_FOUND
        };
      case 422:
        return {
          message: error.message || ERROR_MESSAGES.VALIDATION,
          status: 422,
          code: ERROR_TYPES.VALIDATION,
          details: error.details
        };
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          message: error.message || ERROR_MESSAGES.SERVER,
          status: error.status,
          code: ERROR_TYPES.SERVER
        };
      default:
        return {
          message: error.message || ERROR_MESSAGES.UNKNOWN,
          status: error.status,
          code: ERROR_TYPES.SERVER
        };
    }
  }

  return {
    message: error?.message || ERROR_MESSAGES.UNKNOWN,
    status: 500,
    code: ERROR_TYPES.SERVER
  };
}

export function createSuccessResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message
  };
}

export function createErrorResponse(error: ApiError): ApiResponse {
  return {
    success: false,
    error,
    message: error.message
  };
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (error?.status >= 400 && error?.status < 500) {
        throw error;
      }

      if (i === maxRetries) {
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }

  throw lastError;
}

if (browser) {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    event.preventDefault();
  });
} 