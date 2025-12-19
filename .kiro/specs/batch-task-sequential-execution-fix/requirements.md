# Requirements Document

## Introduction

本文档定义了批次任务串行执行和超时控制的需求。当前系统存在严重问题：批次中的任务没有正确串行执行，第一个任务卡住时，后续任务仍然启动；任务之间的间隔时间没有被正确遵守。这导致批次任务的执行顺序混乱，违反了用户的预期。

## Glossary

- **Batch**: 一组按顺序执行的发布任务，任务之间有指定的间隔时间
- **Batch_Executor**: 负责串行执行批次任务的服务
- **Task_Timeout**: 单个任务的最大执行时间限制
- **Interval_Time**: 批次中连续任务之间的等待时间（分钟）
- **Task_Status**: 任务的当前状态（pending, running, success, failed, cancelled, timeout）
- **Sequential_Execution**: 批次任务必须按顺序一个接一个执行，前一个任务完成后才能开始下一个
- **Task_Lock**: 确保同一批次中只有一个任务在执行的机制

## Requirements

### Requirement 1: 批次任务串行执行保证

**User Story:** 作为用户，我希望批次中的任务严格按顺序执行，前一个任务完成后才开始下一个，这样我可以控制发布节奏。

#### Acceptance Criteria

1. WHEN 批次开始执行时，THE Batch_Executor SHALL 确保同一时间只有一个任务在执行
2. WHEN 一个任务正在执行时，THE Batch_Executor SHALL 阻塞等待该任务完成
3. WHEN 一个任务完成（成功或失败）后，THE Batch_Executor SHALL 等待指定的间隔时间
4. WHEN 间隔时间结束后，THE Batch_Executor SHALL 开始执行下一个任务
5. WHEN 批次中有多个任务时，THE Batch_Executor SHALL 按照 batch_order 顺序执行

### Requirement 2: 任务执行超时控制

**User Story:** 作为用户，我希望卡住的任务能够自动超时，这样不会阻塞整个批次的执行。

#### Acceptance Criteria

1. WHEN 任务开始执行时，THE Publishing_Executor SHALL 设置超时计时器（默认15分钟）
2. WHEN 任务执行时间超过超时限制时，THE Publishing_Executor SHALL 终止任务执行
3. WHEN 任务超时时，THE Publishing_Executor SHALL 更新任务状态为 timeout
4. WHEN 任务超时时，THE Publishing_Executor SHALL 关闭浏览器和页面
5. WHEN 任务超时时，THE Publishing_Executor SHALL 记录超时日志和错误信息

### Requirement 3: 超时任务的重试机制

**User Story:** 作为用户，我希望超时的任务能够自动重试，这样临时的网络问题不会导致任务永久失败。

#### Acceptance Criteria

1. WHEN 任务因超时失败且重试次数小于最大重试次数时，THE Publishing_Executor SHALL 将任务状态设置为 pending
2. WHEN 任务因超时失败且重试次数达到最大值时，THE Publishing_Executor SHALL 将任务状态设置为 failed
3. WHEN 超时任务被标记为 pending 时，THE Task_Scheduler SHALL 在下次检查时重新执行该任务
4. WHEN 记录超时重试时，THE Publishing_Executor SHALL 在日志中包含重试次数
5. WHEN 超时任务重试时，THE Publishing_Executor SHALL 使用相同的超时限制

### Requirement 4: 批次执行状态同步

**User Story:** 作为开发者，我希望批次执行器能够实时检测任务状态变化，这样可以正确处理任务取消和失败。

#### Acceptance Criteria

1. WHEN 开始执行批次任务前，THE Batch_Executor SHALL 从数据库查询最新的任务状态
2. WHEN 任务状态不是 pending 时，THE Batch_Executor SHALL 跳过该任务
3. WHEN 任务执行完成后，THE Batch_Executor SHALL 从数据库查询最终状态
4. WHEN 任务状态为 timeout 时，THE Batch_Executor SHALL 将其视为失败并继续下一个任务
5. WHEN 批次中所有任务完成时，THE Batch_Executor SHALL 记录最终统计信息

### Requirement 5: 间隔时间精确执行

**User Story:** 作为用户，我希望任务之间的间隔时间被精确执行，这样可以避免平台的频率限制。

#### Acceptance Criteria

1. WHEN 任务完成后，THE Batch_Executor SHALL 读取该任务的 interval_minutes 配置
2. WHEN interval_minutes 大于 0 时，THE Batch_Executor SHALL 等待精确的分钟数
3. WHEN 等待期间，THE Batch_Executor SHALL 每秒检查一次停止信号
4. WHEN 等待完成后，THE Batch_Executor SHALL 记录实际等待时间
5. WHEN interval_minutes 为 0 或 null 时，THE Batch_Executor SHALL 立即执行下一个任务

### Requirement 6: 任务执行锁机制

**User Story:** 作为开发者，我希望有明确的锁机制防止同一批次的任务并发执行，这样可以保证执行顺序。

#### Acceptance Criteria

1. WHEN 批次开始执行时，THE Batch_Executor SHALL 将 batch_id 添加到执行集合
2. WHEN 批次已在执行集合中时，THE Batch_Executor SHALL 拒绝重复执行
3. WHEN 批次执行完成时，THE Batch_Executor SHALL 从执行集合中移除 batch_id
4. WHEN 批次执行异常时，THE Batch_Executor SHALL 在 finally 块中移除 batch_id
5. WHEN 查询执行中的批次时，THE System SHALL 返回执行集合中的所有 batch_id

### Requirement 7: 浏览器资源清理

**User Story:** 作为系统管理员，我希望任务完成或超时后能够正确清理浏览器资源，这样不会造成资源泄漏。

#### Acceptance Criteria

1. WHEN 任务正常完成时，THE Publishing_Executor SHALL 关闭页面和浏览器
2. WHEN 任务超时时，THE Publishing_Executor SHALL 强制关闭页面和浏览器
3. WHEN 任务失败时，THE Publishing_Executor SHALL 关闭页面和浏览器
4. WHEN 关闭浏览器失败时，THE Publishing_Executor SHALL 记录错误但不抛出异常
5. WHEN 批次中的任务执行时，THE Publishing_Executor SHALL 为每个任务使用独立的浏览器实例

### Requirement 8: 超时配置管理

**User Story:** 作为用户，我希望能够配置任务的超时时间，这样可以根据不同平台调整超时限制。

#### Acceptance Criteria

1. WHEN 创建任务时，THE System SHALL 允许用户指定超时时间（分钟）
2. WHEN 未指定超时时间时，THE System SHALL 使用默认值 15 分钟
3. WHEN 超时时间小于 1 分钟时，THE System SHALL 使用最小值 1 分钟
4. WHEN 超时时间大于 60 分钟时，THE System SHALL 记录警告但仍使用该值
5. WHEN 执行任务时，THE Publishing_Executor SHALL 使用任务配置中的超时时间

### Requirement 9: 批次执行日志增强

**User Story:** 作为用户，我希望看到详细的批次执行日志，这样可以了解每个任务的执行情况和等待时间。

#### Acceptance Criteria

1. WHEN 批次开始执行时，THE Batch_Executor SHALL 记录批次 ID 和任务总数
2. WHEN 开始执行任务时，THE Batch_Executor SHALL 记录任务序号、ID 和文章信息
3. WHEN 任务完成时，THE Batch_Executor SHALL 记录执行结果和耗时
4. WHEN 开始等待间隔时，THE Batch_Executor SHALL 记录等待时长和预计下次执行时间
5. WHEN 批次完成时，THE Batch_Executor SHALL 记录总耗时和各状态任务数量

### Requirement 10: 任务卡住检测和恢复

**User Story:** 作为系统管理员，我希望系统能够检测到卡住的任务并自动恢复，这样不需要手动干预。

#### Acceptance Criteria

1. WHEN 任务状态为 running 且超过超时时间时，THE Task_Scheduler SHALL 将其标记为 timeout
2. WHEN 检测到超时任务时，THE Task_Scheduler SHALL 记录超时检测日志
3. WHEN 超时任务被标记后，THE Task_Scheduler SHALL 清理相关的浏览器进程
4. WHEN 超时任务有剩余重试次数时，THE Task_Scheduler SHALL 将其重新标记为 pending
5. WHEN 批次中有超时任务时，THE Batch_Executor SHALL 继续执行下一个任务
