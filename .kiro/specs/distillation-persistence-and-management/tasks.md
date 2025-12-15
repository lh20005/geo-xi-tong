# Implementation Plan

- [x] 1. 实现后端API端点
  - 添加新的REST API端点支持蒸馏记录的完整CRUD操作
  - 实现参数验证和错误处理
  - 确保数据库操作的事务性和级联删除
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 1.1 实现获取单条蒸馏记录详情的API端点
  - 在 `server/src/routes/distillation.ts` 中添加 `GET /api/distillation/:id` 端点
  - 使用JOIN查询获取蒸馏记录及其所有关联的话题
  - 验证记录ID的有效性，不存在时返回404
  - 返回包含关键词、提供商、创建时间和问题列表的完整数据
  - _Requirements: 2.1, 7.1_

- [ ]* 1.2 编写属性测试：获取历史记录详情完整性
  - **Feature: distillation-persistence-and-management, Property 3: 获取历史记录详情完整性**
  - **Validates: Requirements 2.1**
  - 使用fast-check生成随机蒸馏记录和话题数据
  - 验证API返回的问题列表与数据库中的完全一致
  - 配置运行100次迭代

- [ ]* 1.3 编写属性测试：无效ID验证拒绝
  - **Feature: distillation-persistence-and-management, Property 9: 无效ID验证拒绝**
  - **Validates: Requirements 7.1, 7.3**
  - 使用fast-check生成各种无效ID（负数、零、不存在的ID）
  - 验证所有无效ID都返回错误响应
  - 配置运行100次迭代

- [x] 1.4 实现删除单条蒸馏记录的API端点
  - 在 `server/src/routes/distillation.ts` 中添加 `DELETE /api/distillation/:id` 端点
  - 验证记录ID的有效性
  - 使用数据库事务确保记录和关联话题的级联删除
  - 返回成功状态和确认消息
  - _Requirements: 3.1, 3.2, 3.4, 7.1, 7.2_

- [ ]* 1.5 编写属性测试：删除记录的级联效果
  - **Feature: distillation-persistence-and-management, Property 4: 删除记录的级联效果**
  - **Validates: Requirements 3.1, 3.2, 3.4, 7.2**
  - 使用fast-check生成随机蒸馏记录和话题
  - 执行删除操作后验证记录和所有关联话题都被删除
  - 配置运行100次迭代

- [x] 1.6 实现更新蒸馏记录关键词的API端点
  - 在 `server/src/routes/distillation.ts` 中添加 `PATCH /api/distillation/:id` 端点
  - 验证记录ID和新关键词的有效性
  - 拒绝空白字符串（空字符串、纯空格等）
  - 更新数据库中的关键词字段
  - 返回成功状态和确认消息
  - _Requirements: 4.3, 4.5, 7.3, 7.4_

- [ ]* 1.7 编写属性测试：更新关键词的持久性
  - **Feature: distillation-persistence-and-management, Property 5: 更新关键词的持久性**
  - **Validates: Requirements 4.3, 7.4**
  - 使用fast-check生成随机蒸馏记录和新关键词
  - 验证更新后数据库中的关键词与新关键词一致
  - 配置运行100次迭代

- [ ]* 1.8 编写属性测试：空白关键词验证拒绝
  - **Feature: distillation-persistence-and-management, Property 6: 空白关键词验证拒绝**
  - **Validates: Requirements 4.5**
  - 使用fast-check生成各种空白字符串（空字符串、空格、制表符等）
  - 验证所有空白字符串都被拒绝并返回验证错误
  - 配置运行100次迭代

- [x] 1.9 实现删除所有蒸馏记录的API端点
  - 在 `server/src/routes/distillation.ts` 中添加 `DELETE /api/distillation/all` 端点
  - 使用数据库事务删除所有蒸馏记录和关联话题
  - 返回成功状态、确认消息和删除数量
  - _Requirements: 5.2, 7.5_

- [ ]* 1.10 编写属性测试：全部删除的完整性
  - **Feature: distillation-persistence-and-management, Property 7: 全部删除的完整性**
  - **Validates: Requirements 5.2, 7.5**
  - 使用fast-check生成随机数量的蒸馏记录
  - 执行全部删除后验证数据库中没有任何蒸馏记录和话题
  - 配置运行100次迭代

- [ ]* 1.11 编写属性测试：API响应格式一致性
  - **Feature: distillation-persistence-and-management, Property 10: API响应格式一致性**
  - **Validates: Requirements 7.6, 7.7**
  - 测试所有API端点的成功和失败场景
  - 验证成功时返回2xx状态码，失败时返回4xx/5xx状态码
  - 验证响应包含适当的消息
  - 配置运行100次迭代

- [x] 2. 实现前端LocalStorage持久化功能
  - 创建LocalStorage工具函数
  - 实现蒸馏结果的保存、读取和清除
  - 在组件挂载时自动恢复保存的结果
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [x] 2.1 创建LocalStorage工具函数
  - 在 `client/src/pages/DistillationPage.tsx` 中添加工具函数
  - 实现 `saveResultToLocalStorage(result)` - 保存结果到本地存储
  - 实现 `loadResultFromLocalStorage()` - 从本地存储加载结果
  - 实现 `clearResultFromLocalStorage()` - 清除本地存储的结果
  - 添加错误处理（存储空间不足、JSON解析错误等）
  - _Requirements: 1.1, 1.2, 1.5_

- [ ]* 2.2 编写属性测试：LocalStorage持久化往返一致性
  - **Feature: distillation-persistence-and-management, Property 1: LocalStorage持久化往返一致性**
  - **Validates: Requirements 1.1, 1.2**
  - 使用fast-check生成随机蒸馏结果
  - 保存到LocalStorage后读取，验证数据一致性
  - 配置运行100次迭代

- [ ]* 2.3 编写属性测试：LocalStorage更新替换旧数据
  - **Feature: distillation-persistence-and-management, Property 2: LocalStorage更新替换旧数据**
  - **Validates: Requirements 1.5**
  - 使用fast-check生成两个不同的蒸馏结果
  - 依次保存后验证只有最新结果存在
  - 配置运行100次迭代

- [x] 2.4 在组件中集成LocalStorage功能
  - 修改 `handleDistill` 函数，蒸馏成功后调用 `saveResultToLocalStorage`
  - 添加 `useEffect` 钩子，组件挂载时调用 `loadResultFromLocalStorage`
  - 如果加载到结果，设置到 `result` 状态中显示
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [x] 3. 实现前端查看历史记录详情功能
  - 添加点击历史记录查看详情的功能
  - 在蒸馏结果区域显示选中的历史记录
  - 高亮显示当前选中的记录
  - _Requirements: 2.1, 2.2_

- [x] 3.1 实现查看历史记录详情的处理函数
  - 在 `DistillationPage.tsx` 中添加 `handleViewHistory` 函数
  - 调用 `GET /api/distillation/:id` API获取完整的问题列表
  - 将获取的数据设置到 `result` 状态中
  - 添加 `selectedRecordId` 状态跟踪当前选中的记录
  - 添加错误处理和loading状态
  - _Requirements: 2.1_

- [x] 3.2 修改历史记录表格添加查看详情按钮
  - 在表格的操作列添加"查看详情"按钮
  - 点击按钮时调用 `handleViewHistory` 函数
  - 使用 `selectedRecordId` 状态高亮显示当前选中的行
  - _Requirements: 2.1, 2.2_

- [x] 4. 实现前端删除单条记录功能
  - 在蒸馏结果区域和历史表格中添加删除按钮
  - 实现删除确认对话框
  - 调用后端API删除记录
  - 更新UI和LocalStorage
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4.1 实现删除单条记录的处理函数
  - 在 `DistillationPage.tsx` 中添加 `handleDeleteRecord` 函数
  - 使用 `Modal.confirm` 显示删除确认对话框
  - 用户确认后调用 `DELETE /api/distillation/:id` API
  - 删除成功后刷新历史记录列表
  - 如果删除的是当前显示的记录，清空 `result` 状态和LocalStorage
  - 显示成功或错误提示
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4.2 在蒸馏结果卡片添加删除按钮
  - 在蒸馏结果卡片的底部或extra区域添加删除按钮
  - 点击按钮时调用 `handleDeleteRecord(result.distillationId)`
  - 只在有结果显示时显示按钮
  - _Requirements: 3.1, 6.1, 6.5_

- [x] 4.3 在历史记录表格添加删除按钮
  - 在表格的操作列添加删除按钮
  - 点击按钮时调用 `handleDeleteRecord(record.id)`
  - _Requirements: 3.2, 6.3_

- [x] 5. 实现前端编辑关键词功能
  - 在蒸馏结果区域和历史表格中添加编辑按钮
  - 实现编辑对话框
  - 调用后端API更新关键词
  - 更新UI显示
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 5.1 实现编辑关键词的处理函数
  - 在 `DistillationPage.tsx` 中添加 `handleEditKeyword` 函数
  - 使用 `Modal` 显示编辑对话框，包含输入框和当前关键词
  - 验证输入不为空白字符串
  - 用户确认后调用 `PATCH /api/distillation/:id` API
  - 更新成功后刷新历史记录列表和当前显示的结果
  - 显示成功或错误提示
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 5.2 在蒸馏结果卡片添加编辑按钮
  - 在蒸馏结果卡片的底部或extra区域添加编辑按钮
  - 点击按钮时调用 `handleEditKeyword(result.distillationId, result.keyword)`
  - 只在有结果显示时显示按钮
  - _Requirements: 4.1, 6.1, 6.5_

- [x] 5.3 在历史记录表格添加编辑按钮
  - 在表格的操作列添加编辑按钮
  - 点击按钮时调用 `handleEditKeyword(record.id, record.keyword)`
  - _Requirements: 4.2, 6.3_

- [x] 6. 实现前端全部删除功能
  - 在蒸馏历史区域添加全部删除按钮
  - 实现删除确认对话框（警告不可恢复）
  - 调用后端API删除所有记录
  - 清空UI和LocalStorage
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 6.1 实现全部删除的处理函数
  - 在 `DistillationPage.tsx` 中添加 `handleDeleteAll` 函数
  - 使用 `Modal.confirm` 显示警告对话框，提示操作不可恢复
  - 用户确认后调用 `DELETE /api/distillation/all` API
  - 删除成功后清空 `history` 和 `result` 状态
  - 调用 `clearResultFromLocalStorage` 清除本地存储
  - 显示成功或错误提示
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ]* 6.2 编写属性测试：全部删除清除本地存储
  - **Feature: distillation-persistence-and-management, Property 8: 全部删除清除本地存储**
  - **Validates: Requirements 5.5**
  - 使用fast-check生成随机蒸馏结果并保存到LocalStorage
  - 执行全部删除后验证LocalStorage被清除
  - 配置运行100次迭代

- [x] 6.3 在蒸馏历史卡片添加全部删除按钮
  - 在蒸馏历史卡片的extra区域添加全部删除按钮
  - 点击按钮时调用 `handleDeleteAll`
  - 使用危险样式（danger）突出显示
  - _Requirements: 5.1, 6.2_

- [x] 7. 优化UI和用户体验
  - 调整按钮布局和样式
  - 添加loading状态和禁用状态
  - 优化错误提示信息
  - 添加空状态提示
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 7.1 优化蒸馏结果卡片的按钮布局
  - 在卡片底部添加操作按钮区域
  - 使用 `Space` 组件排列删除和编辑按钮
  - 添加图标提升可识别性
  - 确保按钮在loading时禁用
  - _Requirements: 6.1, 6.4, 6.5_

- [x] 7.2 优化历史记录表格的操作列
  - 重新排列操作列的按钮顺序（查看详情、编辑、删除）
  - 使用不同的按钮类型区分操作（link、primary、danger）
  - 添加图标提升可识别性
  - _Requirements: 6.3, 6.4_

- [x] 7.3 添加空状态提示
  - 当历史记录为空时显示友好的空状态组件
  - 使用Ant Design的Empty组件
  - 提供引导文案
  - _Requirements: 2.3_

- [x] 8. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户
