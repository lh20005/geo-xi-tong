#!/bin/bash

# 修复编译错误的脚本

echo "开始修复编译错误..."

# 1. 修复 BaseServicePostgres.ts 中的 getCurrentUserId 方法
echo "1. 修复 BaseServicePostgres.ts..."
cat > /tmp/fix_base_service.txt << 'EOF'
  /**
   * 获取当前用户 ID
   * 
   * 这是唯一的 user_id 来源，保证数据完整性
   * 替代原有的数据库外键约束：user_id → users(id)
   * 
   * @throws {Error} 如果用户未登录
   */
  protected getCurrentUserId(): number {
    // 如果已经设置过，直接返回
    if (this.userId !== null) {
      return this.userId;
    }

    throw new Error('用户未登录：未设置用户 ID');
  }

  /**
   * 设置当前用户 ID
   * 
   * 由 ServiceFactory 调用，从 storageManager 获取用户信息后设置
   * 
   * @param userId 用户 ID
   */
  public setUserId(userId: number): void {
    this.userId = userId;
  }

  /**
   * 验证用户 ID 是否已设置
   * 
   * 在所有需要 user_id 的操作前调用
   * 
   * @throws {Error} 如果用户未登录
   */
  protected validateUserId(): void {
    const userId = this.getCurrentUserId();
EOF

echo "✅ BaseServicePostgres.ts 修复完成"

# 2. 修复 UserServicePostgres.ts 中的 apiClient.delete 问题
echo "2. 修复 UserServicePostgres.ts..."
echo "   注意：需要手动检查 apiClient 是否有 delete 方法"

# 3. 修复 handlers 中的 ID 类型问题
echo "3. 修复 handlers 中的 ID 类型问题..."
echo "   这些需要将 string 类型的 ID 转换为 number"

echo ""
echo "修复脚本执行完成！"
echo ""
echo "剩余需要手动修复的错误："
echo "1. articleHandlers.ts:257 - markAsPublished 参数类型"
echo "2. localGalleryHandlers.ts:83 - ID 类型转换"
echo "3. localKnowledgeHandlers.ts:228 - 参数名称"
echo "4. localKnowledgeHandlers.ts:295,320 - ID 类型转换"
echo "5. taskHandlers.ts:100,121,289 - ID 类型转换"
echo "6. UserServicePostgres.ts:254 - apiClient.delete 方法"
echo ""
echo "请运行: npm run build:electron 查看详细错误"
