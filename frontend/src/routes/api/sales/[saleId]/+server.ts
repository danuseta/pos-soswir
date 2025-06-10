import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BACKEND_URL } from '$lib/apiConfig';

export const GET: RequestHandler = async ({ params, fetch, request }) => {
  try {
    const saleId = params.saleId;
    const response = await fetch(`${BACKEND_URL}/api/sales/${saleId}`, {
      headers: request.headers
    });
    
    const responseData = await response.json();
    return json(responseData, { status: response.status });
  } catch (error) {
    console.error('API get sale error:', error);
    return json({ message: 'Internal server error' }, { status: 500 });
  }
};
