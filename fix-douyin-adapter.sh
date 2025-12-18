#!/bin/bash

# 修复抖音适配器的图片上传和自主声明问题

echo "开始修复抖音适配器..."

# 使用sed进行替换
# 1. 修复图片上传部分 - 移除点击上传按钮的代码
sed -i.bak1 '237,249d' server/src/services/adapters/DouyinAdapter.ts

# 2. 在相应位置插入新代码
sed -i.bak2 '236a\
      // 不点击上传按钮，直接查找文件input并上传\
      // 这样可以避免触发系统文件选择对话框\
      console.log('\''[抖音号] 🔍 直接查找文件上传input（不点击按钮，避免弹出对话框）...'\'' );\
      console.log('\''[抖音号] ⏳ 等待页面加载完成（2秒）...'\'' );\
      await new Promise(resolve => setTimeout(resolve, 2000));
' server/src/services/adapters/DouyinAdapter.ts

echo "✅ 修复完成！"
echo "备份文件已保存为: server/src/services/adapters/DouyinAdapter.ts.backup"
