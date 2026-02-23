import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
        build: {
            outDir: 'out/main',
            rollupOptions: {
                input: {
                    main: resolve(__dirname, 'src/main/main.js')
                },
                output: {
                    format: 'es',
                    entryFileNames: '[name].js'
                }
            }
        }
    },
    preload: {
        plugins: [externalizeDepsPlugin()],
        build: {
            outDir: 'out/preload',
            rollupOptions: {
                input: {
                    preload: resolve(__dirname, 'src/preload/preload.js')
                },
                output: {
                    format: 'cjs',
                    entryFileNames: '[name].cjs'
                }
            }
        }
    },
    renderer: {
        root: resolve(__dirname, 'src/renderer'),
        build: {
            outDir: resolve(__dirname, 'out/renderer'),
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'src/renderer/index.html')
                }
            }
        },
        plugins: [react()]
    }
})
