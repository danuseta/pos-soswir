import adapter from '@sveltejs/adapter-netlify';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

const isDev = process.env.NODE_ENV === 'development';

/** @type {import('@sveltejs/kit').Config} */
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
		adapter: adapter(),
		
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
					'img-src': ['self', 'data:', 'blob:', 'https://res.cloudinary.com'],
					'font-src': ['self'],
					'connect-src': ['self', 'https://pos-soswir.shankara.web.id'],
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
