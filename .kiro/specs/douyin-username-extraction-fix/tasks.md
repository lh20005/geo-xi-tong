# Implementation Plan: 抖音用户名提取修复

## Overview

修复抖音平台登录后无法获取账号信息的问题。通过优化选择器配置，确保系统能够可靠地提取用户名。

## Tasks

- [x] 1. 更新抖音平台的选择器配置
  - 修改 `server/src/services/AccountService.ts` 中的 `extractUserInfo` 方法
  - 将 `.semi-navigation-header-username` 移到选择器列表的最前面
  - 重新排序其他选择器，优先使用通用选择器
  - _Requirements: 1.1, 1.4, 2.1_

- [x]* 1.1 编写单元测试验证选择器配置
  - 测试抖音选择器列表的第一个元素是 `.semi-navigation-header-username`
  - 测试选择器列表包含所有必要的备用选择器
  - _Requirements: 2.1, 2.3_

- [x] 2. 验证修改不影响其他平台
  - 运行现有的测试套件
  - 确认头条号等其他平台的用户名提取仍然正常
  - _Requirements: 2.3_

- [ ]* 2.1 编写集成测试
  - 创建mock页面模拟抖音登录后的状态
  - 测试用户名提取和保存流程
  - _Requirements: 1.1, 1.5_

- [ ] 3. 手动测试验证
  - 在开发环境中登录抖音平台
  - 检查日志输出，确认使用了正确的选择器
  - 验证数据库中的 `real_username` 字段已正确填充
  - 检查前端显示的用户名是否正确
  - _Requirements: 1.1, 1.5_

- [ ] 4. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户

## Notes

- 任务标记 `*` 的为可选任务，可以跳过以加快MVP开发
- 核心修改仅涉及一个文件的配置更新
- 修改具有向后兼容性，不会破坏现有功能
- 建议在生产环境部署前进行充分的手动测试
