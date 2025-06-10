import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BACKEND_URL } from '$lib/apiConfig';

export const GET: RequestHandler = async ({ params, fetch, request }) => {
  try {
    const userId = params.userId;
    const response = await fetch(`${BACKEND_URL}/api/users/${userId}`, {
      headers: {
        ...request.headers.has('authorization') 
          ? { 'authorization': request.headers.get('authorization') || '' }
          : {}
      }
    });
    
    const responseData = await response.json();
    return json(responseData, { status: response.status });
  } catch (error) {
    console.error('API get user error:', error);
    return json({ message: 'Internal server error' }, { status: 500 });
  }
};

export const PUT: RequestHandler = async ({ params, request, fetch }) => {
  try {
    const userId = params.userId;
    const body = await request.json();
    
    const response = await fetch(`${BACKEND_URL}/api/users/${userId}`, {
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
    console.error('API update user error:', error);
    return json({ message: 'Internal server error' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ params, request, fetch }) => {
  try {
    const userId = params.userId;
    
    const response = await fetch(`${BACKEND_URL}/api/users/${userId}`, {
      method: 'DELETE',
      headers: {
        ...request.headers.has('authorization') 
          ? { 'authorization': request.headers.get('authorization') || '' }
          : {}
      }
    });
    
    const responseData = await response.json();
    return json(responseData, { status: response.status });
  } catch (error) {
    console.error('API delete user error:', error);
    return json({ message: 'Internal server error' }, { status: 500 });
  }
}
