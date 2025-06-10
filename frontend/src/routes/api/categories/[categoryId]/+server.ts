import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BACKEND_URL } from '$lib/apiConfig';

export const GET: RequestHandler = async ({ params, fetch, request }) => {
  try {
    const categoryId = params.categoryId;
    const response = await fetch(`${BACKEND_URL}/api/categories/${categoryId}`, {
      headers: request.headers
    });
    
    const responseData = await response.json();
    return json(responseData, { status: response.status });
  } catch (error) {
    console.error('API get category error:', error);
    return json({ message: 'Internal server error' }, { status: 500 });
  }
};

export const PUT: RequestHandler = async ({ params, request, fetch }) => {
  try {
    const categoryId = params.categoryId;
    const body = await request.json();
    
    const response = await fetch(`${BACKEND_URL}/api/categories/${categoryId}`, {
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
    console.error('API update category error:', error);
    return json({ message: 'Internal server error' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ params, request, fetch }) => {
  try {
    const categoryId = params.categoryId;
    
    const response = await fetch(`${BACKEND_URL}/api/categories/${categoryId}`, {
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
    console.error('API delete category error:', error);
    return json({ message: 'Internal server error' }, { status: 500 });
  }
}
