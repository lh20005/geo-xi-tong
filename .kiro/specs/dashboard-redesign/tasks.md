# Implementation Plan: Dashboard Redesign

## Overview

本实施计划将工作台重构分解为一系列增量开发任务。实施顺序遵循从后端到前端、从核心功能到增强功能的原则，确保每个步骤都能独立验证和测试。

## Tasks

- [x] 1. 创建后端API端点和数据服务
  - [x] 1.1 创建Dashboard控制器和路由
    - 在server/src/routes目录创建dashboardRoutes.ts
    - 定义所有dashboard相关的API端点
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 3.1, 4.1, 5.1, 5.2, 5.3, 6.1, 7.1, 7.2_
  
  - [x] 1.2 实现核心指标数据查询服务
    - 创建server/src/services/DashboardService.ts
    - 实现getMetrics方法，查询蒸馏、文章、发布任务的统计数据
    - 计算今日新增和增长率
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 1.3 实现趋势数据查询服务
    - 在DashboardService中实现getTrends方法
    - 按日期聚合文章和蒸馏数据
    - 支持时间范围参数
    - _Requirements: 2.1, 2.2_
  
  - [x] 1.4 实现平台分布查询服务
    - 在DashboardService中实现getPlatformDistribution方法
    - 统计各平台的发布数量
    - 按数量降序排序
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 1.5 实现发布状态查询服务
    - 在DashboardService中实现getPublishingStatus方法
    - 统计各状态的任务数量
    - 计算百分比
    - _Requirements: 4.1, 4.2_
  
  - [x] 1.6 实现资源使用率查询服务
    - 在DashboardService中实现getResourceUsage方法
    - 查询蒸馏、话题、图片的总数和已使用数量
    - 计算使用百分比
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [x] 1.7 实现生成任务概览查询服务
    - 在DashboardService中实现getGenerationTasks方法
    - 统计任务状态分布
    - 计算平均完成时间和成功率
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 1.8 实现资源排行查询服务
    - 在DashboardService中实现getTopResources方法
    - 查询知识库和转化目标的使用次数
    - 返回TOP10排行
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 2. 创建前端数据类型定义和API客户端
  - [x] 2.1 定义TypeScript接口
    - 创建client/src/types/dashboard.ts
    - 定义所有API响应和组件props的类型
    - _Requirements: All_
  
  - [x] 2.2 创建Dashboard API客户端
    - 创建client/src/api/dashboard.ts
    - 实现所有API调用函数
    - 添加错误处理
    - _Requirements: 1.6, 9.4_

- [x] 3. 实现核心指标卡片组件
  - [x] 3.1 创建MetricsCards组件
    - 创建client/src/components/Dashboard/MetricsCards.tsx
    - 实现四个指标卡片的布局
    - 使用渐变色背景
    - 显示数值、图标和增长率
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [ ]* 3.2 编写MetricsCards单元测试
    - 测试组件渲染
    - 测试增长率计算和显示
    - 测试加载状态
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 4. 实现趋势图表组件
  - [ ] 4.1 创建TrendsChart组件
    - 创建client/src/components/Dashboard/TrendsChart.tsx
    - 使用ECharts实现双折线图
    - 配置图表样式和交互
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [ ]* 4.2 编写TrendsChart单元测试
    - 测试图表渲染
    - 测试空数据处理
    - _Requirements: 2.1, 2.2, 2.5_

- [ ] 5. 实现平台分布和状态分布图表
  - [ ] 5.1 创建PlatformDistribution组件
    - 创建client/src/components/Dashboard/PlatformDistribution.tsx
    - 使用ECharts实现横向柱状图
    - 实现点击交互
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [ ] 5.2 创建PublishingStatusChart组件
    - 创建client/src/components/Dashboard/PublishingStatusChart.tsx
    - 使用ECharts实现环形图
    - 配置状态颜色
    - _Requirements: 4.1, 4.2, 4.4_
  
  - [ ]* 5.3 编写图表组件单元测试
    - 测试平台分布图渲染和排序
    - 测试状态分布图渲染
    - 测试空数据处理
    - _Requirements: 3.1, 3.5, 4.1_

- [ ] 6. 实现资源使用率组件
  - [ ] 6.1 创建ResourceUsageChart组件
    - 创建client/src/components/Dashboard/ResourceUsageChart.tsx
    - 实现三个进度条的布局
    - 根据使用率显示不同颜色
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  
  - [ ]* 6.2 编写ResourceUsageChart单元测试
    - 测试进度条渲染
    - 测试颜色逻辑
    - 测试百分比计算
    - _Requirements: 5.4, 5.5, 5.6, 5.7_

- [ ] 7. 实现任务概览和资源排行组件
  - [ ] 7.1 创建GenerationTasksChart组件
    - 创建client/src/components/Dashboard/GenerationTasksChart.tsx
    - 使用ECharts实现堆叠柱状图
    - 显示平均完成时间和成功率
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [ ] 7.2 创建TopResourcesChart组件
    - 创建client/src/components/Dashboard/TopResourcesChart.tsx
    - 使用ECharts实现双横向柱状图
    - 实现点击跳转
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [ ]* 7.3 编写组件单元测试
    - 测试任务概览图渲染
    - 测试资源排行图渲染和排序
    - _Requirements: 6.1, 7.1, 7.4_

- [ ] 8. 实现时间范围选择器和工具栏
  - [ ] 8.1 创建TimeRangeSelector组件
    - 创建client/src/components/Dashboard/TimeRangeSelector.tsx
    - 实现预设选项和自定义日期选择
    - 添加日期验证
    - _Requirements: 8.1, 8.2, 8.4, 8.5_
  
  - [ ] 8.2 创建DashboardToolbar组件
    - 创建client/src/components/Dashboard/DashboardToolbar.tsx
    - 集成时间选择器、刷新按钮、导出按钮
    - _Requirements: 8.1, 9.3, 12.1_
  
  - [ ]* 8.3 编写工具栏组件单元测试
    - 测试时间范围选择
    - 测试日期验证
    - _Requirements: 8.2, 8.5_

- [ ] 9. 实现数据导出功能
  - [ ] 9.1 安装导出依赖库
    - 安装papaparse和xlsx库
    - 安装类型定义
    - _Requirements: 12.2, 12.3_
  
  - [ ] 9.2 创建导出工具函数
    - 创建client/src/utils/exportUtils.ts
    - 实现CSV导出函数
    - 实现Excel导出函数
    - _Requirements: 12.2, 12.3, 12.4_
  
  - [ ] 9.3 集成导出功能到工具栏
    - 在DashboardToolbar中实现导出逻辑
    - 添加格式选择和错误处理
    - _Requirements: 12.1, 12.2, 12.3, 12.5, 12.6_
  
  - [ ]* 9.4 编写导出功能单元测试
    - 测试CSV导出
    - 测试Excel导出
    - 测试数据完整性
    - _Requirements: 12.4_

- [x] 10. 组装主Dashboard页面
  - [x] 10.1 重构Dashboard页面组件
    - 修改client/src/pages/Dashboard.tsx
    - 删除现有内容
    - 实现新的布局结构
    - 集成所有子组件
    - _Requirements: All_
  
  - [x] 10.2 实现数据加载逻辑
    - 使用React Hooks管理状态
    - 实现并行数据加载
    - 添加加载状态和错误处理
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [x] 10.3 实现响应式布局
    - 使用Ant Design Grid系统
    - 配置不同屏幕尺寸的断点
    - _Requirements: 10.1, 10.2, 10.3_
  
  - [x] 10.4 实现导航功能
    - 添加卡片和图表的点击事件
    - 实现页面跳转逻辑
    - 添加错误处理
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 11. 性能优化和最终调整
  - [ ] 11.1 优化组件渲染性能
    - 使用React.memo包装组件
    - 使用useCallback和useMemo优化
    - _Requirements: 14.1, 14.3, 14.5_
  
  - [ ] 11.2 优化图表配置
    - 配置ECharts响应式选项
    - 优化图表动画
    - _Requirements: 10.5, 13.5_
  
  - [ ] 11.3 添加图表交互增强
    - 配置悬停提示
    - 配置图例交互
    - 配置缩放和平移（时间序列图）
    - _Requirements: 13.1, 13.2, 13.3, 13.4_
  
  - [ ] 11.4 最终样式调整
    - 确保与项目整体风格一致
    - 调整间距和对齐
    - 优化移动端显示
    - _Requirements: 10.1, 10.2, 10.3_

- [ ] 12. 集成测试和文档
  - [ ]* 12.1 编写集成测试
    - 测试完整的数据加载流程
    - 测试时间范围切换
    - 测试导航跳转
    - _Requirements: 8.3, 11.4_
  
  - [ ] 12.2 更新项目文档
    - 在dev-docs目录创建DASHBOARD_REDESIGN.md
    - 记录新功能和使用说明
    - 记录API端点文档
    - _Requirements: All_

## Notes

- 任务标记`*`的为可选任务，可以跳过以加快MVP开发
- 每个任务都引用了具体的需求编号以确保可追溯性
- 建议按顺序执行任务，确保增量开发和及时验证
- 图表组件使用ECharts，需要熟悉其配置选项
- 响应式布局使用Ant Design的Grid系统，断点为xs(<576px), sm(≥576px), md(≥768px), lg(≥992px), xl(≥1200px)
