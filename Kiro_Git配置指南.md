# Kiro Git配置指南

## 当前配置状态

### ✅ 已配置项
- **用户名**: lh20005
- **邮箱**: wozhenaini7758522@gmail.com
- **远程仓库**: https://github.com/lh20005/geo-xi-tong.git
- **凭证助手**: osxkeychain (macOS钥匙串)

### 我刚才的操作步骤
```bash
# 1. 添加所有更改
git add .

# 2. 提交更改
git commit -m "feat: 蒸馏结果功能完整实现..."

# 3. 推送到GitHub
git push origin main
```

## 为什么Kiro源代码管理无法直接提交？

可能的原因：

### 1. GitHub认证问题
Kiro的源代码管理可能无法访问macOS钥匙串中保存的GitHub凭证。

### 2. 需要配置GitHub Personal Access Token (PAT)

## 解决方案：配置GitHub Personal Access Token

### 步骤1: 创建GitHub Personal Access Token

1. 访问 GitHub: https://github.com/settings/tokens
2. 点击 "Generate new token" → "Generate new token (classic)"
3. 设置Token信息：
   - **Note**: Kiro IDE Access
   - **Expiration**: 90 days 或 No expiration
   - **Select scopes**: 勾选以下权限
     - ✅ `repo` (完整的仓库访问权限)
     - ✅ `workflow` (如果需要GitHub Actions)
4. 点击 "Generate token"
5. **重要**: 复制生成的token（只显示一次！）

### 步骤2: 配置Git使用Token

#### 方法A: 使用Git Credential Manager (推荐)

```bash
# 配置Git使用凭证管理器
git config --global credential.helper osxkeychain

# 下次推送时会提示输入用户名和密码
# 用户名: lh20005
# 密码: 粘贴你的Personal Access Token
```

#### 方法B: 在远程URL中包含Token (不推荐，安全性较低)

```bash
# 更新远程仓库URL，包含token
git remote set-url origin https://YOUR_TOKEN@github.com/lh20005/geo-xi-tong.git

# 例如：
# git remote set-url origin https://ghp_xxxxxxxxxxxxxxxxxxxx@github.com/lh20005/geo-xi-tong.git
```

#### 方法C: 使用SSH密钥 (最安全，推荐)

```bash
# 1. 生成SSH密钥（如果还没有）
ssh-keygen -t ed25519 -C "wozhenaini7758522@gmail.com"

# 2. 启动ssh-agent
eval "$(ssh-agent -s)"

# 3. 添加SSH密钥到ssh-agent
ssh-add ~/.ssh/id_ed25519

# 4. 复制公钥到剪贴板
pbcopy < ~/.ssh/id_ed25519.pub

# 5. 添加SSH密钥到GitHub
# 访问: https://github.com/settings/keys
# 点击 "New SSH key"
# 粘贴公钥

# 6. 更改远程仓库URL为SSH
git remote set-url origin git@github.com:lh20005/geo-xi-tong.git

# 7. 测试SSH连接
ssh -T git@github.com
```

### 步骤3: 测试配置

```bash
# 创建一个测试提交
echo "test" > test.txt
git add test.txt
git commit -m "test: 测试Git配置"
git push origin main

# 如果成功，删除测试文件
git rm test.txt
git commit -m "chore: 删除测试文件"
git push origin main
```

## Kiro IDE中的Git操作

### 在Kiro中提交代码的步骤

1. **暂存更改**
   - 在源代码管理面板中
   - 点击文件旁边的 "+" 号暂存更改
   - 或点击 "全部暂存" 按钮

2. **编写提交信息**
   - 在顶部的消息框中输入提交信息
   - 例如: "feat: 添加新功能"

3. **提交**
   - 点击 "✓ 提交" 按钮
   - 这会创建本地提交

4. **推送到GitHub**
   - 点击 "..." 菜单
   - 选择 "推送" 或 "Push"
   - 或使用快捷键

### 如果推送失败

#### 错误1: Authentication failed
```
解决方案：
1. 确保已创建GitHub Personal Access Token
2. 在推送时输入用户名和Token
3. 或配置SSH密钥
```

#### 错误2: Permission denied
```
解决方案：
1. 检查Token权限是否包含repo
2. 检查SSH密钥是否已添加到GitHub
```

#### 错误3: Could not read from remote repository
```
解决方案：
1. 检查网络连接
2. 验证远程仓库URL是否正确
3. 测试SSH连接: ssh -T git@github.com
```

## 推荐配置（最佳实践）

### 使用SSH密钥（最安全）

```bash
# 1. 生成SSH密钥
ssh-keygen -t ed25519 -C "wozhenaini7758522@gmail.com"

# 2. 添加到ssh-agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# 3. 复制公钥
pbcopy < ~/.ssh/id_ed25519.pub

# 4. 添加到GitHub
# https://github.com/settings/keys

# 5. 更改远程URL
git remote set-url origin git@github.com:lh20005/geo-xi-tong.git

# 6. 测试
ssh -T git@github.com
```

### 配置Git全局设置

```bash
# 设置默认分支名
git config --global init.defaultBranch main

# 设置推送行为
git config --global push.default current

# 设置自动换行
git config --global core.autocrlf input

# 设置编辑器（可选）
git config --global core.editor "code --wait"

# 查看所有配置
git config --global --list
```

## 快速检查清单

在Kiro中提交前，确保：

- [ ] Git用户名和邮箱已配置
- [ ] 远程仓库URL正确
- [ ] GitHub认证已配置（Token或SSH）
- [ ] 可以成功执行 `git push`
- [ ] Kiro有权限访问Git凭证

## 常用Git命令

```bash
# 查看状态
git status

# 查看远程仓库
git remote -v

# 查看配置
git config --list

# 测试推送（不实际推送）
git push --dry-run origin main

# 查看最近的提交
git log --oneline -5

# 查看当前分支
git branch

# 拉取最新代码
git pull origin main
```

## 故障排除

### 问题1: Kiro提示"无法推送"

**解决方案**：
```bash
# 在终端中手动推送一次，输入凭证
git push origin main

# 凭证会被保存到钥匙串
# 之后Kiro应该可以使用
```

### 问题2: 每次都要输入密码

**解决方案**：
```bash
# 配置凭证缓存
git config --global credential.helper osxkeychain

# 或使用SSH密钥（推荐）
```

### 问题3: Kiro无法访问钥匙串

**解决方案**：
1. 打开"钥匙串访问"应用
2. 搜索"github.com"
3. 确保Kiro有访问权限
4. 或使用SSH密钥代替HTTPS

## 下次提交的完整流程

### 在Kiro IDE中：

1. **修改代码** → 保存文件

2. **源代码管理面板**：
   - 查看更改的文件
   - 点击 "+" 暂存更改

3. **编写提交信息**：
   ```
   feat: 添加新功能
   
   - 功能1
   - 功能2
   ```

4. **提交**：
   - 点击 "✓ 提交" 按钮

5. **推送**：
   - 点击 "..." → "推送"
   - 或点击状态栏的推送按钮

### 如果推送失败，在终端中：

```bash
# 手动推送
git push origin main

# 如果提示输入凭证
# 用户名: lh20005
# 密码: 你的Personal Access Token
```

## 总结

你的Git配置基本正确，主要需要：

1. **创建GitHub Personal Access Token**
2. **配置Token或SSH密钥**
3. **在Kiro中测试推送**

推荐使用SSH密钥，这样最安全且不需要每次输入密码。

---

**配置完成后，你就可以直接在Kiro中提交和推送代码了！**
