import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/app/' : '/',  // 生产环境部署在 /app 路径下
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    // 🔒 禁用 Source Map（防止源代码泄露）
    sourcemap: false,
    
    // 🔒 代码混淆和压缩
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      },
      mangle: {
        safari10: true
      },
      format: {
        comments: false
      }
    },
    
    // ⚡ 性能优化
    chunkSizeWarningLimit: 1000,
    
    // 分块策略（简化版，避免依赖加载顺序问题）
    rollupOptions: {
      output: {
        manualChunks: {
          // 将所有 node_modules 打包到一个 vendor chunk
          'vendor': [
            'react',
            'react-dom',
            'react-router-dom',
            'antd',
            'axios',
            'dayjs'
          ],
          // ECharts 单独打包（体积较大）
          'echarts': ['echarts']
        },
        // 优化文件名
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    }
  }
}));
