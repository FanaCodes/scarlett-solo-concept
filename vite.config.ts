import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin, type HtmlTagDescriptor } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { heroStillSizes, turntable } from './src/content/product'

/**
 * The hero still is the largest paint on the page, but it is rendered by React
 * after the manifest has been fetched — three round trips before the browser
 * even learns the URL. This reads the same manifest at build time and injects a
 * matching preload, so the request starts from the HTML. The path still comes
 * from the manifest: nothing here hardcodes a frame URL.
 */
function heroStillPreload(sequence: string, sizes: string): Plugin {
  return {
    name: 'hero-still-preload',
    transformIndexHtml: {
      order: 'pre',
      handler(): HtmlTagDescriptor[] {
        const manifestPath = path.resolve(`public/frames/${sequence}/manifest.json`)
        if (!existsSync(manifestPath)) return []

        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
          name: string
          widths: number[]
          formats: string[]
          pathPattern: string
          version?: string
        }
        if (!manifest.formats.includes('avif')) return []

        const url = (width: number) => {
          const base = manifest.pathPattern
            .replaceAll('{name}', manifest.name)
            .replaceAll('{width}', String(width))
            .replaceAll('{index}', '0000')
            .replaceAll('{format}', 'avif')
          return manifest.version ? `${base}?v=${manifest.version}` : base
        }

        return [
          {
            tag: 'link',
            injectTo: 'head-prepend',
            attrs: {
              rel: 'preload',
              as: 'image',
              // Browsers without AVIF skip the preload rather than wasting it.
              type: 'image/avif',
              href: url(manifest.widths[0]),
              imagesrcset: manifest.widths.map((w) => `${url(w)} ${w}w`).join(', '),
              // Must match the <img sizes> exactly or the preload is not reused.
              imagesizes: sizes,
              fetchpriority: 'high',
            },
          },
        ]
      },
    },
  }
}

/**
 * The stylesheet is small and this is a single page, so a separate request for
 * it is a round trip spent for nothing on a slow connection. Inline it and drop
 * the link.
 */
function inlineStylesheet(): Plugin {
  return {
    name: 'inline-stylesheet',
    enforce: 'post',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html
        let out = html
        for (const asset of Object.values(ctx.bundle)) {
          if (asset.type !== 'asset' || !asset.fileName.endsWith('.css')) continue
          const href = `/${asset.fileName}`
          const link = new RegExp(`<link[^>]+href="${href}"[^>]*>`)
          if (!link.test(out)) continue
          out = out.replace(link, `<style>${String(asset.source)}</style>`)
          delete ctx.bundle[asset.fileName]
        }
        return out
      },
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    heroStillPreload(turntable.name, heroStillSizes),
    inlineStylesheet(),
  ],
  build: {
    target: 'es2022',
    assetsInlineLimit: 2048,
  },
})
