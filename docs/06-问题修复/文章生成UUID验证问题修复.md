# 文章生成 UUID 验证问题修复

## 问题描述

**症状**：点击"生成文章"按钮后，没有任何反馈，文章无法生成。

**时间**：2026-01-16

**影响范围**：Windows 桌面客户端的文章生成功能

## 问题原因

### 根本原因

Windows 桌面客户端使用本地 SQLite 数据库存储图库和知识库数据，ID 格式为 UUID（如 `8cc646a1-4fbe-4762-abde-ec595b14a5d8`）。

当创建文章生成任务时，客户端将这些 UUID 传递给服务器。服务器在 `validateTaskConfiguration` 方法中尝试验证这些资源是否存在，但直接使用 UUID 查询 PostgreSQL 的 INTEGER 类型字段，导致类型转换错误。

### 错误日志

```
error: invalid input syntax for type integer: "8cc646a1-4fbe-4762-abde-ec595b14a5d8"
    at /var/www/geo-system/server/services/articleGenerationService.js:1421:29
```

### 架构背景

根据系统架构设计：

- **Windows 端**：使用本地 SQLite 存储图库和知识库，ID 为 UUID 格式
- **服务器端**：使用 PostgreSQL 存储图库和知识库，ID 为 INTEGER 格式
- **设计原则**：Windows 端传递 UUID 时，服务器应跳过验证（因为数据在本地）

## 修复方案

### 修改文件

`server/src/services/articleGenerationService.ts`

### 修改内容

在 `validateTaskConfiguration` 方法中，添加类型检查：

**修改前**：
```typescript
// 验证图库
const albumResult = await pool.query(
  'SELECT id FROM albums WHERE id = $1',
  [task.albumId]
);
if (albumResult.rows.length === 0) {
  throw new Error(`图库ID ${task.albumId} 不存在`);
}

// 验证知识库
const kbResult = await pool.query(
  'SELECT id FROM knowledge_bases WHERE id = $1',
  [task.knowledgeBaseId]
);
if (kbResult.rows.length === 0) {
  throw new Error(`知识库ID ${task.knowledgeBaseId} 不存在`);
}
```

**修改后**：
```typescript
// 验证图库（如果是 UUID 格式，说明来自 Windows 端本地数据，跳过验证）
if (typeof task.albumId === 'number') {
  const albumResult = await pool.query(
    'SELECT id FROM albums WHERE id = $1',
    [task.albumId]
  );
  if (albumResult.rows.length === 0) {
    throw new Error(`图库ID ${task.albumId} 不存在`);
  }
} else {
  console.log(`[任务 ${taskId}] 图库ID是UUID格式，跳过服务器验证（来自Windows端本地数据）`);
}

// 验证知识库（如果是 UUID 格式，说明来自 Windows 端本地数据，跳过验证）
if (typeof task.knowledgeBaseId === 'number') {
  const kbResult = await pool.query(
    'SELECT id FROM knowledge_bases WHERE id = $1',
    [task.knowledgeBaseId]
  );
  if (kbResult.rows.length === 0) {
    throw new Error(`知识库ID ${task.knowledgeBaseId} 不存在`);
  }
} else {
  console.log(`[任务 ${taskId}] 知识库ID是UUID格式，跳过服务器验证（来自Windows端本地数据）`);
}
```

### 修复逻辑

1. 检查 `albumId` 和 `knowledgeBaseId` 的类型
2. 如果是 `number` 类型，说明来自服务器数据库，执行验证
3. 如果是 `string` 类型（UUID），说明来自 Windows 端本地数据，跳过验证并记录日志

## 部署步骤

```bash
# 1. 编译后端代码
cd server
npm run build

# 2. 上传到服务器
scp -i "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem" \
  server/dist/services/articleGenerationService.js \
  ubuntu@124.221.247.107:/var/www/geo-system/server/services/

# 3. 重启服务
ssh -i "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem" ubuntu@124.221.247.107 \
  "pm2 restart geo-server"
```

## 验证步骤

1. 打开 Windows 桌面客户端
2. 进入"文章生成"页面
3. 点击"新建任务"
4. 填写所有必填字段：
   - 选择蒸馏历史
   - 选择转化目标
   - 选择企业图库（本地数据）
   - 选择企业知识库（本地数据）
   - 选择文章设置
   - 输入文章数量
5. 点击"生成文章"
6. 确认任务创建成功，状态为"执行中"
7. 等待任务完成，查看生成的文章

## 相关文档

- 架构文档：`docs/07-开发文档/PUBLISHING_ARCHITECTURE_CURRENT.md`
- 技术规范：`.kiro/steering/tech.md` - "数据库 ID 格式统一规范"
- 诊断指南：`windows-login-manager/diagnose-article-generation.md`

## 预防措施

### 代码审查要点

在处理 Windows 端传递的 ID 时，始终检查：

1. ID 可能是 `number`（服务器数据）或 `string`（UUID，本地数据）
2. 在数据库查询前进行类型检查
3. UUID 格式的 ID 应跳过服务器端验证

### 类型定义

确保 TypeScript 类型定义正确：

```typescript
interface TaskConfig {
  distillationId: number;  // 服务器数据，始终是数字
  albumId: number | string;  // 可能是数字或UUID
  knowledgeBaseId: number | string;  // 可能是数字或UUID
  articleSettingId: number;  // 服务器数据，始终是数字
  conversionTargetId?: number;  // 服务器数据，始终是数字
  articleCount: number;
}
```

### 测试建议

1. 测试 Windows 端创建任务（UUID 格式）
2. 测试 Web 端创建任务（数字格式，如果有）
3. 测试混合场景（部分本地数据，部分服务器数据）

## 总结

此问题是由于架构改造后，Windows 端使用本地数据（UUID 格式）与服务器端验证逻辑（期望数字格式）不匹配导致的。

修复方案遵循了架构设计原则：**Windows 端本地数据传递 UUID 时，服务器应跳过验证**。

修复后，文章生成功能恢复正常，Windows 端可以正常创建和执行文章生成任务。
