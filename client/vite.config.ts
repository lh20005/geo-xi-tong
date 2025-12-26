import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
        drop_console: true,      // 删除 console.log
        drop_debugger: true,     // 删除 debugger
        pure_funcs: [            // 删除指定函数
          'console.log',
          'console.info',
          'console.debug'
        ]
      },
      mangle: {
        safari10: true           // 变量名混淆
      },
      format: {
        comments: false          // 删除注释
      }
    },
    
    // 分块策略（提高加载速度）
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'antd-vendor': ['antd', '@ant-design/icons']
        }
      }
    }
  }
});
