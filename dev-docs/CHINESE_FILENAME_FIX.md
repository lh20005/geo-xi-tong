# 中文文件名乱码修复

## 问题描述

企业知识库模块在上传包含中文文件名的文件时，文件名会显示为乱码。

## 根本原因

当使用 `multer` 处理文件上传时，`file.originalname` 字段默认使用 `latin1` 编码。对于包含中文字符的文件名，这会导致编码错误，从而显示为乱码。

## 解决方案

在所有使用 `file.originalname` 的地方，添加编码转换：

```typescript
const originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
```

这个转换将 `latin1` 编码的字符串正确转换为 `utf8` 编码，从而正确显示中文字符。

## 修改的文件

1. **server/src/routes/knowledgeBase.ts**
   - `multer.diskStorage` 的 `filename` 回调
   - `multer` 的 `fileFilter` 回调
   - 文档上传处理逻辑

2. **server/src/services/documentParser.ts**
   - `parseFile` 方法中的文件名处理

## 测试

创建了专门的测试文件 `server/src/services/__tests__/documentParser.encoding.test.ts` 来验证：

- 中文文件名的 txt 文件正确处理
- 中文文件名的 md 文件正确处理
- 中文文件名的扩展名正确识别

所有测试均通过 ✓

## 使用说明

修复后，用户可以：

1. 上传包含中文文件名的文档（如：`产品说明.txt`、`技术文档.md`）
2. 在知识库列表中正确显示中文文件名
3. 在文档详情中正确显示中文文件名
4. 搜索功能正常工作

## 注意事项

- 此修复适用于所有通过 multer 上传的文件
- 不影响文件内容的编码，只修复文件名显示
- 兼容英文和其他语言的文件名
