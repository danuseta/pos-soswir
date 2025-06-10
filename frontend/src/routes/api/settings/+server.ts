import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BACKEND_URL } from '$lib/apiConfig';

export const GET: RequestHandler = async ({ fetch, request }) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/settings`, {
      headers: {
        ...request.headers.has('authorization') 
          ? { 'authorization': request.headers.get('authorization') || '' }
          : {}
      }
    });
    
    const responseData = await response.json();
    return json(responseData, { status: response.status });
  } catch (error) {
    console.error('API settings error:', error);
    return json({ message: 'Internal server error' }, { status: 500 });
  }
};

export const PUT: RequestHandler = async ({ request, fetch }) => {
  try {
    const body = await request.json();
    
    const response = await fetch(`${BACKEND_URL}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...request.headers.has('authorization') 
          ? { 'authorization': request.headers.get('authorization') || '' }
          : {}
      },
      body: JSON.stringify(body)
    });
    
    const responseData = await response.json();
    return json(responseData, { status: response.status });
  } catch (error) {
    console.error('API update settings error:', error);
    return json({ message: 'Internal server error' }, { status: 500 });
  }
}
