# 设计文档

## 概述

企业图库是一个完整的图片资源管理系统，提供相册创建、图片上传、浏览和管理功能。系统采用前后端分离架构，前端使用React + Ant Design构建用户界面，后端使用Express + PostgreSQL提供RESTful API服务。图片以Base64编码形式存储在数据库中，便于跨模块调用和使用。

## 架构

### 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层 (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  侧边栏导航   │  │  相册列表页   │  │  相册详情页   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│                      后端层 (Express)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  路由层       │  │  服务层       │  │  数据访问层   │      │
│  │  (Routes)    │→ │  (Services)  │→ │  (Database)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                   数据层 (PostgreSQL)                         │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │  albums表     │  │  images表     │                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈

**前端:**
- React 18.2
- TypeScript 5.3
- Ant Design 5.12
- React Router 6.20
- Axios 1.6

**后端:**
- Node.js + Express 4.18
- TypeScript 5.3
- PostgreSQL (通过pg 8.11)
- Zod 3.22 (数据验证)

## 组件和接口

### 前端组件

#### 1. GalleryPage (相册列表页)
**职责:** 展示所有相册，提供创建相册入口

**状态:**
- `albums: Album[]` - 相册列表
- `loading: boolean` - 加载状态
- `createModalVisible: boolean` - 创建对话框可见性

**主要方法:**
- `loadAlbums()` - 加载相册列表
- `handleCreateAlbum(name, files)` - 创建相册并上传图片
- `handleDeleteAlbum(id)` - 删除相册
- `handleEditAlbum(id, name)` - 编辑相册名称

**UI元素:**
- 页面标题和创建按钮
- 相册卡片网格 (类似蒸馏历史)
- 创建相册对话框 (包含名称输入和图片上传)

#### 2. AlbumDetailPage (相册详情页)
**职责:** 展示相册中的所有图片，提供图片管理功能

**状态:**
- `album: Album | null` - 相册信息
- `images: Image[]` - 图片列表
- `loading: boolean` - 加载状态
- `previewImage: string | null` - 预览图片URL
- `uploadModalVisible: boolean` - 上传对话框可见性

**主要方法:**
- `loadAlbumDetail(albumId)` - 加载相册详情
- `handleUploadImages(files)` - 批量上传图片
- `handleDeleteImage(id)` - 删除图片
- `handlePreviewImage(url)` - 预览图片

**UI元素:**
- 相册标题和操作按钮
- 图片网格布局
- 上传图片按钮
- 图片预览模态框

#### 3. Sidebar (侧边栏 - 修改)
**修改内容:** 在"关键词蒸馏"菜单项后添加"企业图库"菜单项

**新增菜单项:**
```typescript
{
  key: '/gallery',
  icon: <PictureOutlined />,
  label: '企业图库'
}
```

### 后端API接口

#### 相册管理API

**1. 获取所有相册**
```
GET /api/gallery/albums
Response: {
  albums: [
    {
      id: number,
      name: string,
      image_count: number,
      cover_image: string | null,
      created_at: string
    }
  ]
}
```

**2. 创建相册**
```
POST /api/gallery/albums
Body: {
  name: string,
  images?: [
    {
      filename: string,
      data: string (base64),
      mime_type: string
    }
  ]
}
Response: {
  id: number,
  name: string,
  created_at: string
}
```

**3. 获取相册详情**
```
GET /api/gallery/albums/:id
Response: {
  id: number,
  name: string,
  created_at: string,
  images: [
    {
      id: number,
      filename: string,
      data: string (base64),
      mime_type: string,
      size: number,
      created_at: string
    }
  ]
}
```

**4. 更新相册名称**
```
PATCH /api/gallery/albums/:id
Body: {
  name: string
}
Response: {
  id: number,
  name: string,
  updated_at: string
}
```

**5. 删除相册**
```
DELETE /api/gallery/albums/:id
Response: {
  success: boolean,
  deletedImages: number
}
```

#### 图片管理API

**6. 上传图片到相册**
```
POST /api/gallery/albums/:albumId/images
Body: {
  images: [
    {
      filename: string,
      data: string (base64),
      mime_type: string,
      size: number
    }
  ]
}
Response: {
  uploadedCount: number,
  images: [
    {
      id: number,
      filename: string,
      created_at: string
    }
  ]
}
```

**7. 获取单张图片**
```
GET /api/gallery/images/:id
Response: {
  id: number,
  album_id: number,
  filename: string,
  data: string (base64),
  mime_type: string,
  size: number,
  created_at: string
}
```

**8. 删除图片**
```
DELETE /api/gallery/images/:id
Response: {
  success: boolean
}
```

## 数据模型

### 数据库表结构

#### albums 表
```sql
CREATE TABLE albums (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_albums_created_at ON albums(created_at DESC);
```

#### images 表
```sql
CREATE TABLE images (
  id SERIAL PRIMARY KEY,
  album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  data TEXT NOT NULL,
  mime_type VARCHAR(50) NOT NULL,
  size INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_images_album_id ON images(album_id);
CREATE INDEX idx_images_created_at ON images(created_at DESC);
```

### TypeScript类型定义

```typescript
// 前端类型
interface Album {
  id: number;
  name: string;
  image_count: number;
  cover_image: string | null;
  created_at: string;
}

interface Image {
  id: number;
  album_id: number;
  filename: string;
  data: string; // base64
  mime_type: string;
  size: number;
  created_at: string;
}

interface CreateAlbumRequest {
  name: string;
  images?: ImageUpload[];
}

interface ImageUpload {
  filename: string;
  data: string; // base64
  mime_type: string;
  size: number;
}

// 后端数据库行类型
interface AlbumRow {
  id: number;
  name: string;
  created_at: Date;
  updated_at: Date;
}

interface ImageRow {
  id: number;
  album_id: number;
  filename: string;
  data: string;
  mime_type: string;
  size: number;
  created_at: Date;
}
```

## 正确性属性

*属性是系统在所有有效执行中应该保持为真的特征或行为——本质上是关于系统应该做什么的形式化陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*


### 属性反思

在分析了所有验收标准后，我识别出以下可以合并或简化的属性：

1. **相册名称验证** (2.4 和 9.4) - 可以合并为一个通用的名称验证属性
2. **文件类型验证** (3.2 和 3.3) - 可以合并为一个文件验证属性
3. **列表渲染** (4.1 和 5.2) - 都是测试列表正确渲染，可以用一个更通用的属性
4. **API响应格式** (10.1, 10.2, 10.3) - 可以合并为API响应完整性属性

### 核心属性

**属性 1: 相册创建持久化**
*对于任意*有效的相册名称，创建相册后，该相册应该存在于数据库中并可以被查询到
**验证需求: 2.3**

**属性 2: 相册名称验证**
*对于任意*空字符串或仅包含空白字符的字符串，系统应该拒绝将其作为相册名称
**验证需求: 2.4, 9.4**

**属性 3: 图片文件类型验证**
*对于任意*文件，当且仅当其MIME类型为image/jpeg、image/png、image/gif或image/webp时，系统应该接受该文件上传
**验证需求: 3.2, 3.3**

**属性 4: 图片Base64编码持久化**
*对于任意*有效的图片文件，上传后应该以Base64编码形式存储在数据库中，且可以被正确解码还原
**验证需求: 3.5**

**属性 5: 相册列表完整性**
*对于任意*数量的相册，相册列表页面应该显示所有相册，且每个相册卡片包含名称、图片数量、创建时间和封面图
**验证需求: 4.1, 4.2**

**属性 6: 封面图选择逻辑**
*对于任意*包含至少一张图片的相册，其封面图应该是该相册中创建时间最早的图片
**验证需求: 4.3**

**属性 7: 图片列表渲染完整性**
*对于任意*相册，其详情页面应该显示该相册中的所有图片，且每张图片都有删除按钮
**验证需求: 5.2, 7.1**

**属性 8: 批量上传完整性**
*对于任意*数量的有效图片文件，批量上传后，所有图片都应该被保存到数据库并关联到指定相册
**验证需求: 6.3, 6.5**

**属性 9: 图片删除级联效果**
*对于任意*图片，删除后该图片应该从数据库中移除，且不再出现在相册的图片列表中
**验证需求: 7.3**

**属性 10: 相册删除级联效果**
*对于任意*相册，删除后该相册及其所有关联图片都应该从数据库中移除
**验证需求: 8.3**

**属性 11: 相册名称更新**
*对于任意*相册和有效的新名称，更新后数据库中的相册名称应该与新名称一致
**验证需求: 9.3**

**属性 12: API图片查询完整性**
*对于任意*相册ID，API应该返回该相册的所有图片，且每张图片包含Base64数据和完整元数据
**验证需求: 10.1, 10.3**

**属性 13: API单图片查询**
*对于任意*存在的图片ID，API应该返回该图片的完整数据（包括Base64内容和元数据）
**验证需求: 10.2, 10.3**

## 错误处理

### 前端错误处理

1. **网络请求失败**
   - 使用axios拦截器统一处理
   - 显示用户友好的错误消息
   - 提供重试选项

2. **文件上传错误**
   - 文件类型不支持：显示支持的格式列表
   - 文件过大：显示大小限制（5MB）
   - 上传失败：显示具体错误原因

3. **表单验证错误**
   - 实时验证用户输入
   - 显示内联错误提示
   - 阻止无效数据提交

4. **资源不存在**
   - 相册或图片被删除：重定向到列表页
   - 显示404提示信息

### 后端错误处理

1. **数据库错误**
   - 连接失败：返回503状态码
   - 查询错误：记录日志并返回500
   - 约束违反：返回400和具体错误信息

2. **请求验证错误**
   - 使用Zod进行请求体验证
   - 返回400状态码和详细错误信息
   - 包含字段级别的错误描述

3. **资源不存在**
   - 返回404状态码
   - 包含清晰的错误消息

4. **文件处理错误**
   - Base64解码失败：返回400
   - 文件大小超限：返回413
   - MIME类型不支持：返回415

### 错误响应格式

```typescript
interface ErrorResponse {
  error: string;
  message: string;
  details?: any;
  statusCode: number;
}
```

## 测试策略

### 单元测试

**前端单元测试 (使用Vitest + React Testing Library):**

1. **组件测试**
   - GalleryPage组件渲染测试
   - AlbumDetailPage组件渲染测试
   - 创建相册对话框交互测试
   - 图片上传组件测试

2. **工具函数测试**
   - Base64编码/解码函数
   - 文件类型验证函数
   - 文件大小验证函数

**后端单元测试 (使用Jest):**

1. **路由处理器测试**
   - 测试各API端点的请求处理
   - 测试错误情况处理
   - 测试参数验证

2. **数据库操作测试**
   - 使用测试数据库
   - 测试CRUD操作
   - 测试级联删除

3. **验证逻辑测试**
   - Zod schema验证测试
   - 文件类型验证测试
   - 大小限制验证测试

### 属性测试

**使用fast-check进行属性测试:**

属性测试库: **fast-check** (TypeScript/JavaScript的属性测试库)

配置: 每个属性测试运行至少100次迭代

**前端属性测试:**

1. **属性 2: 相册名称验证**
   - 生成器: 空字符串和各种空白字符组合
   - 验证: 所有这些输入都被拒绝

2. **属性 3: 文件类型验证**
   - 生成器: 各种MIME类型字符串
   - 验证: 只有图片MIME类型被接受

**后端属性测试:**

1. **属性 1: 相册创建持久化**
   - 生成器: 随机有效相册名称
   - 验证: 创建后可以查询到

2. **属性 4: Base64编码持久化**
   - 生成器: 随机图片数据
   - 验证: 编码后存储，解码后一致

3. **属性 5: 相册列表完整性**
   - 生成器: 随机数量的相册
   - 验证: 所有相册都在列表中

4. **属性 6: 封面图选择逻辑**
   - 生成器: 随机相册和图片
   - 验证: 封面是第一张图片

5. **属性 8: 批量上传完整性**
   - 生成器: 随机数量的图片
   - 验证: 所有图片都被保存

6. **属性 9: 图片删除级联效果**
   - 生成器: 随机图片
   - 验证: 删除后不存在

7. **属性 10: 相册删除级联效果**
   - 生成器: 随机相册和图片
   - 验证: 删除后都不存在

8. **属性 11: 相册名称更新**
   - 生成器: 随机相册和新名称
   - 验证: 更新后名称一致

9. **属性 12-13: API查询完整性**
   - 生成器: 随机相册和图片
   - 验证: API返回完整数据

### 集成测试

1. **端到端流程测试**
   - 创建相册 → 上传图片 → 查看 → 删除
   - 批量上传 → 逐个删除
   - 编辑相册名称 → 验证更新

2. **API集成测试**
   - 使用supertest测试API端点
   - 测试完整的请求-响应周期
   - 测试数据库状态变化

### 测试覆盖率目标

- 单元测试覆盖率: ≥80%
- 属性测试: 覆盖所有核心业务逻辑
- 集成测试: 覆盖所有主要用户流程

## 性能考虑

### 图片存储优化

1. **大小限制**
   - 单张图片最大5MB
   - 防止数据库膨胀

2. **Base64编码权衡**
   - 优点: 简化架构，无需文件系统管理
   - 缺点: 存储空间增加约33%
   - 适用场景: 中小规模企业图库

3. **未来优化方向**
   - 考虑使用对象存储（如S3）
   - 实现图片压缩
   - 添加CDN支持

### 查询优化

1. **索引策略**
   - albums表: created_at降序索引
   - images表: album_id索引, created_at降序索引

2. **分页加载**
   - 相册列表分页（每页20个）
   - 图片列表分页（每页50张）

3. **封面图查询优化**
   - 使用子查询获取第一张图片
   - 避免N+1查询问题

### 前端性能

1. **图片懒加载**
   - 使用Intersection Observer
   - 仅加载可见区域图片

2. **缩略图生成**
   - 前端生成缩略图用于列表显示
   - 减少大图加载

3. **虚拟滚动**
   - 大量图片时使用虚拟列表
   - 提升渲染性能

## 安全考虑

### 输入验证

1. **前端验证**
   - 文件类型检查
   - 文件大小检查
   - 相册名称长度限制

2. **后端验证**
   - 使用Zod严格验证所有输入
   - MIME类型白名单
   - SQL注入防护（使用参数化查询）

### 文件安全

1. **MIME类型验证**
   - 仅允许: image/jpeg, image/png, image/gif, image/webp
   - 拒绝可执行文件

2. **内容安全**
   - 考虑添加图片内容扫描
   - 防止恶意图片上传

### 访问控制

1. **当前实现**
   - 无用户认证（单用户系统）
   - 所有操作无权限检查

2. **未来扩展**
   - 添加用户认证
   - 实现相册权限管理
   - 支持公开/私有相册

## 部署考虑

### 数据库迁移

1. **迁移脚本**
   - 创建albums和images表
   - 创建必要索引
   - 设置外键约束

2. **回滚策略**
   - 保留迁移历史
   - 支持版本回退

### 环境配置

1. **开发环境**
   - 使用本地PostgreSQL
   - 启用详细日志

2. **生产环境**
   - 配置数据库连接池
   - 启用错误监控
   - 配置备份策略

### 监控和日志

1. **关键指标**
   - 图片上传成功率
   - API响应时间
   - 数据库查询性能

2. **日志记录**
   - 记录所有错误
   - 记录关键操作（创建、删除）
   - 不记录敏感信息

## 实现优先级

### 第一阶段 (MVP)
1. 数据库表结构
2. 后端API基础功能
3. 前端相册列表页
4. 创建相册和上传图片
5. 查看相册详情

### 第二阶段
1. 删除功能（图片和相册）
2. 编辑相册名称
3. 批量上传优化
4. 错误处理完善

### 第三阶段
1. 性能优化（懒加载、分页）
2. 单元测试
3. 属性测试
4. UI/UX优化

### 第四阶段
1. 图片压缩
2. 缩略图生成
3. 高级搜索功能
4. 相册分类标签
