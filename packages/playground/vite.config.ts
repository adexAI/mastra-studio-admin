import { builtinModules } from 'node:module';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin, PluginOption, UserConfig } from 'vite';
import { defineConfig } from 'vite';

interface StudioPluginOptions {
  targetPort: string;
  targetHost: string;
  targetProtocol?: string;
  apiPrefix?: string;
  basePath?: string;
}
const studioStandalonePlugin = (opts: StudioPluginOptions): PluginOption => ({
  name: 'studio-standalone-plugin',
  transformIndexHtml(html: string) {
    return html
      .replace(/%%MASTRA_SERVER_HOST%%/g, opts.targetHost)
      .replace(/%%MASTRA_SERVER_PORT%%/g, opts.targetPort)
      .replace(/%%MASTRA_API_PREFIX%%/g, opts.apiPrefix || process.env.MASTRA_API_PREFIX || '/api')
      .replace(/%%MASTRA_HIDE_CLOUD_CTA%%/g, 'true')
      .replace(/%%MASTRA_STUDIO_BASE_PATH%%/g, opts.basePath ?? process.env.MASTRA_STUDIO_BASE_PATH ?? '')
      .replace(/%%MASTRA_SERVER_PROTOCOL%%/g, opts.targetProtocol || 'http')
      .replace(/%%MASTRA_CLOUD_API_ENDPOINT%%/g, process.env.MASTRA_CLOUD_API_ENDPOINT || '')
      .replace(/%%MASTRA_EXPERIMENTAL_FEATURES%%/g, process.env.EXPERIMENTAL_FEATURES || 'false')
      .replace(/%%MASTRA_EXPERIMENTAL_UI%%/g, process.env.MASTRA_EXPERIMENTAL_UI || 'false')
      .replace(/%%MASTRA_THEME_TOGGLE%%/g, process.env.MASTRA_THEME_TOGGLE || 'false')
      .replace(/%%MASTRA_EXPERIMENTAL_UI%%/g, process.env.MASTRA_EXPERIMENTAL_UI || 'false')
      .replace(/%%MASTRA_TELEMETRY_DISABLED%%/g, process.env.MASTRA_TELEMETRY_DISABLED || '')
      .replace(/%%MASTRA_TEMPLATES%%/g, process.env.MASTRA_TEMPLATES || 'false')
      .replace(/%%MASTRA_AUTO_DETECT_URL%%/g, process.env.MASTRA_AUTO_DETECT_URL || '')
      .replace(/%%MASTRA_REQUEST_CONTEXT_PRESETS%%/g, process.env.MASTRA_REQUEST_CONTEXT_PRESETS || '');
  },
});

// @mastra/core dist chunks contain Node.js builtins (stream, fs, crypto, etc.)
// from server-only code (voice, workspace tools) that shares chunks with
// browser-safe code. These code paths are never called in the browser —
// stub them so Rollup can resolve the imports without erroring.
// enforce: 'pre' ensures this runs before Vite's built-in vite:resolve which
// would otherwise replace them with __vite-browser-external (no named exports).
// Node-only npm packages imported by @mastra/core server-only code (e.g. sandbox).
// These are never called in the browser — stub them alongside Node builtins.
const nodeOnlyPackages = new Set(['execa']);

const stubNodeBuiltinsPlugin: Plugin = {
  name: 'stub-node-builtins',
  enforce: 'pre',
  apply: 'build',
  resolveId(source) {
    if (nodeOnlyPackages.has(source)) {
      return { id: `\0node-stub:${source}`, moduleSideEffects: false };
    }
    const mod = source.startsWith('node:') ? source.slice(5) : source;
    const baseMod = mod.split('/')[0];
    if (builtinModules.includes(baseMod)) {
      return { id: `\0node-stub:${source}`, moduleSideEffects: false };
    }
  },
  load(id) {
    if (id.startsWith('\0node-stub:')) {
      return { code: 'export default {}', syntheticNamedExports: true };
    }
  },
};

export default defineConfig(({ mode }) => {
  const commonConfig: UserConfig = {
    plugins: [stubNodeBuiltinsPlugin, tailwindcss(), react()],
    base: './',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      cssCodeSplit: false,
    },
    server: {
      fs: {
        allow: ['..'],
      },
    },
    define: {
      process: {
        env: {},
      },
    },
  };

  if (mode === 'development') {
    // Use environment variable for the target port, fallback to 4111
    const targetPort = process.env.PORT || '4111';
    const targetHost = process.env.HOST || 'localhost';

    if (commonConfig.plugins) {
      commonConfig.plugins.push(studioStandalonePlugin({ targetPort, targetHost }));
    }

    return {
      ...commonConfig,
      server: {
        ...commonConfig.server,
        proxy: {
          '/api': {
            target: `http://${targetHost}:${targetPort}`,
            changeOrigin: true,
          },
        },
      },
    };
  }

  // Production build: replace all placeholders from .env values
  const targetHost = process.env.MASTRA_SERVER_HOST || 'localhost';
  const targetPort = process.env.MASTRA_SERVER_PORT || '4111';
  const targetProtocol = process.env.MASTRA_SERVER_PROTOCOL || 'http';

  if (commonConfig.plugins) {
    commonConfig.plugins.push(studioStandalonePlugin({ targetHost, targetPort, targetProtocol }));
  }

  return {
    ...commonConfig,
  };
});
