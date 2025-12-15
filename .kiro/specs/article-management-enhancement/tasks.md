# Implementation Plan

- [x] 1. 创建统计API端点
  - 实现GET /api/articles/stats端点返回总数、已发布数、未发布数
  - 实现GET /api/articles/stats/keywords端点返回关键词分组统计
  - 使用高效的SQL查询（COUNT FILTER）
  - 添加错误处理和参数验证
  - _Requirements: 3.1, 3.2, 3.4_

- [ ]* 1.1 编写属性测试：统计数据准确性
  - **Property 1: 统计数据准确性**
  - **Validates: Requirements 1.1, 1.2**

- [ ]* 1.2 编写属性测试：关键词统计完整性
  - **Property 2: 关键词统计完整性**
  - **Validates: Requirements 2.1, 2.4**

- [ ]* 1.3 编写单元测试：统计API端点
  - 测试统计数据格式正确
  - 测试空数据库返回0
  - 测试错误场景处理
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 2. 增强文章列表API支持多条件筛选
  - 修改GET /api/articles端点添加筛选参数（publishStatus, distillationId, keyword）
  - 实现动态SQL查询构建，支持参数化查询
  - 添加ILIKE搜索支持（不区分大小写）
  - 确保筛选条件使用AND逻辑组合
  - 添加参数验证和SQL注入防护
  - _Requirements: 4.2, 4.3, 4.4, 5.3, 6.2, 11.1, 11.2, 11.3_

- [ ]* 2.1 编写属性测试：发布状态筛选正确性
  - **Property 3: 发布状态筛选正确性**
  - **Validates: Requirements 4.2, 4.3, 4.4**

- [ ]* 2.2 编写属性测试：话题筛选正确性
  - **Property 4: 话题筛选正确性**
  - **Validates: Requirements 5.3**

- [ ]* 2.3 编写属性测试：关键词搜索正确性
  - **Property 5: 关键词搜索正确性**
  - **Validates: Requirements 6.2**

- [ ]* 2.4 编写属性测试：组合筛选AND逻辑
  - **Property 6: 组合筛选AND逻辑**
  - **Validates: Requirements 11.1, 11.2, 11.3**

- [ ]* 2.5 编写属性测试：筛选条件独立性
  - **Property 14: 筛选条件独立性**
  - **Validates: Requirements 11.4**

- [ ]* 2.6 编写单元测试：筛选API端点
  - 测试单个筛选条件
  - 测试组合筛选条件
  - 测试特殊字符转义
  - 测试空结果处理
  - _Requirements: 4.2, 5.3, 6.2, 6.5_

- [x] 3. 创建批量删除和删除所有API端点
  - 实现DELETE /api/articles/batch端点接收ID数组
  - 实现DELETE /api/articles/all端点删除所有文章
  - 使用数据库事务确保原子性
  - 在删除文章时更新对应蒸馏结果的usage_count
  - 处理不存在的ID（跳过并继续）
  - 返回删除数量统计
  - _Requirements: 8.4, 9.4, 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ]* 3.1 编写属性测试：批量删除原子性
  - **Property 7: 批量删除原子性**
  - **Validates: Requirements 8.4, 10.2, 10.3**

- [ ]* 3.2 编写属性测试：删除后统计一致性
  - **Property 8: 删除后统计一致性**
  - **Validates: Requirements 8.5, 1.2**

- [ ]* 3.3 编写属性测试：删除后usage_count一致性
  - **Property 9: 删除后usage_count一致性**
  - **Validates: Requirements 10.1**

- [ ]* 3.4 编写属性测试：级联删除完整性
  - **Property 10: 级联删除完整性**
  - **Validates: Requirements 10.4**

- [ ]* 3.5 编写单元测试：批量删除API
  - 测试批量删除成功场景
  - 测试删除所有成功场景
  - 测试事务回滚
  - 测试不存在的ID处理
  - 测试空ID列表
  - _Requirements: 8.4, 9.4, 10.2, 10.5_

- [x] 4. 添加数据库索引优化查询性能
  - 创建idx_articles_is_published索引
  - 创建idx_articles_distillation_id索引
  - 创建idx_articles_keyword索引
  - 验证索引创建成功
  - 测试查询性能提升
  - _Requirements: 3.3_

- [x] 5. Checkpoint - 确保后端测试通过
  - 确保所有测试通过，如有问题请询问用户

- [ ] 6. 创建统计卡片组件
  - 创建StatsCard组件显示单个统计项
  - 实现三个统计卡片：总数、已发布、未发布
  - 添加点击事件触发对应筛选
  - 使用不同颜色区分不同统计项
  - 添加加载状态和错误处理
  - _Requirements: 1.1, 1.3_

- [ ]* 6.1 编写单元测试：统计卡片组件
  - 测试统计数据正确显示
  - 测试点击事件触发筛选
  - 测试加载和错误状态
  - _Requirements: 1.1, 1.3_

- [x] 7. 创建筛选工具栏组件
  - 创建FilterToolbar组件
  - 实现发布状态下拉框（全部/已发布/未发布）
  - 实现话题下拉框（从API加载话题列表）
  - 实现关键词搜索输入框（带搜索按钮）
  - 添加清除筛选按钮
  - 实现筛选条件变更回调
  - _Requirements: 4.1, 5.1, 6.1_

- [ ]* 7.1 编写属性测试：话题列表完整性
  - **Property 13: 话题列表完整性**
  - **Validates: Requirements 5.2**

- [ ]* 7.2 编写单元测试：筛选工具栏组件
  - 测试筛选条件变更
  - 测试清除筛选
  - 测试话题列表加载
  - _Requirements: 4.1, 5.1, 6.1_

- [x] 8. 实现批量操作功能
  - 在表格中添加复选框列
  - 实现表头全选/取消全选逻辑
  - 实现单行复选框切换逻辑
  - 创建BatchActions组件显示选中数量和操作按钮
  - 实现跨页选中状态保持（使用Set存储ID）
  - 筛选条件变更时清空选中状态
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ]* 8.1 编写属性测试：选中状态跨页保持
  - **Property 11: 选中状态跨页保持**
  - **Validates: Requirements 7.4**

- [ ]* 8.2 编写单元测试：批量操作功能
  - 测试全选逻辑
  - 测试单选逻辑
  - 测试跨页状态保持
  - 测试筛选清空选中
  - _Requirements: 7.2, 7.3, 7.4, 7.5_

- [x] 9. 实现删除操作UI和逻辑
  - 实现"删除选中"按钮和确认对话框
  - 实现"删除所有"按钮和确认对话框
  - 调用批量删除API
  - 删除成功后刷新文章列表和统计数据
  - 清空选中状态
  - 显示成功/失败消息
  - _Requirements: 8.1, 8.2, 8.3, 8.5, 9.1, 9.2, 9.3, 9.5_

- [ ]* 9.1 编写单元测试：删除操作UI
  - 测试按钮状态（启用/禁用）
  - 测试确认对话框显示
  - 测试删除成功后的UI更新
  - _Requirements: 8.1, 8.2, 9.1, 9.2_

- [x] 10. 实现URL状态同步
  - 实现筛选条件到URL参数的转换
  - 实现URL参数到筛选条件的解析
  - 使用useEffect监听筛选条件变更并更新URL
  - 使用useEffect监听URL变更并恢复筛选条件
  - 处理无效URL参数（使用默认值）
  - 使用replace模式避免历史记录堆积
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [ ]* 10.1 编写属性测试：URL状态同步
  - **Property 12: URL状态同步**
  - **Validates: Requirements 12.1, 12.2, 12.3**

- [ ]* 10.2 编写单元测试：URL状态管理
  - 测试筛选条件转URL参数
  - 测试URL参数转筛选条件
  - 测试无效参数处理
  - _Requirements: 12.1, 12.2, 12.4_

- [x] 11. 集成所有功能到ArticleListPage
  - 在页面顶部添加统计卡片区域
  - 在表格上方添加筛选工具栏
  - 在表格上方添加批量操作工具栏
  - 实现数据加载逻辑（文章列表、统计数据）
  - 实现筛选条件变更时的数据刷新
  - 实现删除操作后的数据刷新
  - 添加加载状态和错误处理
  - _Requirements: 1.1, 2.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1_

- [ ]* 11.1 编写集成测试：完整用户流程
  - 测试加载页面 → 查看统计
  - 测试应用筛选 → 验证结果
  - 测试选中文章 → 批量删除
  - 测试URL状态 → 刷新恢复
  - _Requirements: 1.1, 4.2, 7.2, 8.4, 12.2_

- [ ] 12. Final Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户
