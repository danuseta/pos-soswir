<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';

    onMount(async () => {
        if (!browser) return;

        const token = localStorage.getItem('pos_token');
        const userRole = localStorage.getItem('pos_user_role');
        
        if (!token) {
            goto('/login');
            return;
        }

        try {
            const response = await fetch('/api/auth/verify', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                localStorage.removeItem('pos_token');
                localStorage.removeItem('pos_user_role');
                localStorage.removeItem('pos_user_id');
                goto('/login');
                return;
            }

            if (userRole === 'superadmin') {
                goto('/superadmin/dashboard');
            } else if (userRole === 'cashier') {
                goto('/cashier/dashboard');
            } else {
                localStorage.removeItem('pos_token');
                localStorage.removeItem('pos_user_role');
                localStorage.removeItem('pos_user_id');
                goto('/login');
            }
        } catch (error) {
            console.error('Token verification failed:', error);
            localStorage.removeItem('pos_token');
            localStorage.removeItem('pos_user_role');
            localStorage.removeItem('pos_user_id');
            goto('/login');
        }
    });
</script>

<div class="flex items-center justify-center h-screen">
    <div class="text-center">
        <div class="inline-block animate-spin h-8 w-8 border-4 border-t-blue-500 border-r-transparent border-b-blue-500 border-l-transparent rounded-full mb-4"></div>
        <h2 class="text-xl font-semibold">Memuat aplikasi...</h2>
        <p>Mohon tunggu sebentar</p>
    </div>
</div>
