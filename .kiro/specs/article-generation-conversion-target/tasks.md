# Implementation Plan

- [x] 1. 数据库迁移：添加转化目标字段
  - 在generation_tasks表中添加conversion_target_id字段
  - 添加外键约束引用conversion_targets表
  - 添加索引以优化查询性能
  - 字段设为可选（允许NULL）以保持向后兼容性
  - _Requirements: 3.1, 3.2_

- [x] 2. 更新前端类型定义
  - 在articleGeneration.ts中扩展TaskConfig接口，添加conversionTargetId字段（可选）
  - 在articleGeneration.ts中添加ConversionTarget接口定义
  - 确保类型定义与后端API响应格式一致
  - _Requirements: 3.1, 3.2, 4.2_

- [x] 3. 添加前端API函数
  - 在articleGenerationApi.ts中实现fetchConversionTargets函数
  - 调用GET /api/conversion-targets端点
  - 处理API响应并返回ConversionTarget数组
  - 实现错误处理逻辑
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 3.1 编写fetchConversionTargets的单元测试
  - 测试成功获取转化目标列表
  - 测试API调用失败时的错误处理
  - 测试返回数据格式正确性
  - _Requirements: 4.2, 4.3_

- [x] 4. 修改TaskConfigModal组件
  - 添加conversionTargets状态变量
  - 在loadAllData函数中添加fetchConversionTargets调用
  - 使用Promise.all并行加载所有数据源
  - 在表单中添加"选择转化目标"字段（位于"选择蒸馏历史"之后）
  - 配置Select组件支持搜索功能
  - 设置表单验证规则（必填）
  - 在handleSubmit中包含conversionTargetId字段
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.2, 2.3, 2.4, 2.5, 3.1, 4.1, 4.4_

- [x] 4.1 编写TaskConfigModal组件的单元测试
  - 测试对话框打开时显示转化目标字段
  - 测试字段位置正确（在蒸馏历史之后）
  - 测试数据加载时调用fetchConversionTargets
  - 测试加载状态正确显示
  - 测试选项正确渲染（公司名称和行业）
  - 测试用户选择后表单值更新
  - 测试搜索功能
  - 测试表单验证（未选择时显示错误）
  - 测试提交时包含conversionTargetId
  - 测试表单重置清除所有字段
  - 测试空列表时的UI显示
  - 测试API失败时的错误处理
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.2, 2.3, 2.4, 2.5, 3.1, 3.3, 5.1, 5.2, 5.3_

- [x] 5. 更新后端路由验证schema
  - 在articleGeneration.ts中修改createTaskSchema
  - 添加conversionTargetId字段验证（可选的正整数）
  - 在POST /tasks路由中添加转化目标存在性验证
  - 修改service.createTask调用以传递conversionTargetId
  - _Requirements: 3.1, 3.2_

- [x] 5.1 编写后端路由的单元测试
  - 测试包含conversionTargetId的请求成功创建任务
  - 测试缺少conversionTargetId时任务仍能创建（向后兼容）
  - 测试无效的conversionTargetId返回404错误
  - 测试conversionTargetId为非正整数时返回400错误
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 6. 更新ArticleGenerationService
  - 修改TaskConfig接口定义，添加conversionTargetId字段（可选）
  - 修改createTask方法的INSERT语句，包含conversion_target_id字段
  - 处理conversionTargetId为undefined的情况（插入NULL）
  - 修改getTasks和getTaskDetail方法，在SELECT语句中包含conversion_target_id字段
  - _Requirements: 3.1, 3.2_

- [x] 6.1 编写ArticleGenerationService的单元测试
  - 测试createTask方法正确保存conversionTargetId
  - 测试createTask方法处理conversionTargetId为undefined的情况
  - 测试getTasks方法返回包含conversion_target_id的任务列表
  - 测试getTaskDetail方法返回包含conversion_target_id的任务详情
  - _Requirements: 3.1, 3.2_

- [x] 7. 集成测试和验证
  - 启动开发服务器，测试完整的用户流程
  - 验证对话框打开时正确加载转化目标列表
  - 验证选择转化目标后能成功创建任务
  - 验证任务详情中包含转化目标信息
  - 验证空列表和错误场景的用户体验
  - 验证向后兼容性（不传conversionTargetId时任务仍能创建）
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3_
