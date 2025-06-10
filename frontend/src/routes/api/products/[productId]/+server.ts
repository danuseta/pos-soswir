import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BACKEND_URL } from '$lib/apiConfig';

export const GET: RequestHandler = async ({ params, fetch, request }) => {
  try {
    const productId = params.productId;
    const response = await fetch(`${BACKEND_URL}/api/products/${productId}`, {
      headers: request.headers
    });
    
    const responseData = await response.json();
    return json(responseData, { status: response.status });
  } catch (error) {
    console.error('API get product error:', error);
    return json({ message: 'Internal server error' }, { status: 500 });
  }
};

export const PUT: RequestHandler = async ({ params, request, fetch }) => {
  try {
    const productId = params.productId;
    const body = await request.json();
    
    const response = await fetch(`${BACKEND_URL}/api/products/${productId}`, {
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
    console.error('API update product error:', error);
    return json({ message: 'Internal server error' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ params, request, fetch }) => {
  try {
    const productId = params.productId;
    
    const response = await fetch(`${BACKEND_URL}/api/products/${productId}`, {
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
    console.error('API delete product error:', error);
    return json({ message: 'Internal server error' }, { status: 500 });
  }
}
