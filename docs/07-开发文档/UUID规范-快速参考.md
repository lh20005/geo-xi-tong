# UUID 规范 - 快速参考

**更新日期**: 2026-01-17  
**状态**: ✅ 已完成  

---

## 核心结论

### ✅ GEO 系统中所有表都使用 SERIAL，没有例外！

---

## 为什么不需要 UUID？

### 架构说明

```
┌─────────────────────┐
│  Windows 端         │
│  数据库: geo_windows │  ← 本地 PostgreSQL
│  用户: lzc          │
└──────────┬──────────┘
           │
           │ HTTP API
           │ (不能直接 SQL 查询)
           │
┌──────────▼──────────┐
│  服务器端           │
│  数据库: geo_system  │  ← 远程 PostgreSQL
│  用户: geo_user     │
└─────────────────────┘
```

**关键点**：
1. **两个独立的数据库**（不是同一个）
2. **不能直接通信**（只能通过 HTTP API）
3. **API 中的 ID 只是临时参数**（不持久化到 Windows 端数据库）

### 实际流程示例

```typescript
// Windows 端代码
async publishArticle() {
  // 1. 调用 API 预留配额
  const response = await fetch('https://jzgeo.cc/api/quota/reserve', {...});
  const { reservationId } = await response.json();
  // reservationId = 123（整数，保存在内存变量中）
  
  // 2. 执行发布
  await this.performPublish();
  
  // 3. 确认配额
  await fetch('https://jzgeo.cc/api/quota/confirm', {
    body: JSON.stringify({ reservationId: 123 })
  });
  
  // ← reservationId 变量销毁，不存储到任何数据库
}
```

**结论**：
- `reservationId` 只在函数执行期间存在（内存变量）
- **不会**存储到 Windows 端的 `geo_windows` 数据库
- **不需要** UUID 的"全局唯一性"
- 使用 SERIAL（整数）即可

---

## 已更新的文件

### ✅ Steering 文件（强制规范）

1. **`.kiro/steering/postgresql.md`**
   - 删除了错误的 UUID 特殊场景说明
   - 明确"GEO 系统中没有需要使用 UUID 的场景"
   - 更新了禁止事项和必须遵守的规则

2. **`.kiro/steering/tech.md`**
   - 更新了"数据库 ID 格式统一规范"
   - 明确说明 Windows 端和服务器端是两个独立的数据库
   - 更新了 API 规范（reservationId 为 number 类型）

### ✅ 数据库层面

1. **服务器数据库**
   - 所有 4 个表已转换为 SERIAL
   - 无 UUID 列存在

2. **迁移文件**
   - 所有迁移文件已更新为 SERIAL

### ✅ 文档

1. `docs/07-开发文档/UUID问题最终修复报告.md` - 详细分析
2. `docs/07-开发文档/UUID到SERIAL类型修复-完整清单.md` - TypeScript 修复清单
3. `docs/07-开发文档/UUID规范更新完成报告.md` - 更新总结

### 🔄 待完成

**TypeScript 类型定义**（约 15 个文件）：
- `reservationId: string` → `reservationId: number`
- `snapshotId: string` → `snapshotId: number`

详见：`docs/07-开发文档/UUID到SERIAL类型修复-完整清单.md`

---

## 强制规范

### ❌ 绝对禁止

1. **主键使用 UUID**（必须使用 SERIAL，GEO 系统无例外）
2. **认为 API 传递的 ID 需要 UUID**（错误！只是临时参数）
3. **TypeScript 中使用 `reservationId: string`**（应该是 `number`）

### ✅ 必须遵守

1. **主键类型：SERIAL（自增整数），所有表无例外**
2. **API 传递的 ID：使用 number 类型（对应 SERIAL）**
3. **判断标准：只有当 ID 需要在不同数据库间持久化存储时才考虑 UUID**
4. **GEO 系统：没有需要持久化存储的跨数据库 ID**

---

## 快速检查清单

### 创建新表时

```sql
-- ✅ 正确
CREATE TABLE new_table (
    id SERIAL PRIMARY KEY,  -- 使用 SERIAL
    user_id INTEGER NOT NULL,
    ...
);

-- ❌ 错误
CREATE TABLE new_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- 不要用 UUID
    ...
);
```

### 编写 API 时

```typescript
// ✅ 正确
interface ReserveQuotaResponse {
  reservationId: number;  // number 类型
  expiresAt: string;
}

// ❌ 错误
interface ReserveQuotaResponse {
  reservationId: string;  // 不要用 string
  expiresAt: string;
}
```

### 判断是否需要 UUID

**问自己**：
1. 这个 ID 是否需要存储到 Windows 端数据库？
   - 如果**否** → 使用 SERIAL
2. 这个 ID 是否需要在不同数据库间持久化？
   - 如果**否** → 使用 SERIAL
3. 这个 ID 只是 API 临时传递的参数？
   - 如果**是** → 使用 SERIAL

**GEO 系统中所有场景的答案都是：使用 SERIAL**

---

## 性能对比

| 指标 | SERIAL | UUID | 差异 |
|------|--------|------|------|
| 插入速度 | 快 | 慢 3.75x | ⚠️ |
| 索引大小 | 小 | 大 2x | ⚠️ |
| 存储空间 | 8 字节 | 16 字节 | ⚠️ |
| 查询速度 | 快 | 慢 2.4x | ⚠️ |

---

## 参考文档

- **详细分析**: `docs/07-开发文档/UUID问题最终修复报告.md`
- **修复清单**: `docs/07-开发文档/UUID到SERIAL类型修复-完整清单.md`
- **更新总结**: `docs/07-开发文档/UUID规范更新完成报告.md`
- **强制规范**: `.kiro/steering/postgresql.md`
- **技术栈**: `.kiro/steering/tech.md`

---

**最后更新**: 2026-01-17  
**状态**: ✅ 规范已完成
