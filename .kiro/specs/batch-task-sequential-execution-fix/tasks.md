# Implementation Plan: Batch Task Sequential Execution Fix

## Overview

本实现计划将修复批次任务的串行执行和超时控制问题。实现将分为以下几个阶段：
1. 添加超时控制机制
2. 修复批次串行执行
3. 实现超时任务检测
4. 添加资源清理保证
5. 测试和验证

## Tasks

- [x] 1. 添加超时控制基础设施
  - 创建TaskTimeoutError错误类
  - 在publishing_tasks表中添加timeout状态支持
  - 更新TypeScript类型定义
  - _Requirements: 2.1, 2.3, 8.1, 8.2_

- [x] 1.1 编写超时错误类的单元测试
  - 测试TaskTimeoutError的创建和属性
  - _Requirements: 2.1_

- [x] 2. 实现Publishing Executor的超时控制
  - [x] 2.1 修改executeTask方法添加超时参数
    - 从任务config中读取timeout_minutes
    - 使用默认值15分钟
    - _Requirements: 2.1, 8.2, 8.5_

  - [x] 2.2 实现Promise.race超时机制
    - 创建超时Promise
    - 创建执行Promise
    - 使用Promise.race控制超时
    - _Requirements: 2.2_

  - [x] 2.3 实现超时错误处理
    - 修改handleTaskFailure支持isTimeout参数
    - 超时时更新状态为timeout
    - 根据retry_count决定pending或failed
    - _Requirements: 2.3, 3.1, 3.2_

  - [x] 2.4 实现资源清理保证
    - 创建cleanupBrowser方法
    - 在finally块中调用清理方法
    - 处理清理失败的情况
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 2.5 编写超时控制的属性测试
  - **Property 2: 任务超时终止**
  - **Validates: Requirements 2.2, 2.3**
  - 生成随机超时时间
  - 模拟长时间运行的任务
  - 验证任务在超时后被终止

- [x] 2.6 编写超时重试逻辑的属性测试
  - **Property 3: 超时任务重试逻辑**
  - **Validates: Requirements 3.1, 3.2**
  - 生成随机retry_count和max_retries
  - 验证状态转换正确

- [x] 3. 修复Batch Executor的串行执行
  - [x] 3.1 确保任务同步执行
    - 使用await等待任务完成
    - 移除异步执行逻辑
    - _Requirements: 1.1, 1.2_

  - [x] 3.2 实现任务状态同步检查
    - 执行前从数据库查询最新状态
    - 跳过非pending状态的任务
    - 执行后查询最终状态
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 3.3 修复间隔时间执行
    - 确保waitWithStopCheck被正确调用
    - 验证间隔时间计算正确
    - 记录等待开始和结束时间
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 3.4 添加批次执行顺序验证
    - 按batch_order排序任务
    - 记录任务执行顺序
    - _Requirements: 1.5_

- [x] 3.5 编写串行执行的属性测试
  - **Property 1: 批次任务串行执行**
  - **Validates: Requirements 1.1, 1.2, 1.3, 1.5**
  - 生成随机批次（2-5个任务）
  - 记录任务开始和完成时间
  - 验证时间顺序正确

- [x] 3.6 编写间隔时间精确性的属性测试
  - **Property 5: 间隔时间精确性**
  - **Validates: Requirements 5.2**
  - 生成随机interval_minutes
  - 验证实际等待时间在±2秒范围内

- [x] 4. 实现Task Scheduler的超时检测
  - [x] 4.1 添加detectTimeoutTasks方法
    - 查询running状态的任务
    - 计算执行时长
    - 标记超时任务
    - _Requirements: 10.1, 10.2_

  - [x] 4.2 实现超时任务处理
    - 更新状态为timeout
    - 增加retry_count
    - 根据重试次数决定pending或failed
    - 清理浏览器进程
    - _Requirements: 10.3, 10.4_

  - [x] 4.3 集成超时检测到调度循环
    - 在checkAndExecuteTasks开始时调用detectTimeoutTasks
    - 确保超时检测不阻塞任务调度
    - _Requirements: 10.1_

- [x] 4.4 编写超时检测的属性测试
  - **Property 9: 超时任务检测**
  - **Validates: Requirements 10.1, 10.4**
  - 生成随机超时任务
  - 验证调度器正确检测和处理

- [x] 4.5 编写超时不阻塞批次的属性测试
  - **Property 10: 超时不阻塞批次**
  - **Validates: Requirements 10.5**
  - 创建包含超时任务的批次
  - 验证批次继续执行

- [x] 5. 增强Browser Automation Service
  - [x] 5.1 添加forceCloseBrowser方法
    - 实现强制关闭逻辑
    - 处理关闭失败情况
    - _Requirements: 7.2, 7.4_

  - [x] 5.2 添加isBrowserRunning方法
    - 检查浏览器实例状态
    - _Requirements: 7.1_

  - [x] 5.3 修改closeBrowser处理异常
    - 捕获关闭异常
    - 记录错误但不抛出
    - 尝试强制关闭
    - _Requirements: 7.4_

- [x] 5.4 编写资源清理的属性测试
  - **Property 7: 浏览器资源清理**
  - **Validates: Requirements 7.1, 7.2, 7.3, 7.5**
  - 生成随机任务结果（成功/失败/超时）
  - 验证浏览器总是被关闭

- [x] 6. 添加超时配置管理
  - [x] 6.1 更新任务创建接口
    - 允许指定timeout_minutes
    - 验证超时时间范围（最小1分钟）
    - 记录大值警告（>60分钟）
    - _Requirements: 8.1, 8.3, 8.4_

  - [x] 6.2 更新任务配置类型
    - 在PublishingTask接口中添加timeout_minutes
    - 更新相关类型定义
    - _Requirements: 8.1_

- [x] 6.3 编写超时配置的单元测试
  - 测试默认值15分钟
  - 测试最小值1分钟
  - 测试大值警告
  - _Requirements: 8.2, 8.3, 8.4_

- [x] 6.4 编写超时配置有效性的属性测试
  - **Property 8: 超时配置有效性**
  - **Validates: Requirements 8.2, 8.3, 8.5**
  - 生成随机超时配置
  - 验证配置被正确应用

- [x] 7. 增强批次执行锁机制
  - [x] 7.1 验证批次锁的正确性
    - 确保executingBatches在开始时添加
    - 确保在finally块中移除
    - _Requirements: 6.1, 6.3, 6.4_

  - [x] 7.2 添加批次锁查询接口
    - 实现getExecutingBatches方法
    - 返回当前执行中的批次列表
    - _Requirements: 6.5_

- [x] 7.3 编写批次锁的属性测试
  - **Property 6: 批次执行锁**
  - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
  - 尝试并发执行同一批次
  - 验证只有一个执行成功
  - 验证锁总是被释放

- [x] 8. 增强日志记录
  - [x] 8.1 添加批次执行日志
    - 记录批次开始（ID、任务总数）
    - 记录任务开始（序号、ID、文章信息）
    - 记录任务完成（结果、耗时）
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 8.2 添加间隔等待日志
    - 记录等待开始（时长、预计下次执行时间）
    - 记录等待完成（实际等待时间）
    - _Requirements: 9.4_

  - [x] 8.3 添加批次完成日志
    - 记录总耗时
    - 记录各状态任务数量
    - _Requirements: 9.5_

- [x] 8.4 编写日志记录的单元测试
  - 验证批次开始日志
  - 验证任务执行日志
  - 验证批次完成日志
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 9. 数据库Schema更新
  - [x] 9.1 添加timeout状态支持
    - 修改status约束添加timeout
    - 创建迁移脚本
    - _Requirements: 2.3_

  - [x] 9.2 验证config字段支持
    - 确认config可以存储timeout_minutes
    - 测试JSON序列化和反序列化
    - _Requirements: 8.1_

- [x] 9.3 编写数据库迁移测试
  - 测试迁移脚本执行
  - 验证约束正确添加
  - _Requirements: 2.3_

- [x] 10. Checkpoint - 核心功能验证
  - 运行所有单元测试和属性测试
  - 手动测试批次串行执行
  - 手动测试任务超时控制
  - 确认所有测试通过，询问用户是否有问题

- [x] 11. 集成测试
  - [x] 11.1 编写完整批次执行流程测试
    - 创建包含3个任务的批次
    - 设置间隔时间为1分钟
    - 验证任务按顺序执行
    - 验证间隔时间正确
    - _Requirements: 1.1, 1.2, 1.3, 5.2_

  - [x] 11.2 编写超时任务重试流程测试
    - 创建会超时的任务
    - 设置max_retries=2
    - 验证任务超时后重试
    - 验证重试次数用完后标记为failed
    - _Requirements: 2.2, 3.1, 3.2_

  - [x] 11.3 编写批次停止流程测试
    - 创建包含5个任务的批次
    - 在第2个任务完成后停止
    - 验证剩余任务被取消
    - 验证文章锁被释放
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 11.4 编写非pending任务跳过的属性测试
  - **Property 4: 非pending任务跳过**
  - **Validates: Requirements 4.2, 4.4**
  - 生成包含不同状态任务的批次
  - 验证非pending任务被跳过

- [x] 12. 最终验证和文档
  - [x] 12.1 运行完整测试套件
    - 运行所有单元测试
    - 运行所有属性测试（最少100次迭代）
    - 运行所有集成测试
    - _Requirements: All_

  - [x] 12.2 手动测试关键场景
    - 测试3个任务批次，间隔5分钟
    - 测试任务超时和重试
    - 测试批次停止功能
    - _Requirements: All_

  - [x] 12.3 更新相关文档
    - 更新API文档
    - 更新用户指南
    - 记录已知限制
    - _Requirements: All_

- [x] 13. Final Checkpoint - 确保所有测试通过
  - 确保所有测试通过，询问用户是否有问题

## Notes

- 所有任务都是必需的，包含完整的测试覆盖
- 每个任务都引用了具体的需求编号以便追溯
- 属性测试必须运行最少100次迭代
- 超时测试使用较短的超时时间（10-30秒）以加快测试速度
- 集成测试使用真实的数据库和浏览器实例
- Checkpoint任务确保增量验证
