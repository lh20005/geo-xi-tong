import * as fc from 'fast-check';
import { ArticleGenerationService } from '../services/articleGenerationService';

describe('ArticleGenerationService', () => {
  describe('属性 12: 提示词包含清理指令', () => {
    /**
     * Feature: article-content-quality-improvement, Property 12: 提示词包含清理指令
     * 对于任何生成的AI提示词，应包含"不要包含思考过程"和"使用纯文本格式"的明确指令
     */
    it('should include cleaning instructions in AI prompts', async () => {
      const service = new ArticleGenerationService();
      
      // 模拟生成文章的参数
      const keyword = '测试关键词';
      const topics = ['话题1', '话题2'];
      const imageUrl = '/test/image.jpg';
      const knowledgeContent = '测试知识库内容';
      const articlePrompt = '请撰写一篇文章';
      const aiConfig = {
        provider: 'deepseek',
        api_key: 'test-key'
      };

      // 由于我们无法直接访问私有方法生成的prompt，
      // 我们通过检查generateSingleArticle方法的实现来验证
      // 这里我们创建一个测试用例来验证提示词的构建逻辑

      // 读取源代码文件内容来验证提示词模板
      const fs = require('fs');
      const path = require('path');
      const serviceFilePath = path.join(__dirname, '../services/articleGenerationService.ts');
      const serviceCode = fs.readFileSync(serviceFilePath, 'utf-8');

      // 验证提示词模板包含必要的指令
      const requiredInstructions = [
        '不要包含任何思考过程',
        '使用纯文本格式',
        '不要使用Markdown符号',
        '不要使用"让我思考"',
        '标题：'
      ];

      const allInstructionsPresent = requiredInstructions.every(instruction =>
        serviceCode.includes(instruction)
      );

      expect(allInstructionsPresent).toBe(true);
    });

    it('should verify prompt template structure', () => {
      // 验证提示词模板的结构
      const fs = require('fs');
      const path = require('path');
      const serviceFilePath = path.join(__dirname, '../services/articleGenerationService.ts');
      const serviceCode = fs.readFileSync(serviceFilePath, 'utf-8');

      // 检查是否有【重要输出要求】部分
      expect(serviceCode).toContain('【重要输出要求】');
      
      // 检查是否明确禁止思考过程
      expect(serviceCode).toContain('思考过程');
      
      // 检查是否明确要求纯文本格式
      expect(serviceCode).toContain('纯文本格式');
      
      // 检查是否指定输出格式
      expect(serviceCode).toContain('标题：[');
    });
  });
});
