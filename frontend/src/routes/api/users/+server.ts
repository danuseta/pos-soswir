import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BACKEND_URL } from '$lib/apiConfig';

export const GET: RequestHandler = async ({ url, fetch, request }) => {
  try {
    const queryString = url.search;
    const backendUrl = `${BACKEND_URL}/api/users${queryString}`;
    
    const response = await fetch(backendUrl, {
      headers: {
        ...request.headers.has('authorization') 
          ? { 'authorization': request.headers.get('authorization') || '' }
          : {}
      }
    });
    
    const responseData = await response.json();
    return json(responseData, { status: response.status });
  } catch (error) {
    console.error('API users error:', error);
    return json({ message: 'Internal server error' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request, fetch }) => {
  try {
    const body = await request.json();
    
    const response = await fetch(`${BACKEND_URL}/api/users`, {
      method: 'POST',
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
    console.error('API users POST error:', error);
    return json({ message: 'Internal server error' }, { status: 500 });
  }
}
