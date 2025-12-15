# Requirements Document

## Introduction

本文档定义了统一前端 API 客户端的需求。当前系统中存在不一致的 API 调用方式：部分页面使用未配置 baseURL 的 axios，部分页面使用带完整 URL 的 fetch API。这导致在页面切换时出现"列表加载失败"的错误。本需求旨在统一所有 API 调用方式，确保一致性和可维护性。

## Glossary

- **API Client**: 用于向后端服务器发送 HTTP 请求的前端工具或库
- **axios**: 一个基于 Promise 的 HTTP 客户端库
- **fetch API**: 浏览器原生的 HTTP 请求 API
- **baseURL**: API 请求的基础 URL，所有相对路径请求都会基于此 URL
- **ArticleListPage**: 文章管理页面组件
- **ArticleSettingsPage**: 文章设置页面组件

## Requirements

### Requirement 1

**User Story:** 作为开发者，我希望所有前端 API 调用使用统一的客户端配置，以便代码一致且易于维护。

#### Acceptance Criteria

1. WHEN the system initializes THEN the API Client SHALL be configured with a consistent baseURL
2. WHEN any component makes an API request THEN the API Client SHALL use the configured baseURL
3. WHEN the baseURL needs to be changed THEN the system SHALL only require modification in one central location
4. THE API Client SHALL support all HTTP methods (GET, POST, PATCH, DELETE)
5. THE API Client SHALL handle errors consistently across all requests

### Requirement 2

**User Story:** 作为用户，我希望在文章管理和文章设置页面之间切换时不会出现加载错误，以便流畅地使用系统。

#### Acceptance Criteria

1. WHEN a user navigates from ArticleListPage to ArticleSettingsPage THEN the system SHALL load the article settings list successfully
2. WHEN a user navigates from ArticleSettingsPage to ArticleListPage THEN the system SHALL load the articles list successfully
3. WHEN any page loads THEN the system SHALL display appropriate loading states
4. IF an API request fails THEN the system SHALL display a clear error message to the user
5. WHEN multiple pages are accessed in sequence THEN the system SHALL maintain consistent API behavior

### Requirement 3

**User Story:** 作为开发者，我希望所有现有的 API 调用都迁移到统一的客户端，以便消除不一致性。

#### Acceptance Criteria

1. WHEN ArticleListPage loads THEN the page SHALL use the unified API Client
2. WHEN ArticleSettingsPage loads THEN the page SHALL use the unified API Client
3. WHEN any API module makes requests THEN the module SHALL use the unified API Client
4. THE system SHALL remove all direct axios imports without baseURL configuration
5. THE system SHALL remove all fetch calls with hardcoded URLs

### Requirement 4

**User Story:** 作为开发者，我希望 API 客户端提供类型安全，以便在编译时捕获错误。

#### Acceptance Criteria

1. WHEN the API Client is used THEN the system SHALL provide TypeScript type definitions
2. WHEN an API response is received THEN the system SHALL validate the response type
3. WHEN request parameters are provided THEN the system SHALL validate parameter types
4. THE API Client SHALL export typed functions for each endpoint
5. THE system SHALL prevent runtime type errors through compile-time checks
