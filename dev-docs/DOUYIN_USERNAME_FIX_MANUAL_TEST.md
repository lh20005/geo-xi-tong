# 抖音用户名提取修复 - 手动测试指南

## 修复内容

优化了抖音平台的用户名提取选择器配置，将通用选择器 `.semi-navigation-header-username` 移到列表最前面，确保能够可靠地提取用户名。

## 修改文件

- `server/src/services/AccountService.ts` - 更新了抖音平台的选择器配置

## 测试步骤

### 1. 启动服务

```bash
# 启动后端服务
cd server
npm run dev

# 启动前端服务（新终端）
cd client
npm run dev
```

### 2. 登录抖音平台

1. 打开浏览器访问前端页面
2. 进入"平台管理"页面
3. 点击"添加账号"
4. 选择"抖音号"平台
5. 点击"浏览器登录"按钮
6. 在弹出的浏览器窗口中完成抖音登录

### 3. 验证用户名提取

#### 检查后端日志

登录完成后，查看后端控制台日志，应该看到类似以下输出：

```
[提取用户信息] 开始提取 douyin 平台的用户名
[提取用户信息] 当前页面URL: https://creator.douyin.com/...
[提取用户信息] douyin: 尝试 10 个选择器
[提取用户信息] 尝试选择器 1/10: .semi-navigation-header-username
[提取用户信息] ✅ 找到元素: .semi-navigation-header-username
[提取用户信息] ✅ 成功提取用户名: "你的抖音用户名"
```

**关键点：**
- 应该在第1个选择器就成功提取到用户名
- 用户名应该是你的抖音账号显示名称

#### 检查数据库

```bash
cd server
sqlite3 database.sqlite

# 查询最新的抖音账号
SELECT id, platform_id, account_name, real_username, created_at 
FROM platform_accounts 
WHERE platform_id = 'douyin' 
ORDER BY created_at DESC 
LIMIT 1;
```

**预期结果：**
- `real_username` 字段应该包含你的抖音用户名
- 不应该为空或NULL

#### 检查前端显示

1. 在"平台管理"页面查看账号列表
2. 找到刚添加的抖音账号
3. 确认显示的用户名正确

**预期结果：**
- 账号列表中应该显示真实的抖音用户名
- 不应该显示为"未设置"或空白

### 4. 对比测试（可选）

如果想验证修复前后的差异，可以：

1. 回退代码到修复前的版本
2. 重新登录抖音
3. 对比日志输出，应该会看到前面的选择器都失败，直到尝试到 `.semi-navigation-header-username` 才成功

## 预期结果总结

✅ **成功标志：**
1. 后端日志显示第1个选择器就成功提取用户名
2. 数据库 `real_username` 字段正确填充
3. 前端正确显示用户名
4. 整个过程没有错误日志

❌ **失败标志：**
1. 所有选择器都失败
2. 保存了页面HTML到 `debug/` 目录
3. `real_username` 为空
4. 前端显示"未设置"

## 故障排查

### 如果用户名提取失败

1. 检查 `debug/` 目录下是否有新的HTML文件
2. 打开HTML文件，搜索你的用户名
3. 找到包含用户名的HTML元素
4. 检查该元素的class名称
5. 如果class名称不是 `.semi-navigation-header-username`，需要更新选择器配置

### 如果页面结构变化

抖音可能会更新页面结构，如果通用选择器失效：

1. 查看保存的HTML文件
2. 找到新的用户名元素选择器
3. 更新 `AccountService.ts` 中的选择器列表
4. 将新选择器添加到列表前面

## 参考

- 头条号使用相同的选择器配置，可以作为参考
- 两个平台都使用 Semi Design UI框架
- 选择器配置位置：`server/src/services/AccountService.ts` 第550-600行
