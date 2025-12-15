# 实施计划

- [ ] 1. 数据库设置和后端基础
- [x] 1.1 创建数据库迁移脚本
  - 创建article_settings表的SQL迁移文件
  - 包含所有字段定义和索引
  - 添加到migrations目录
  - _需求: 8.1, 8.2_

- [x] 1.2 创建后端路由文件
  - 创建server/src/routes/articleSettings.ts
  - 设置Express Router基础结构
  - 导入必要的依赖（pool, zod, express）
  - _需求: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 1.3 定义Zod验证Schema
  - 创建createArticleSettingSchema
  - 创建updateArticleSettingSchema
  - 包含所有验证规则（长度、非空等）
  - _需求: 1.4, 6.1, 6.3_

- [ ] 2. 实现后端API端点
- [x] 2.1 实现获取列表端点 (GET /api/article-settings)
  - 实现分页逻辑（page, pageSize参数）
  - 按created_at降序排序
  - 返回总数和分页信息
  - _需求: 2.1, 2.2, 6.2, 8.3_

- [ ] 2.2 编写属性测试：分页大小一致性
  - **属性 3: 分页大小一致性**
  - **验证: 需求 2.2**

- [ ] 2.3 编写属性测试：查询结果排序一致性
  - **属性 10: 查询结果排序一致性**
  - **验证: 需求 8.3**

- [x] 2.4 实现创建端点 (POST /api/article-settings)
  - 验证输入数据
  - 插入数据库记录
  - 返回创建的记录
  - _需求: 1.3, 6.1, 8.1, 8.2_

- [ ] 2.5 编写属性测试：有效数据创建持久化
  - **属性 1: 有效数据创建持久化**
  - **验证: 需求 1.3, 6.1, 8.1**

- [ ] 2.6 编写属性测试：无效输入验证拒绝
  - **属性 2: 无效输入验证拒绝**
  - **验证: 需求 1.4**

- [ ] 2.7 编写属性测试：时间戳自动设置
  - **属性 9: 时间戳自动设置**
  - **验证: 需求 8.2**

- [x] 2.8 实现获取单个记录端点 (GET /api/article-settings/:id)
  - 验证ID参数
  - 查询数据库
  - 处理记录不存在的情况
  - _需求: 5.1, 5.2_

- [x] 2.9 实现更新端点 (PATCH /api/article-settings/:id)
  - 验证ID和输入数据
  - 检查记录是否存在
  - 更新数据库记录
  - 自动更新updated_at时间戳
  - _需求: 3.2, 3.3, 6.3_

- [ ] 2.10 编写属性测试：更新操作持久化
  - **属性 5: 更新操作持久化**
  - **验证: 需求 3.2, 3.3, 6.3**

- [x] 2.11 实现删除端点 (DELETE /api/article-settings/:id)
  - 验证ID参数
  - 检查记录是否存在
  - 删除数据库记录
  - 返回成功状态
  - _需求: 4.2, 6.4_

- [ ] 2.12 编写属性测试：删除操作完整性
  - **属性 6: 删除操作完整性**
  - **验证: 需求 4.2, 6.4**

- [ ] 2.13 编写属性测试：API错误响应一致性
  - **属性 8: API错误响应一致性**
  - **验证: 需求 6.5**

- [x] 2.14 在主应用中注册路由
  - 在server/src/index.ts中导入articleSettingsRouter
  - 注册到/api/article-settings路径
  - _需求: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 3. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户

- [ ] 4. 前端类型定义和API客户端
- [x] 4.1 创建TypeScript类型定义
  - 在client/src/types目录创建articleSettings.ts
  - 定义ArticleSetting接口
  - 定义ArticleSettingFormData接口
  - 定义API响应类型
  - _需求: 1.1, 2.1, 3.1, 5.1_

- [x] 4.2 创建API客户端函数
  - 创建client/src/api/articleSettings.ts
  - 实现fetchArticleSettings函数
  - 实现createArticleSetting函数
  - 实现updateArticleSetting函数
  - 实现deleteArticleSetting函数
  - 实现fetchArticleSettingById函数
  - _需求: 1.3, 2.1, 3.2, 4.2, 5.1_

- [ ] 5. 实现前端组件
- [x] 5.1 创建ArticleSettingsPage主页面组件
  - 创建client/src/pages/ArticleSettingsPage.tsx
  - 实现状态管理（settings, loading, pagination, modal）
  - 实现fetchSettings方法
  - 实现handleCreate, handleEdit, handleView, handleDelete方法
  - 实现页面布局（标题、按钮、列表、分页）
  - _需求: 1.1, 2.1, 2.2, 3.1, 4.1, 5.1_

- [ ] 5.2 编写单元测试：ArticleSettingsPage组件
  - 测试列表渲染
  - 测试加载状态
  - 测试分页功能
  - _需求: 2.1, 2.2_

- [x] 5.3 创建ArticleSettingModal对话框组件
  - 创建client/src/components/ArticleSettingModal.tsx
  - 实现表单（名称、提示词输入）
  - 根据mode显示不同状态（create/edit/view）
  - 实现表单验证
  - 实现提交和取消处理
  - _需求: 1.1, 1.2, 1.4, 3.1, 3.5, 5.1_

- [ ] 5.4 编写单元测试：ArticleSettingModal组件
  - 测试表单验证
  - 测试提交处理
  - 测试取消操作
  - _需求: 1.4, 3.5_

- [x] 5.5 创建ArticleSettingList列表组件
  - 创建client/src/components/ArticleSettingList.tsx
  - 使用Ant Design Table组件
  - 定义列（名称、提示词预览、创建时间、操作）
  - 实现操作按钮（查看、编辑、删除）
  - 实现空状态显示
  - _需求: 2.1, 2.4, 2.5, 4.1_

- [ ] 5.6 编写属性测试：记录渲染完整性
  - **属性 4: 记录渲染完整性**
  - **验证: 需求 2.4**

- [ ] 5.7 编写属性测试：详情显示完整性
  - **属性 7: 详情显示完整性**
  - **验证: 需求 5.2**

- [ ] 6. 集成导航和路由
- [x] 6.1 更新侧边栏组件
  - 在client/src/components/Layout/Sidebar.tsx中添加菜单项
  - 使用EditOutlined图标
  - 设置路由key为/article-settings
  - 放置在"企业知识库"下方
  - _需求: 7.1, 7.2, 7.3, 7.4_

- [ ] 6.2 编写单元测试：侧边栏菜单项
  - 测试菜单项显示
  - 测试导航功能
  - 测试活动状态高亮
  - _需求: 7.1, 7.2, 7.3_

- [x] 6.3 更新App路由配置
  - 在client/src/App.tsx中添加路由
  - 导入ArticleSettingsPage组件
  - 添加Route配置
  - _需求: 7.2_

- [ ] 7. 数据库迁移和初始化
- [x] 7.1 运行数据库迁移
  - 执行迁移脚本创建article_settings表
  - 验证表结构正确
  - 验证索引已创建
  - _需求: 8.1, 8.2_

- [ ] 7.2 编写属性测试：数据持久化验证
  - **属性 11: 数据持久化验证**
  - **验证: 需求 8.5**

- [ ] 8. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户
