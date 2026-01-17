# PostgreSQL 主键策略 - 快速参考卡片

## 🎯 核心原则

**GEO 系统统一使用 SERIAL（自增整数）作为主键**

---

## ✅ 正确做法

### 主键定义

```sql
CREATE TABLE articles (
    id SERIAL PRIMARY KEY,  -- ✅ 自增整数
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 外键关联

```sql
CREATE TABLE generation_tasks (
    id SERIAL PRIMARY KEY,
    knowledge_base_id INTEGER,  -- ✅ 类型一致
    album_id INTEGER,           -- ✅ 类型一致
    user_id INTEGER NOT NULL
);
```

### TypeScript 类型

```typescript
interface Article {
  id: number;      // ✅ SERIAL -> number
  userId: number;
  title: string;
}
```

---

## ❌ 错误做法

### 使用 UUID 主键

```sql
CREATE TABLE articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- ❌ 性能差
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL
);
```

### 类型不一致

```sql
CREATE TABLE generation_tasks (
    id SERIAL PRIMARY KEY,
    knowledge_base_id TEXT,  -- ❌ 类型不匹配
    album_id TEXT,           -- ❌ 类型不匹配
    user_id INTEGER NOT NULL
);
```

### TypeScript 类型错误

```typescript
interface Article {
  id: string;  // ❌ 错误！应该是 number
  userId: number;
  title: string;
}
```

---

## 📊 性能对比

| 指标 | SERIAL | UUID | 结论 |
|------|--------|------|------|
| 插入速度 | 12 秒 | 45 秒 | **SERIAL 快 3.75x** |
| 索引大小 | 21 MB | 42 MB | **SERIAL 小 50%** |
| 存储空间 | 8 字节 | 16 字节 | **SERIAL 小 50%** |
| 查询速度 | 0.5 ms | 1.2 ms | **SERIAL 快 2.4x** |

---

## 🔧 特殊场景

### 唯一允许 UUID 的场景

```sql
-- 配额预留 ID（服务器生成，Windows 端存储）
CREATE TABLE quota_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL,
    quota_type VARCHAR(50) NOT NULL
);
```

### 双 ID 策略（安全性需求）

```sql
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,              -- 内部使用（性能）
    public_id VARCHAR(32) UNIQUE NOT NULL 
        DEFAULT encode(gen_random_bytes(16), 'hex'),  -- 外部使用（安全）
    user_id INTEGER NOT NULL
);
```

---

## 🚨 常见错误

### 错误 1：类型不匹配

```
ERROR: operator does not exist: integer = text
```

**原因**：关联字段类型不一致

**解决**：统一使用 INTEGER

### 错误 2：UUID 性能问题

**症状**：
- 插入速度慢
- 索引膨胀
- 查询变慢

**解决**：改用 SERIAL

---

## 📝 检查清单

- [ ] 所有主键使用 SERIAL
- [ ] 所有外键使用 INTEGER
- [ ] TypeScript 类型使用 number
- [ ] 避免使用 UUID（除非特殊场景）
- [ ] 关联字段类型一致
- [ ] 使用参数化查询

---

## 🔗 相关文档

- [PostgreSQL主键策略-UUID迁移到SERIAL最佳实践](./PostgreSQL主键策略-UUID迁移到SERIAL最佳实践.md)
- [PostgreSQL 数据库配置规范](./.kiro/steering/postgresql.md)
- [Dashboard 资源排行 API 类型错误修复](../06-问题修复/DASHBOARD_TOP_RESOURCES_TYPE_FIX.md)

---

**更新日期**: 2026-01-17  
**状态**: ✅ 已完成
