# Implementation Plan - 转化目标管理模块

- [x] 1. 数据库设置和后端基础架构
  - 创建数据库迁移脚本，添加 conversion_targets 表
  - 创建数据库索引以优化查询性能
  - 设置后端路由文件结构
  - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [ ] 2. 实现后端API端点 - 创建和查询
- [x] 2.1 实现 POST /api/conversion-targets 端点
  - 编写创建转化目标的路由处理器
  - 实现服务端表单验证逻辑
  - 实现公司名称唯一性检查
  - 处理数据库插入操作
  - _Requirements: 5.1, 13.1, 4.1, 4.2, 4.3, 4.4_

- [x] 2.2 编写创建端点的属性测试
  - **Property 1: Form field validation consistency**
  - **Property 4: Data persistence round trip**
  - **Validates: Requirements 3.1, 3.3, 3.4, 4.2, 4.3, 5.1, 13.1, 13.4**

- [x] 2.3 实现 GET /api/conversion-targets 端点（列表查询）
  - 编写列表查询的路由处理器
  - 实现分页逻辑（每页10条）
  - 实现搜索过滤功能（公司名称、行业）
  - 实现排序功能（多列支持）
  - _Requirements: 6.1, 7.1, 12.1, 11.1_

- [x] 2.4 编写列表查询的属性测试
  - **Property 7: Pagination consistency**
  - **Property 8: Pagination navigation correctness**
  - **Property 16: Search filter correctness**
  - **Property 13: Sort order correctness**
  - **Validates: Requirements 7.1, 7.3, 7.4, 7.5, 12.1, 12.2, 12.3, 11.1, 11.2**

- [x] 2.5 实现 GET /api/conversion-targets/:id 端点（单条查询）
  - 编写单条记录查询的路由处理器
  - 实现404错误处理
  - _Requirements: 8.2, 13.4_

- [ ] 3. 实现后端API端点 - 更新和删除
- [x] 3.1 实现 PATCH /api/conversion-targets/:id 端点
  - 编写更新转化目标的路由处理器
  - 实现部分更新逻辑（只更新提供的字段）
  - 实现更新时的验证逻辑
  - 处理记录不存在的情况
  - _Requirements: 9.3, 9.4, 13.2_

- [x] 3.2 编写更新端点的属性测试
  - **Property 11: Update operation consistency**
  - **Property 18: Database operation persistence**
  - **Validates: Requirements 9.3, 9.4, 9.5, 13.2**

- [x] 3.3 实现 DELETE /api/conversion-targets/:id 端点
  - 编写删除转化目标的路由处理器
  - 实现软删除或硬删除逻辑
  - 处理记录不存在的情况
  - _Requirements: 10.3, 13.3_

- [x] 3.4 编写删除端点的属性测试
  - **Property 12: Delete operation consistency**
  - **Validates: Requirements 10.3, 10.4, 13.3**

- [x] 4. 注册后端路由到主应用
  - 在 server/src/routes/index.ts 中注册转化目标路由
  - 确保错误处理中间件正确应用
  - _Requirements: 所有后端需求_

- [ ] 5. 前端路由和导航设置
- [x] 5.1 在侧边栏添加"转化目标"菜单项
  - 修改 Sidebar.tsx 添加新菜单项
  - 使用合适的图标（建议 TargetOutlined）
  - 配置路由路径 /conversion-targets
  - _Requirements: 1.1, 1.2_

- [x] 5.2 在 App.tsx 中添加路由配置
  - 添加 /conversion-targets 路由
  - 配置 ConversionTargetPage 组件
  - _Requirements: 1.2, 1.3_

- [ ] 6. 实现转化目标主页面组件
- [x] 6.1 创建 ConversionTargetPage 组件基础结构
  - 创建 client/src/pages/ConversionTargetPage.tsx
  - 设置页面布局（Card + Table + Modal）
  - 定义 TypeScript 接口和类型
  - 初始化状态管理（列表、分页、加载状态）
  - _Requirements: 1.3, 6.1_

- [x] 6.2 实现列表数据加载和展示
  - 实现 loadConversionTargets 函数（调用 API）
  - 配置 Ant Design Table 组件
  - 定义表格列（公司名称、行业、规模、联系方式、创建时间、操作）
  - 实现加载状态和空状态展示
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 6.3 编写列表展示的属性测试
  - **Property 6: List display completeness**
  - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**

- [x] 6.4 实现分页功能
  - 配置 Table 的 pagination 属性
  - 实现页码变化处理函数
  - 实现每页显示10条记录
  - 显示总记录数和当前页码
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 6.5 编写分页功能的属性测试
  - **Property 14: Sort preserves pagination**
  - **Validates: Requirements 11.3**

- [x] 6.6 实现排序功能
  - 配置 Table 列的 sorter 属性
  - 实现排序状态管理
  - 实现排序变化处理函数
  - 显示排序指示器
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [x] 6.7 编写排序功能的属性测试
  - **Property 15: Sort indicator consistency**
  - **Validates: Requirements 11.4**

- [x] 6.8 实现搜索功能
  - 添加搜索输入框组件
  - 实现搜索关键词状态管理
  - 实现搜索过滤逻辑（调用 API）
  - 实现清空搜索功能
  - 显示空搜索结果提示
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 6.9 编写搜索功能的属性测试
  - **Property 17: Search clear restores full list**
  - **Validates: Requirements 12.4**

- [ ] 7. 实现转化目标表单对话框组件
- [x] 7.1 创建 ConversionTargetModal 组件
  - 创建表单对话框组件文件
  - 配置 Modal 和 Form 组件
  - 定义表单字段（8个核心字段）
  - 实现三种模式：创建、编辑、查看
  - _Requirements: 2.1, 2.2, 3.1-3.8_

- [x] 7.2 实现表单验证规则
  - 配置公司名称验证（必填，2-255字符）
  - 配置行业类型选择（下拉选择）
  - 配置公司规模选择（下拉选择）
  - 配置联系方式验证（手机或邮箱格式）
  - 配置官方网站验证（URL格式，可选）
  - 配置文本字段（公司特色、目标客户群、核心产品）
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3_

- [x] 7.3 编写表单验证的属性测试
  - **Property 2: Text input acceptance**
  - **Property 3: Valid form submission enables action**
  - **Validates: Requirements 3.2, 3.7, 3.8, 4.5**

- [x] 7.4 实现表单提交逻辑
  - 实现创建模式的提交处理
  - 实现编辑模式的提交处理
  - 实现提交成功后的UI更新
  - 实现错误处理和提示
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 7.5 编写表单提交的属性测试
  - **Property 5: Successful save triggers UI updates**
  - **Validates: Requirements 5.2, 5.3, 5.4**

- [x] 7.6 实现查看模式（只读）
  - 配置表单字段为只读
  - 隐藏提交按钮
  - 显示所有字段数据
  - _Requirements: 8.2, 8.3_

- [x] 7.7 编写查看模式的属性测试
  - **Property 9: Detail view completeness**
  - **Validates: Requirements 8.2, 8.3**

- [x] 7.8 实现编辑模式的数据预填充
  - 加载现有数据到表单
  - 允许修改所有字段
  - 保持未修改字段的原值
  - _Requirements: 9.1, 9.2_

- [x] 7.9 编写编辑模式的属性测试
  - **Property 10: Edit form pre-population**
  - **Validates: Requirements 9.1, 9.2**

- [ ] 8. 实现操作按钮功能
- [x] 8.1 实现"新增转化目标"按钮
  - 添加按钮到页面头部
  - 实现点击打开创建模式对话框
  - _Requirements: 2.1_

- [x] 8.2 实现"查看"操作按钮
  - 在表格操作列添加查看按钮
  - 实现点击打开查看模式对话框
  - 加载并显示完整数据
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 8.3 实现"编辑"操作按钮
  - 在表格操作列添加编辑按钮
  - 实现点击打开编辑模式对话框
  - 预填充现有数据
  - _Requirements: 9.1, 9.2_

- [x] 8.4 实现"删除"操作按钮
  - 在表格操作列添加删除按钮
  - 实现点击显示确认对话框
  - 实现确认删除逻辑（调用 API）
  - 实现取消删除逻辑
  - 实现删除成功后刷新列表
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 9. 错误处理和用户反馈
- [x] 9.1 实现客户端错误处理
  - 实现网络错误提示（Toast消息）
  - 实现表单验证错误显示
  - 实现加载状态指示器
  - 实现空状态展示
  - _Requirements: 5.5, 12.5_

- [x] 9.2 实现服务端错误处理
  - 实现统一错误响应格式
  - 实现验证错误处理（400）
  - 实现重复条目错误处理（409）
  - 实现未找到错误处理（404）
  - 实现数据库错误处理（500）
  - 实现错误日志记录
  - _Requirements: 4.4, 5.5, 13.5_

- [ ] 10. 样式和UI优化
- [x] 10.1 优化页面布局和样式
  - 调整表格列宽和对齐
  - 优化表单字段布局
  - 添加响应式设计支持
  - 统一颜色和间距
  - _Requirements: 所有UI相关需求_

- [x] 10.2 优化用户体验
  - 添加操作确认提示
  - 优化加载动画
  - 添加操作成功/失败的Toast提示
  - 实现防抖搜索（300ms延迟）
  - _Requirements: 所有UX相关需求_

- [x] 11. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户
