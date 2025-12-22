# Requirements Document

## Introduction

Windows登录管理器在头条号登录成功后显示"Login failed"错误，无法保存登录信息。网页端的头条号登录器工作正常。需要修复Windows端的登录检测逻辑，使其与网页端保持一致。

## Glossary

- **Windows_Login_Manager**: Windows平台的Electron应用，用于管理平台账号登录
- **Web_Login_Service**: 网页端的Puppeteer登录服务（server/src/services/AccountService.ts）
- **Login_Detector**: Windows端的登录状态检测器（windows-login-manager/electron/login/login-detector.ts）
- **BrowserView**: Electron的嵌入式浏览器视图组件
- **URL_Detection**: 通过检测URL变化来判断登录成功的方法
- **Element_Detection**: 通过检测页面元素出现来判断登录成功的方法
- **Platform_Config**: 数据库中存储的平台配置（platforms_config表）

## Requirements

### Requirement 1: 验证数据库配置完整性

**User Story:** 作为系统管理员，我需要确认数据库中的头条号配置包含所有必要的选择器和URL模式，以便Windows登录管理器能够正确检测登录状态。

#### Acceptance Criteria

1. WHEN查询platforms_config表的toutiao记录 THEN THE System SHALL返回包含selectors字段的完整配置
2. WHEN检查selectors.username字段 THEN THE System SHALL包含至少7个用户名选择器
3. WHEN检查selectors.loginSuccess字段 THEN THE System SHALL包含至少3个登录成功选择器
4. WHEN检查selectors.successUrls字段 THEN THE System SHALL包含至少2个URL模式（mp.toutiao.com/profile_v4和mp.toutiao.com/creator）
5. WHEN检查login_url字段 THEN THE System SHALL等于"https://mp.toutiao.com/auth/page/login"

### Requirement 2: 验证API返回正确配置

**User Story:** 作为Windows登录管理器，我需要从后端API获取正确的平台配置，以便能够使用正确的选择器和URL模式进行登录检测。

#### Acceptance Criteria

1. WHEN调用GET /api/platforms/toutiao THEN THE API SHALL返回包含selectors对象的响应
2. WHEN检查响应中的selectors.username THEN THE API SHALL返回包含7个选择器的数组
3. WHEN检查响应中的selectors.loginSuccess THEN THE API SHALL返回包含3个选择器的数组
4. WHEN检查响应中的selectors.successUrls THEN THE API SHALL返回包含2个URL模式的数组
5. WHEN检查响应中的login_url THEN THE API SHALL返回正确的登录URL

### Requirement 3: 修复登录检测逻辑

**User Story:** 作为Windows登录管理器，我需要使用与网页端一致的登录检测策略，优先使用URL变化检测，以提高登录成功率。

#### Acceptance Criteria

1. WHEN用户完成登录且URL从登录页变化到其他页面 THEN THE Login_Detector SHALL立即检测到登录成功
2. WHEN URL变化到about:blank或chrome-error页面 THEN THE Login_Detector SHALL忽略该变化并继续检测
3. WHEN URL匹配successUrls中的任一模式 THEN THE Login_Detector SHALL判定为登录成功
4. WHEN URL变化检测失败 THEN THE Login_Detector SHALL使用loginSuccess选择器作为备用检测方法
5. WHEN所有检测方法在5分钟内都未成功 THEN THE Login_Detector SHALL返回超时错误

### Requirement 4: 移除页面加载等待

**User Story:** 作为Windows登录管理器，我不应该等待页面完全加载，因为某些平台的登录页面可能触发ERR_ABORTED错误，但这不影响用户登录。

#### Acceptance Criteria

1. WHEN创建BrowserView并导航到登录页面 THEN THE Login_Manager SHALL不调用waitForLoad方法
2. WHEN页面触发ERR_ABORTED错误 THEN THE Login_Manager SHALL继续执行登录检测流程
3. WHEN页面触发其他加载错误 THEN THE Login_Manager SHALL继续执行登录检测流程
4. WHEN BrowserView创建完成 THEN THE Login_Manager SHALL等待1秒让页面开始加载
5. WHEN等待完成后 THEN THE Login_Manager SHALL立即开始登录检测

### Requirement 5: 正确读取配置位置

**User Story:** 作为Windows登录管理器，我需要从正确的位置读取successUrls配置，以便能够使用URL检测功能。

#### Acceptance Criteria

1. WHEN构建LoginDetectionConfig THEN THE Login_Manager SHALL优先从platform.selectors.successUrls读取
2. WHEN platform.selectors.successUrls不存在 THEN THE Login_Manager SHALL从platform.detection.successUrls读取
3. WHEN两个位置都不存在 THEN THE Login_Manager SHALL使用undefined作为successUrls值
4. WHEN successUrls为undefined THEN THE Login_Detector SHALL仅使用URL变化检测（任何URL变化都视为成功）
5. WHEN successUrls有值 THEN THE Login_Detector SHALL同时使用URL变化检测和URL模式匹配

### Requirement 6: 用户信息提取

**User Story:** 作为Windows登录管理器，我需要在登录成功后提取用户名，以便保存账号信息。

#### Acceptance Criteria

1. WHEN登录检测成功 THEN THE Login_Manager SHALL使用platform.selectors.username选择器提取用户名
2. WHEN第一个选择器失败 THEN THE Login_Manager SHALL按顺序尝试后续选择器
3. WHEN所有选择器都失败 THEN THE Login_Manager SHALL返回"Failed to extract user information"错误
4. WHEN成功提取用户名 THEN THE Login_Manager SHALL将用户名保存到account.real_username字段
5. WHEN用户名提取成功 THEN THE Login_Manager SHALL继续执行Cookie捕获和账号保存流程

### Requirement 7: 错误处理和日志

**User Story:** 作为开发人员，我需要详细的日志输出，以便在登录失败时能够快速定位问题。

#### Acceptance Criteria

1. WHEN开始登录流程 THEN THE System SHALL记录平台ID和登录URL
2. WHEN检测到URL变化 THEN THE System SHALL记录初始URL和当前URL
3. WHEN使用选择器检测 THEN THE System SHALL记录每个选择器的检测结果
4. WHEN登录成功 THEN THE System SHALL记录成功方法（url或selector）
5. WHEN登录失败 THEN THE System SHALL记录失败原因和详细错误信息

### Requirement 8: 取消登录功能

**User Story:** 作为用户，我需要能够在登录过程中取消登录，以便在不想继续等待时退出。

#### Acceptance Criteria

1. WHEN用户点击取消按钮 THEN THE Login_Manager SHALL调用cancelLogin方法
2. WHEN cancelLogin被调用 THEN THE Login_Detector SHALL停止所有检测定时器
3. WHEN cancelLogin被调用 THEN THE Login_Manager SHALL销毁BrowserView
4. WHEN cancelLogin被调用 THEN THE Login_Manager SHALL设置isLoginInProgress为false
5. WHEN登录被取消 THEN THE System SHALL返回"Login cancelled"消息而不是错误

### Requirement 9: 与网页端保持一致

**User Story:** 作为系统架构师，我需要Windows端和网页端使用相同的登录检测策略，以确保行为一致性和可维护性。

#### Acceptance Criteria

1. WHEN网页端使用URL变化检测 THEN THE Windows端 SHALL也使用URL变化检测作为主要方法
2. WHEN网页端不等待页面加载 THEN THE Windows端 SHALL也不等待页面加载
3. WHEN网页端使用5分钟超时 THEN THE Windows端 SHALL也使用5分钟超时
4. WHEN网页端忽略页面加载错误 THEN THE Windows端 SHALL也忽略页面加载错误
5. WHEN网页端检测到URL变化即判定成功 THEN THE Windows端 SHALL也检测到URL变化即判定成功
