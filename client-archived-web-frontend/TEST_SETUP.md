# 前端测试设置说明

## 安装测试依赖

前端测试需要以下依赖：

```bash
cd client
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jest jest-environment-jsdom @types/jest ts-jest fast-check
```

## Jest 配置

创建 `jest.config.js`:

```javascript
export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.tsx', '**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
      },
    }],
  },
};
```

## 测试设置文件

创建 `src/setupTests.ts`:

```typescript
import '@testing-library/jest-dom';
```

## 运行测试

```bash
npm test
```

## 当前测试文件

- `src/pages/ConversionTargetPage.test.tsx` - 转化目标页面的属性测试

## 测试覆盖的属性

1. Property 2: Text input acceptance
2. Property 3: Valid form submission enables action
3. Property 5: Successful save triggers UI updates
4. Property 6: List display completeness
5. Property 9: Detail view completeness
6. Property 10: Edit form pre-population
7. Property 14: Sort preserves pagination
8. Property 15: Sort indicator consistency
9. Property 17: Search clear restores full list
