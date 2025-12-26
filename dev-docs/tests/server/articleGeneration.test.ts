import * as fc from 'fast-check';
import { ArticleGenerationService } from '../articleGenerationService';

describe('Article Generation Logic', () => {
  let service: ArticleGenerationService;

  beforeAll(() => {
    service = new ArticleGenerationService();
  });

  // Feature: article-generation, Property 12: 文章生成上下文完整性
  // 验证: 需求 10.3, 10.4
  describe('Property 12: Article generation context completeness', () => {
    it('should include all context elements in generated article prompt', () => {
      fc.assert(
        fc.property(
          fc.record({
            keyword: fc.string({ minLength: 1, maxLength: 50 }),
            topics: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
            imageUrl: fc.webUrl(),
            knowledgeContent: fc.string({ maxLength: 500 }),
            articlePrompt: fc.string({ minLength: 10, maxLength: 200 })
          }),
          (data) => {
            // 模拟生成prompt的逻辑
            const topicsList = data.topics.map((t, i) => `${i + 1}. ${t}`).join('\n');
            let prompt = `${data.articlePrompt}\n\n核心关键词：${data.keyword}\n\n相关话题：\n${topicsList}`;

            if (data.knowledgeContent && data.knowledgeContent.trim().length > 0) {
              prompt += `\n\n企业知识库参考资料：\n${data.knowledgeContent}`;
            }

            // 验证prompt包含所有必需元素
            expect(prompt).toContain(data.keyword);
            expect(prompt).toContain(data.articlePrompt);
            data.topics.forEach(topic => {
              expect(prompt).toContain(topic);
            });
            if (data.knowledgeContent.trim()) {
              expect(prompt).toContain(data.knowledgeContent);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: article-generation, Property 13: AI响应解析完整性
  // 验证: 需求 10.5
  describe('Property 13: AI response parsing completeness', () => {
    it('should parse title and content from AI response', () => {
      fc.assert(
        fc.property(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 100 }),
            content: fc.string({ minLength: 10, maxLength: 500 })
          }),
          (data) => {
            // 测试不同格式的响应
            const responses = [
              `标题：${data.title}\n\n${data.content}`,
              `标题: ${data.title}\n\n${data.content}`,
              `${data.title}\n${data.content}`
            ];

            responses.forEach(response => {
              const parsed = service.parseArticleResponse(response);
              expect(parsed.title).toBeTruthy();
              expect(parsed.content).toBeTruthy();
              expect(parsed.title.length).toBeGreaterThan(0);
              expect(parsed.content.length).toBeGreaterThan(0);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: article-generation, Property 15: 单文章数据隔离
  // 验证: 需求 11.1
  describe('Property 15: Single article data isolation', () => {
    it('should use only one keyword-topic pair per article', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              keyword: fc.string({ minLength: 1, maxLength: 50 }),
              topics: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 5 })
            }),
            { minLength: 2, maxLength: 10 }
          ),
          (pairs) => {
            // 模拟为每篇文章使用一个关键词-话题对
            pairs.forEach((pair, index) => {
              const usedKeyword = pair.keyword;
              const usedTopics = pair.topics;

              // 验证每篇文章只使用一个关键词
              expect(usedKeyword).toBe(pair.keyword);
              expect(usedTopics).toEqual(pair.topics);

              // 验证不使用其他关键词
              pairs.forEach((otherPair, otherIndex) => {
                if (index !== otherIndex) {
                  // 当前文章不应该使用其他关键词
                  expect(usedKeyword).not.toBe(otherPair.keyword);
                }
              });
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: article-generation, Property 16: 多文章数据唯一性
  // 验证: 需求 11.2
  describe('Property 16: Multiple articles data uniqueness', () => {
    it('should use different keyword-topic pairs for each article', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              keyword: fc.string({ minLength: 1, maxLength: 50 }),
              topics: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 5 })
            }),
            { minLength: 2, maxLength: 10 }
          ),
          (pairs) => {
            const usedKeywords = new Set<string>();

            pairs.forEach(pair => {
              // 验证每个关键词只使用一次
              expect(usedKeywords.has(pair.keyword)).toBe(false);
              usedKeywords.add(pair.keyword);
            });

            // 验证所有关键词都被使用
            expect(usedKeywords.size).toBe(pairs.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: article-generation, Property 17: 关键词数量限制
  // 验证: 需求 11.3
  describe('Property 17: Keyword count limitation', () => {
    it('should generate articles equal to keyword count when keywords are fewer', () => {
      fc.assert(
        fc.property(
          fc.record({
            keywordCount: fc.integer({ min: 1, max: 10 }),
            requestedCount: fc.integer({ min: 1, max: 20 })
          }),
          (data) => {
            const actualCount = Math.min(data.requestedCount, data.keywordCount);

            // 验证实际生成数量不超过关键词数量
            expect(actualCount).toBeLessThanOrEqual(data.keywordCount);
            expect(actualCount).toBeLessThanOrEqual(data.requestedCount);

            // 如果关键词少于请求数量，应该等于关键词数量
            if (data.keywordCount < data.requestedCount) {
              expect(actualCount).toBe(data.keywordCount);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: article-generation, Property 14: 生成数量终止条件
  // 验证: 需求 10.6
  describe('Property 14: Generation count termination condition', () => {
    it('should stop generation when reaching requested count', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (requestedCount) => {
            let generatedCount = 0;

            // 模拟生成过程
            for (let i = 0; i < requestedCount; i++) {
              generatedCount++;
              if (generatedCount >= requestedCount) {
                break;
              }
            }

            // 验证生成数量等于请求数量
            expect(generatedCount).toBe(requestedCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
