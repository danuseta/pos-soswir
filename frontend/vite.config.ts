import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
export default defineConfig({
	plugins: [
		sveltekit()
	],
	build: {
		minify: 'esbuild',
		rollupOptions: {
			output: {
				manualChunks: (id) => {
					if (id.includes('node_modules')) {
						if (id.includes('chart.js')) {
							return 'chart';
						}
						if (id.includes('lucide-svelte')) {
							return 'lucide';
						}
						if (id.includes('clsx') || id.includes('tailwind-merge')) {
							return 'ui';
						}
						return 'vendor';
					}
				},
				assetFileNames: (assetInfo) => {
					const info = assetInfo.name?.split('.') || [];
					const ext = info[info.length - 1];
					if (/png|jpe?g|svg|gif|tiff|bmp|ico|webp|avif/i.test(ext)) {
						return `assets/img/[name]-[hash][extname]`;
					}
					if (/woff|woff2|eot|ttf|otf/i.test(ext)) {
						return `assets/fonts/[name]-[hash][extname]`;
					}
					return `assets/[name]-[hash][extname]`;
				},
				chunkFileNames: 'assets/js/[name]-[hash].js',
				entryFileNames: 'assets/js/[name]-[hash].js'
			}
		},
		sourcemap: false,
		target: 'esnext',
		cssCodeSplit: true,
		assetsInlineLimit: 2048,
		chunkSizeWarningLimit: 1000
	},
	server: {
		https: false
	},
	optimizeDeps: {
		include: [
			'chart.js',
			'lucide-svelte',
			'clsx',
			'tailwind-merge'
		]
	},
	css: {
		devSourcemap: false
	},
	define: {
		__DEV__: JSON.stringify(false)
	},
	esbuild: {
		drop: ['console', 'debugger'],
		legalComments: 'none'
	}
});