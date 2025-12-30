#!/bin/bash

# 修复知识库路由的多租户隔离问题
# 包括：UPDATE路由的权限验证和SQL注入修复

echo "=== 修复知识库路由 ==="
echo ""

FILE="server/src/routes/knowledgeBase.ts"

if [ ! -f "$FILE" ]; then
  echo "❌ 文件不存在: $FILE"
  exit 1
fi

# 备份原文件
cp "$FILE" "${FILE}.backup.$(date +%Y%m%d_%H%M%S)"
echo "✅ 已备份原文件"

# 修复UPDATE路由
echo "🔧 修复UPDATE路由..."

# 使用 perl 进行多行替换
perl -i -0pe 's/\/\/ 更新知识库\nknowledgeBaseRouter\.patch\('\''\/\:id'\'', async \(req, res\) => \{\n  try \{\n    const kbId = parseInt\(req\.params\.id\);/\/\/ 更新知识库（验证所有权）\nknowledgeBaseRouter.patch('\''\/\:id'\'', async (req, res) => {\n  try {\n    const userId = getCurrentTenantId(req);\n    const kbId = parseInt(req.params.id);/g' "$FILE"

perl -i -0pe 's/\/\/ 检查知识库是否存在\n    const checkResult = await pool\.query\('\''SELECT id FROM knowledge_bases WHERE id = \$1'\'', \[kbId\]\);/\/\/ 检查知识库是否存在且属于当前用户\n    const checkResult = await pool.query(\n      '\''SELECT id FROM knowledge_bases WHERE id = \$1 AND user_id = \$2'\'',\n      [kbId, userId]\n    );/g' "$FILE"

perl -i -0pe 's/return res\.status\(404\)\.json\(\{ error: '\''知识库不存在'\'' \}\);/return res.status(404).json({ error: '\''知识库不存在或无权访问'\'' });/g' "$FILE"

perl -i -0pe 's/updates\.push\(`name = \$\{paramIndex\+\+\}`\);/updates.push(`name = \$\$\{paramIndex++\}`);/g' "$FILE"

perl -i -0pe 's/updates\.push\(`description = \$\{paramIndex\+\+\}`\);/updates.push(`description = \$\$\{paramIndex++\}`);/g' "$FILE"

perl -i -0pe 's/values\.push\(kbId\);/values.push(kbId);\n    values.push(userId);/g' "$FILE"

perl -i -0pe 's/`UPDATE knowledge_bases SET \$\{updates\.join\('\'', '\'' \)\} WHERE id = \$\{paramIndex\} RETURNING id, name, description, updated_at`/`UPDATE knowledge_bases \n       SET \$\{updates.join('\'', '\'' )\} \n       WHERE id = \$\$\{paramIndex\} AND user_id = \$\$\{paramIndex + 1\}\n       RETURNING id, name, description, updated_at`/g' "$FILE"

echo "✅ UPDATE路由修复完成"

# 修复搜索文档路由
echo "🔧 修复搜索文档路由..."

perl -i -0pe 's/\/\/ 搜索文档\nknowledgeBaseRouter\.get\('\''\/\:id\/documents\/search'\'', async \(req, res\) => \{\n  try \{\n    const kbId = parseInt\(req\.params\.id\);/\/\/ 搜索文档（验证所有权）\nknowledgeBaseRouter.get('\''\/\:id\/documents\/search'\'', async (req, res) => {\n  try {\n    const userId = getCurrentTenantId(req);\n    const kbId = parseInt(req.params.id);/g' "$FILE"

# 在搜索前添加权限验证
perl -i -0pe 's/if \(!query \|\| query\.trim\(\)\.length === 0\) \{\n      return res\.status\(400\)\.json\(\{ error: '\''请提供搜索关键词'\'' \}\);\n    \}\n    \n    \/\/ 使用PostgreSQL全文搜索/if (!query || query.trim().length === 0) {\n      return res.status(400).json({ error: '\''请提供搜索关键词'\'' });\n    }\n    \n    \/\/ 验证知识库所有权\n    const kbCheck = await pool.query(\n      '\''SELECT id FROM knowledge_bases WHERE id = \$1 AND user_id = \$2'\'',\n      [kbId, userId]\n    );\n    \n    if (kbCheck.rows.length === 0) {\n      return res.status(404).json({ error: '\''知识库不存在或无权访问'\'' });\n    }\n    \n    \/\/ 使用PostgreSQL全文搜索/g' "$FILE"

echo "✅ 搜索文档路由修复完成"

echo ""
echo "🎉 所有修复完成！"
echo ""
echo "📝 修改的文件: $FILE"
echo "💾 备份文件: ${FILE}.backup.*"
echo ""
echo "⚠️  请重启服务器以应用更改"
echo ""
