# Implementation Plan: Account Deletion Sync Fix

## Overview

实现统一的用户认证系统，解决Windows端删除账号后网页端无法实时同步的问题。采用JWT认证 + WebSocket实时推送的方案，确保安全性和实时性。

## Tasks

- [x] 1. 创建用户数据库表和认证服务
  - 创建users表存储用户信息
  - 实现密码加密服务（bcrypt）
  - 创建默认管理员账号
  - _Requirements: 1.1, 1.3, 1.5_

- [x] 2. 改进服务端认证API
  - [x] 2.1 实现AuthService类
    - 实现hashPassword方法（bcrypt加密）
    - 实现verifyPassword方法（密码验证）
    - 实现createUser方法（创建用户）
    - 实现validateUser方法（验证用户并更新登录时间）
    - _Requirements: 1.1, 1.3, 1.5_

  - [x] 2.2 改进登录路由
    - 修改/api/auth/login路由使用AuthService
    - 返回用户信息（id, username, email, role）
    - 记录登录日志
    - _Requirements: 1.2_

  - [x] 2.3 确保WebSocket认证要求
    - 验证WebSocket服务只向已认证客户端广播
    - 添加认证客户端数量日志
    - _Requirements: 3.5, 4.4_

- [x] 3. 创建网页端登录页面
  - [x] 3.1 实现LoginPage组件
    - 创建登录表单（用户名、密码）
    - 实现表单验证（用户名≥3字符，密码≥6字符）
    - 实现登录逻辑（调用API、保存token）
    - 添加loading状态和错误提示
    - 实现UI设计（渐变背景、居中卡片）
    - _Requirements: 2.1, 2.3, 2.4_

  - [x] 3.2 创建ProtectedRoute组件
    - 检查localStorage中的auth_token
    - 未登录时跳转到/login
    - _Requirements: 2.2_

  - [x] 3.3 配置路由
    - 添加/login公开路由
    - 使用ProtectedRoute包装所有受保护路由
    - 修改App.tsx路由配置
    - _Requirements: 2.2_

- [x] 4. 实现API请求拦截器
  - [x] 4.1 添加请求拦截器
    - 自动添加Authorization header
    - 从localStorage读取auth_token
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 4.2 添加响应拦截器
    - 处理401错误（token过期）
    - 自动使用refreshToken刷新token
    - 刷新失败时跳转到登录页
    - 重试原始请求
    - _Requirements: 1.4_

- [x] 5. 创建顶部导航栏用户信息
  - [x] 5.1 实现Header组件
    - 显示用户头像和用户名
    - 实现下拉菜单（个人信息、设置、退出登录）
    - 实现退出登录功能（清除token、跳转登录页）
    - _Requirements: 2.3_

  - [x] 5.2 集成到Layout组件
    - 在Layout中使用Header组件
    - 确保所有页面都显示Header
    - _Requirements: 2.3_

- [x] 6. 优化WebSocket连接管理
  - [x] 6.1 修改WebSocket初始化逻辑
    - 检查auth_token是否存在
    - 未登录时不初始化WebSocket
    - 使用token进行WebSocket认证
    - _Requirements: 4.1, 4.5_

  - [x] 6.2 增强WebSocket日志
    - 记录连接状态变化
    - 记录认证成功/失败
    - 记录接收到的事件
    - _Requirements: 8.2, 8.3_

- [x] 7. 确保账号删除事件广播
  - [x] 7.1 验证删除路由广播逻辑
    - 确认platformAccounts.ts中的DELETE路由调用broadcastAccountEvent
    - 添加详细日志（删除前、删除后、广播后）
    - _Requirements: 3.1, 3.2, 8.1_

  - [x] 7.2 测试事件广播
    - 测试删除成功时广播事件
    - 测试删除失败时不广播事件
    - 验证事件数据格式正确
    - _Requirements: 3.3, 3.4_

- [x] 8. Checkpoint - 本地测试
  - 启动服务端和客户端
  - 测试登录功能
  - 测试WebSocket连接
  - 测试账号删除同步
  - 确保所有功能正常工作

- [x] 9. 生产环境配置
  - [x] 9.1 添加环境变量配置
    - 创建.env.example文件
    - 配置JWT_SECRET和JWT_REFRESH_SECRET
    - 配置ADMIN_USERNAME和ADMIN_PASSWORD
    - 配置API_URL和WS_URL
    - _Requirements: 7.4_

  - [x] 9.2 创建Nginx配置文件
    - 配置HTTPS反向代理
    - 配置WebSocket代理（WSS）
    - 设置超时参数
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 9.3 更新客户端环境配置
    - 创建config/env.ts文件
    - 根据环境自动选择API_URL和WS_URL
    - 生产环境使用HTTPS/WSS
    - _Requirements: 7.1, 7.2_

- [x] 10. 数据库迁移脚本
  - [x] 10.1 创建users表迁移脚本
    - 编写SQL创建users表
    - 添加索引（username唯一索引）
    - 插入默认管理员账号
    - _Requirements: 1.1, 1.3_

  - [x] 10.2 执行迁移
    - 运行迁移脚本
    - 验证表结构正确
    - 验证默认账号可以登录
    - _Requirements: 1.1_

- [x] 11. 集成测试
  - [x] 11.1 测试完整登录流程
    - 测试登录成功场景
    - 测试登录失败场景
    - 测试token过期自动刷新
    - 测试退出登录
    - _Requirements: 1.2, 1.4, 2.3, 2.4_

  - [x] 11.2 测试WebSocket实时同步
    - 打开两个浏览器窗口
    - 在一个窗口删除账号
    - 验证另一个窗口实时更新
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3_

  - [x] 11.3 测试Windows端和网页端同步
    - 使用Windows端删除账号
    - 验证网页端实时收到更新
    - 验证WebSocket事件日志
    - _Requirements: 3.1, 3.2, 4.1, 4.2, 8.1, 8.2, 8.3_

- [x] 12. Final Checkpoint - 完整测试
  - 测试所有功能正常工作
  - 检查日志输出是否完整
  - 验证安全性（密码加密、HTTPS/WSS）
  - 准备部署到腾讯云

## Notes

- 任务按照依赖关系排序，建议按顺序执行
- Checkpoint任务用于验证阶段性成果
- 每个任务都标注了对应的需求编号
- 生产环境配置（任务9）可以在本地测试完成后再进行
- 数据库迁移（任务10）应该在开发初期完成
