# 知识库更新失败问题修复

## 问题描述
在企业知识库模块，修改已有知识库的名称后，点击"保存"按钮提示"更新失败"。

## 问题根源
在 `client/src/pages/KnowledgeBasePage.tsx` 的 `handleEditKnowledgeBase` 函数中，使用了 `let` 变量来存储用户输入：

```typescript
let newName = currentName;
let newDesc = currentDesc;

Modal.confirm({
  content: (
    <Input onChange={(e) => { newName = e.target.value; }} />
  ),
  onOk: async () => {
    // newName 可能没有正确更新
    await axios.patch(`/api/knowledge-bases/${id}`, {
      name: newName.trim(),
      ...
    });
  }
});
```

**问题**：在 `Modal.confirm` 的 `onChange` 回调中直接赋值给 `let` 变量可能不会按预期工作，因为：
1. Modal.confirm 的 content 是静态渲染的
2. onChange 回调中的变量赋值可能因为作用域问题而失效
3. 导致 onOk 中使用的仍然是初始值

## 解决方案
使用对象引用来存储表单数据，确保 onChange 回调能正确更新值：

```typescript
const formData = {
  name: currentName,
  description: currentDesc
};

Modal.confirm({
  content: (
    <Input onChange={(e) => { formData.name = e.target.value; }} />
  ),
  onOk: async () => {
    // formData.name 已正确更新
    await axios.patch(`/api/knowledge-bases/${id}`, {
      name: formData.name.trim(),
      ...
    });
  }
});
```

## 修改文件
- `client/src/pages/KnowledgeBasePage.tsx`

## 测试步骤
1. 启动应用
2. 进入企业知识库页面
3. 点击任意知识库的"编辑"按钮
4. 修改知识库名称和描述
5. 点击"保存"按钮
6. 应该看到"知识库更新成功"的提示
7. 刷新页面，确认修改已保存

## 后端验证
后端 API 已通过 curl 测试验证，工作正常：
```bash
curl -X PATCH http://localhost:3000/api/knowledge-bases/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"更新后的名称","description":"更新后的描述"}'
```

返回：
```json
{"id":1,"name":"更新后的名称","description":"更新后的描述","updated_at":"2025-12-13T09:23:07.092Z"}
```

## 技术说明
这是一个常见的 React/JavaScript 陷阱：
- 在闭包中使用 `let` 变量并在异步回调中修改它可能导致意外行为
- 使用对象引用（引用类型）可以确保修改能够正确传播
- 对象的属性修改会影响所有引用该对象的地方
