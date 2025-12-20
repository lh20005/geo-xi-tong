# Implementation Plan: Account Name Display Improvements

## Overview

实现账号名称显示的改进，包括移除备注名称列、统一使用真实用户名显示、优化后端查询。

## Tasks

- [x] 1. 更新后端API以支持真实用户名
  - 修改发布任务和发布记录的查询SQL
  - 添加LEFT JOIN获取账号的real_username
  - 确保API响应包含real_username字段
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3_

- [x] 2. 更新前端类型定义
  - 在PublishingTask接口添加real_username字段
  - 在PublishingRecord接口添加real_username字段
  - _Requirements: 4.1, 4.2_

- [x] 3. 修改平台管理页面
  - 移除账号管理列表中的"备注名称"列
  - 保留"真实用户名"列的样式和逻辑
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 4. 修改发布任务页面
  - 将"账号"列改名为"账号名称"
  - 更新列的dataIndex为real_username
  - 实现回退逻辑：优先显示real_username，否则显示account_name
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 5. 修改发布记录页面
  - 将"账号"列改名为"账号名称"
  - 更新列的dataIndex为real_username
  - 实现回退逻辑：优先显示real_username，否则显示account_name
  - 当账号不存在时显示"-"
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 6. 测试验证
  - 测试平台管理页面的列显示
  - 测试发布任务页面的账号名称显示
  - 测试发布记录页面的账号名称显示
  - 验证真实用户名和备注名称的回退逻辑
  - 验证账号删除后的显示效果
  - _Requirements: All_

## Notes

- 所有修改都是向后兼容的，不影响现有数据
- 使用LEFT JOIN确保即使账号被删除也能显示记录
- 前端使用回退逻辑确保总是有内容显示
