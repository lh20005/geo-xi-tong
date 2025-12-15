# 转化目标管理模块 - 快速启动指南

## 🚀 5分钟快速开始

### 步骤1：运行数据库迁移

```bash
cd server
npm run db:migrate
```

**预期输出：**
```
🔄 开始数据库迁移...
✅ 数据库迁移完成
```

### 步骤2：启动应用

在项目根目录运行：

```bash
./start.command
```

或者分别启动前后端：

```bash
# 终端1 - 启动后端
cd server
npm run dev

# 终端2 - 启动前端
cd client
npm run dev
```

**预期输出：**
- 后端：`🚀 服务器运行在 http://localhost:3000`
- 前端：`Local: http://localhost:5173/`

### 步骤3：访问功能

1. 打开浏览器访问 `http://localhost:5173`
2. 在侧边栏找到"转化目标"菜单项（带有瞄准图标 🎯）
3. 点击进入转化目标管理页面

### 步骤4：开始使用

#### 创建第一个转化目标

1. 点击右上角的"新增转化目标"按钮
2. 填写表单：
   - **公司名称**：例如"示例科技公司"（必填）
   - **行业类型**：选择"互联网"（必填）
   - **公司规模**：选择"51-200人"（必填）
   - **联系方式**：输入邮箱或手机号（必填）
   - **官方网站**：例如"https://example.com"（可选）
   - **公司特色**：描述公司特点（可选）
   - **目标客户群**：描述目标客户（可选）
   - **核心产品服务**：描述核心产品（可选）
3. 点击"保存"按钮

#### 查看转化目标

- 在列表中点击"查看"按钮，以只读模式查看完整信息

#### 编辑转化目标

- 在列表中点击"编辑"按钮，修改信息后保存

#### 删除转化目标

- 在列表中点击"删除"按钮，确认后删除

#### 搜索转化目标

- 在搜索框输入公司名称或行业关键词
- 系统会实时过滤显示匹配的记录

#### 排序和分页

- 点击表格列标题进行排序（升序/降序）
- 使用底部分页控件浏览多页数据
- 可以切换每页显示数量（10/20/50/100）

## 🧪 运行测试

### 后端测试

```bash
cd server
npm test -- conversionTarget.test.ts
```

**预期结果：**
```
Test Suites: 1 passed, 1 total
Tests:       16 passed, 16 total
```

### 前端测试（可选）

首先安装测试依赖：

```bash
cd client
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jest jest-environment-jsdom @types/jest ts-jest fast-check
```

然后运行测试：

```bash
npm test
```

## 📊 功能清单

- ✅ 创建转化目标
- ✅ 查看转化目标详情
- ✅ 编辑转化目标
- ✅ 删除转化目标
- ✅ 搜索转化目标（公司名称、行业）
- ✅ 排序（多列支持）
- ✅ 分页（每页10条，可调整）
- ✅ 表单验证
- ✅ 错误提示
- ✅ 成功消息

## 🔧 故障排除

### 问题1：数据库连接失败

**症状：** 后端启动时显示数据库连接错误

**解决方案：**
1. 确保PostgreSQL正在运行
2. 检查`.env`文件中的`DATABASE_URL`配置
3. 确保数据库已创建

### 问题2：表不存在

**症状：** API调用返回"relation does not exist"错误

**解决方案：**
```bash
cd server
npm run db:migrate
```

### 问题3：端口被占用

**症状：** 启动时提示端口3000或5173已被占用

**解决方案：**
1. 关闭占用端口的程序
2. 或修改端口配置：
   - 后端：修改`server/src/index.ts`中的`PORT`
   - 前端：修改`client/vite.config.ts`中的`server.port`

### 问题4：前端无法连接后端

**症状：** 前端显示网络错误

**解决方案：**
1. 确保后端正在运行（http://localhost:3000）
2. 检查浏览器控制台的错误信息
3. 确认axios配置正确（应该使用相对路径`/api/...`）

## 📝 API端点

所有API端点都在 `/api/conversion-targets` 下：

- `GET /api/conversion-targets` - 获取列表（支持分页、搜索、排序）
- `POST /api/conversion-targets` - 创建新记录
- `GET /api/conversion-targets/:id` - 获取单条记录
- `PATCH /api/conversion-targets/:id` - 更新记录
- `DELETE /api/conversion-targets/:id` - 删除记录

## 🎯 下一步

1. 尝试创建多个转化目标
2. 测试搜索和排序功能
3. 查看属性测试的实现
4. 根据需求自定义字段和验证规则

## 💡 提示

- 公司名称必须唯一
- 联系方式支持手机号（11位）或邮箱格式
- 网站必须以http://或https://开头
- 所有文本字段都有长度限制，表单会显示字符计数
- 删除操作需要确认，防止误删

## 📚 更多信息

- 详细实现说明：查看 `IMPLEMENTATION_SUMMARY.md`
- 需求文档：查看 `requirements.md`
- 设计文档：查看 `design.md`
- 任务列表：查看 `tasks.md`

---

**祝使用愉快！** 🎉
