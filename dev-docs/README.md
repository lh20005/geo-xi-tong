# 开发过程文档

这个文件夹包含了项目开发过程中产生的各种文档、说明和测试文件。

## 📁 文件分类

### 🚀 功能实现总结
- `ARTICLE_GENERATION_COMPLETE.md` - 文章生成模块完成总结
- `ARTICLE_IMAGE_EMBEDDING_SUMMARY.md` - 文章图片嵌入功能总结
- `ARTICLE_QUALITY_IMPROVEMENT_SUMMARY.md` - 文章质量改进总结
- `OLLAMA_INTEGRATION_SUMMARY.md` - Ollama集成实现总结

### 📖 使用指南
- `ARTICLE_GENERATION_README.md` - 文章生成模块部署和使用指南
- `ARTICLE_IMAGE_EMBEDDING_GUIDE.md` - 文章图片嵌入功能指南
- `QUICK_START_ARTICLE_GENERATION.md` - 文章生成快速启动
- `QUICK_START_OLLAMA.md` - Ollama快速启动指南
- `安装说明.md` - 中文安装说明

### 🐛 问题修复
- `BUGFIX_SUMMARY.md` - Ollama配置保存错误修复总结
- `FIX_OLLAMA_SAVE_ERROR.md` - Ollama保存错误修复指南
- `IMPORTANT_FIX_REQUIRED.md` - 重要修复说明
- `CHINESE_FILENAME_FIX.md` - 中文文件名乱码修复
- `KNOWLEDGE_BASE_FIX.md` - 知识库更新失败修复
- `TROUBLESHOOTING.md` - 故障排查指南

### 📋 检查清单
- `IMPLEMENTATION_CHECKLIST.md` - Ollama集成实现检查清单
- `EDGEONE_DEPLOYMENT_CHECKLIST.md` - 腾讯EdgeOne部署检查清单
- `PROJECT_CHECKLIST.md` - 项目交付清单

### 📊 项目总结
- `PROJECT_SUMMARY.md` - 项目交付总结
- `RELEASE_NOTES.md` - 版本发布说明
- `启动成功.md` - 启动成功说明

### 🔍 诊断和测试
- `API诊断报告.md` - API诊断报告
- `test-ollama-integration.md` - Ollama集成测试清单
- `test-api.js` - API测试脚本
- `test-api-consistency.js` - API一致性测试
- `test-fix.sh` - 修复测试脚本

## 📝 说明

这些文档记录了：
- 功能开发的完整过程
- 遇到的问题和解决方案
- 测试和验证步骤
- 部署和使用指南
- 项目里程碑和总结

## 🎯 使用建议

### 新开发者
1. 先阅读 `PROJECT_SUMMARY.md` 了解项目全貌
2. 查看各功能的实现总结文档
3. 参考快速启动指南进行配置

### 遇到问题时
1. 查看 `TROUBLESHOOTING.md` 故障排查指南
2. 查找相关的修复文档（BUGFIX、FIX开头的文件）
3. 参考测试脚本进行验证

### 部署时
1. 查看 `EDGEONE_DEPLOYMENT_CHECKLIST.md` 或相关部署文档
2. 参考快速启动指南
3. 使用检查清单确保完整性

## 📂 与主文档的区别

- **主文档** (`docs/` 和 `README.md`)：面向最终用户的正式文档
- **开发文档** (`dev-docs/`)：开发过程中的记录、问题修复、测试等

## 🔄 维护

这个文件夹应该定期整理：
- 保留有价值的问题解决方案
- 归档过时的临时文档
- 更新到主文档中的内容可以移除

---

**注意**：这些文档主要用于开发团队内部参考，不需要包含在最终的产品发布中。
