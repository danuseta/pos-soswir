import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';
import { loadEnv } from 'vite';

const isDev = process.env.NODE_ENV === 'development';
const backendUrl = loadEnv(process.env.NODE_ENV || 'production', process.cwd(), 'VITE_').VITE_BACKEND_URL || 'http://localhost:3002';
const backendOrigin = new URL(backendUrl).origin;

const config = {
	preprocess: [
		vitePreprocess({
			postcss: true,
			typescript: {
				tsconfigFile: './tsconfig.json'
			}
		})
	],

	kit: {
		adapter: adapter({ fallback: 'index.html' }),
		
		paths: {
			assets: ''
		},
		
		alias: {
			$lib: resolve('./src/lib'),
			$components: resolve('./src/lib/components'),
			$stores: resolve('./src/lib/stores'),
			$utils: resolve('./src/lib/utils')
		},
		
		prerender: {
			entries: ['/'],
			handleHttpError: ({ path, referrer, message }) => {
				if (message.includes('404')) {
					return;
				}
				throw new Error(message);
			}
		},
		
		...(isDev ? {} : {
			csp: {
				mode: 'auto',
				directives: {
					'script-src': ['self'],
					'style-src': ['self', 'unsafe-inline'],
					'img-src': ['self', 'data:', 'blob:', 'https://res.cloudinary.com', backendOrigin],
					'font-src': ['self'],
					'connect-src': ['self', backendOrigin],
					'manifest-src': ['self']
				}
			}
		}),
		
		serviceWorker: {
			register: false
		}
	},
	
	compilerOptions: {
		css: 'injected'
	}
};

export default config;
