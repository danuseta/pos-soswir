import { registerHooks } from 'node:module';

const lib = new URL('../../', import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '$lib/apiConfig') {
      return { url: 'data:text/javascript,export const BACKEND_URL = "";', shortCircuit: true };
    }
    if (specifier.startsWith('$lib/')) {
      return nextResolve(new URL(`${specifier.slice(5)}.ts`, lib).href, context);
    }
    return nextResolve(specifier, context);
  }
});
