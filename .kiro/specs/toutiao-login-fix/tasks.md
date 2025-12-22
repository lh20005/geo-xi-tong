# Implementation Plan: Toutiao Login Fix

## Overview

修复Windows登录管理器的头条号登录问题，通过验证数据库配置、修正代码逻辑、添加测试来确保登录功能正常工作。

## Tasks

- [x] 1. 验证和修复数据库配置
  - 检查platforms_config表是否包含完整的头条号配置
  - 验证selectors字段包含username、loginSuccess和successUrls
  - 如果缺少配置，执行009和010迁移脚本
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ]* 1.1 编写数据库配置验证脚本
  - 创建脚本查询platforms_config表
  - 验证所有必需字段存在
  - 输出配置完整性报告
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. 验证API配置返回
  - 测试GET /api/platforms/toutiao端点
  - 验证响应包含完整的selectors对象
  - 确认successUrls字段存在且包含正确的URL模式
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ]* 2.1 编写API配置测试
  - 创建集成测试验证API响应格式
  - 测试selectors.username包含7个选择器
  - 测试selectors.loginSuccess包含3个选择器
  - 测试selectors.successUrls包含2个URL模式
  - **Property 6: API配置完整性**
  - **Validates: Requirements 2.2, 2.3, 2.4**
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. 修复Login Manager配置读取
  - 修改login-manager.ts中的配置读取逻辑
  - 优先从platform.selectors.successUrls读取
  - 回退到platform.detection.successUrls
  - 移除waitForLoad()调用
  - 添加1秒延迟让页面开始加载
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]* 3.1 编写配置读取单元测试
  - 测试从selectors.successUrls读取
  - 测试从detection.successUrls回退
  - 测试两者都不存在的情况
  - _Requirements: 5.1, 5.2, 5.3_

- [ ]* 3.2 编写配置读取属性测试
  - **Property 2: 配置读取正确性**
  - **Validates: Requirements 5.1, 5.2**
  - 生成随机平台配置
  - 验证读取优先级正确
  - 运行100+次迭代
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]* 3.3 编写页面加载错误处理测试
  - **Property 3: 页面加载错误不中断流程**
  - **Validates: Requirements 4.2, 4.3**
  - 模拟ERR_ABORTED错误
  - 模拟其他加载错误
  - 验证流程继续执行
  - _Requirements: 4.2, 4.3_

- [x] 4. 验证Login Detector实现
  - 检查login-detector.ts中的URL变化检测逻辑
  - 确认已实现URL变化监听
  - 确认已实现定期轮询
  - 确认已实现取消功能
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 8.2_

- [ ]* 4.1 编写URL变化检测属性测试
  - **Property 1: URL变化检测成功率**
  - **Validates: Requirements 3.1, 9.5**
  - 生成随机初始URL和目标URL
  - 模拟URL变化
  - 验证2秒内检测成功
  - 运行100+次迭代
  - _Requirements: 3.1, 9.5_

- [ ]* 4.2 编写URL匹配单元测试
  - 测试通配符匹配
  - 测试简单包含匹配
  - 测试错误URL过滤（about:blank, chrome-error）
  - _Requirements: 3.2, 3.3_

- [x] 5. 验证User Info Extractor实现
  - 检查user-info-extractor.ts中的提取逻辑
  - 确认按优先级尝试选择器
  - 确认找到第一个有内容的元素即返回
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ]* 5.1 编写用户信息提取单元测试
  - 测试第一个选择器成功
  - 测试回退到后续选择器
  - 测试所有选择器失败
  - _Requirements: 6.1, 6.2, 6.3_

- [ ]* 5.2 编写用户信息提取属性测试
  - **Property 4: 用户信息提取回退机制**
  - **Validates: Requirements 6.2**
  - 生成随机选择器列表
  - 模拟部分选择器失败
  - 验证尝试顺序正确
  - 运行100+次迭代
  - _Requirements: 6.2_

- [x] 6. 验证取消登录功能
  - 检查login-manager.ts中的cancelLogin方法
  - 确认调用loginDetector.cancelDetection()
  - 确认销毁BrowserView
  - 确认设置isLoginInProgress为false
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ]* 6.1 编写取消登录单元测试
  - 测试取消时清理资源
  - 测试取消时停止检测
  - 测试取消后的状态
  - _Requirements: 8.2, 8.3, 8.4_

- [ ]* 6.2 编写取消登录属性测试
  - **Property 5: 取消登录清理资源**
  - **Validates: Requirements 8.2, 8.3, 8.4**
  - 启动登录流程
  - 随机时间后取消
  - 验证所有资源清理
  - 运行100+次迭代
  - _Requirements: 8.2, 8.3, 8.4_

- [x] 7. 增强日志记录
  - 在login-manager.ts中添加详细日志
  - 记录平台ID和登录URL
  - 记录URL变化（初始和当前）
  - 记录选择器检测结果
  - 记录登录成功/失败原因
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ]* 7.1 编写日志记录测试
  - **Property 7: 日志记录完整性**
  - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
  - 模拟登录流程
  - 捕获日志输出
  - 验证所有关键事件被记录
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 8. Checkpoint - 确保所有测试通过
  - 运行所有单元测试
  - 运行所有属性测试
  - 修复任何失败的测试
  - 确保代码质量
  - 询问用户是否有问题

- [x] 9. 集成测试
  - 启动后端服务
  - 启动Windows登录管理器
  - 测试完整登录流程
  - 验证账号保存成功
  - _Requirements: 所有需求_

- [ ]* 9.1 编写与网页端一致性测试
  - **Property 8: 与网页端行为一致性**
  - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**
  - 对比Windows端和网页端的检测策略
  - 验证超时时间一致（5分钟）
  - 验证都不等待页面加载
  - 验证都使用URL变化检测
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 10. 手动测试和验证
  - 在真实环境中测试头条号登录
  - 测试网络错误场景
  - 测试页面加载错误场景
  - 测试超时场景
  - 测试取消登录场景
  - 验证日志输出完整性
  - _Requirements: 所有需求_

- [x] 11. 文档更新
  - 更新README说明修复内容
  - 记录测试结果
  - 更新故障排查指南
  - 创建修复总结文档
  - _Requirements: 所有需求_

- [x] 12. Final Checkpoint - 确认修复完成
  - 所有测试通过
  - 手动测试成功
  - 文档更新完成
  - 询问用户确认修复效果

## Notes

- 任务标记`*`的为可选测试任务，可以跳过以加快MVP开发
- 每个属性测试应该运行至少100次迭代
- 属性测试使用随机生成的输入数据
- 集成测试需要启动完整的服务栈
- 手动测试需要真实的头条号账号
- 修复的核心是：移除waitForLoad()，修正配置读取位置
- 参考网页端成功经验：简单的URL变化检测最可靠
