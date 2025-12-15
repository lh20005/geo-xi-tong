# Implementation Plan

- [x] 1. 更新后端服务以支持关联数据查询
  - 修改 `ArticleGenerationService.getTasks()` 方法，使用 JOIN 查询获取转化目标名称、关键词和提供商信息
  - 更新返回的数据结构，包含 `conversionTargetName`、`keyword`、`provider` 字段
  - 确保 LEFT JOIN conversion_targets 和 INNER JOIN distillations 的正确性
  - _Requirements: 1.2, 1.4, 2.2, 2.3, 3.2, 3.3, 6.1, 6.2, 6.3_

- [x] 1.1 编写后端服务单元测试
  - 测试 `getTasks()` 返回包含关联数据的任务列表
  - 测试转化目标为 NULL 时的处理
  - 测试 JOIN 查询的正确执行
  - _Requirements: 1.2, 1.3, 2.2, 3.2, 6.2, 6.3_

- [x] 2. 更新前端类型定义
  - 修改 `client/src/types/articleGeneration.ts` 中的 `GenerationTask` 接口
  - 添加 `conversionTargetName?: string | null`、`keyword: string`、`provider: string` 字段
  - 确保类型定义与后端响应结构一致
  - _Requirements: 6.1_

- [x] 3. 更新文章生成页面表格列定义
  - 修改 `ArticleGenerationPage.tsx` 的 `columns` 数组
  - 在"状态"列后添加"转化目标"列，显示 `conversionTargetName`，空值显示 "-"
  - 添加"关键词"列，使用蓝色 Tag 组件渲染
  - 添加"蒸馏结果"列，根据 provider 值显示不同颜色的 Tag（deepseek=紫色，gemini=绿色）
  - 移除"更新时间"列（`updatedAt`）
  - 移除"错误信息"列（`errorMessage`）
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2_

- [x] 4. 优化表格列宽配置
  - 为每个列设置合理的 `width` 属性
  - 任务ID: 80px
  - 状态: 100px
  - 转化目标: 150px（带 ellipsis 和 tooltip）
  - 关键词: 120px
  - 蒸馏结果: 100px
  - 进度: 200px
  - 创建时间: 180px
  - 操作: 100px（fixed: 'right'）
  - 调整 Table 组件的 `scroll` 属性以适应新的总宽度
  - _Requirements: 1.5, 5.1, 5.2, 7.3_

- [x] 5. 编写前端组件测试
  - 测试表格渲染包含新增的三列
  - 测试表格不渲染"更新时间"和"错误信息"列
  - 测试转化目标为空时显示 "-"
  - 测试关键词渲染为蓝色 Tag
  - 测试 DeepSeek 提供商渲染为紫色 Tag
  - 测试 Gemini 提供商渲染为绿色 Tag
  - _Requirements: 1.1, 1.3, 2.1, 2.4, 3.1, 3.3, 3.4, 4.1, 4.2_

- [x] 6. 测试数据一致性和错误处理
  - 手动测试：创建包含转化目标和不包含转化目标的任务，验证显示正确
  - 手动测试：验证关键词和提供商信息与蒸馏结果一致
  - 手动测试：验证不同 AI 提供商的 Tag 颜色正确
  - 手动测试：验证列宽分配合理，页面美观
  - 验证在标准桌面屏幕下无水平滚动
  - _Requirements: 1.2, 1.3, 2.2, 3.2, 3.3, 3.4, 5.1, 5.2, 6.2, 6.3_
