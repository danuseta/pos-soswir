import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BACKEND_URL } from '$lib/apiConfig';
import { handleApiError, createErrorResponse, createSuccessResponse } from '$lib/errorHandler';

export const POST: RequestHandler = async ({ request, fetch }) => {
  try {
    const body = await request.json();
    
    if (!body.username || !body.password) {
      return json({ 
        success: false,
        message: 'Username dan password harus diisi'
      }, { status: 400 });
    }
    
    console.log('Login API called with:', { username: body.username });
    console.log('Using backend URL:', BACKEND_URL);
    
    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      credentials: 'include'
    });
    
    const responseData = await response.json();
    
    if (response.ok) {
      return json(createSuccessResponse(responseData), {
        status: response.status
      });
    } else {
      const apiError = handleApiError({ 
        status: response.status, 
        message: responseData.message || 'Login failed'
      });
      return json(createErrorResponse(apiError), {
        status: response.status
      });
    }
  } catch (error) {
    console.error('API login error:', error);
    const apiError = handleApiError(error);
    return json(createErrorResponse(apiError), { 
      status: apiError.status || 500 
    });
  }
}
