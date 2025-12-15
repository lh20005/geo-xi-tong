import * as fc from 'fast-check';
import { render, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DistillationHistoryEnhancedPage from '../DistillationHistoryEnhancedPage';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Wrapper component for Router
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('DistillationHistoryEnhancedPage Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Feature: distillation-usage-display-enhancement, Property 1: 列表显示完整性
  describe('Property 1: 列表显示完整性', () => {
    it('should always display usage_count column for any distillation data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.nat({ max: 10000 }),
              keyword: fc.string({ minLength: 1, maxLength: 50 }),
              provider: fc.constantFrom('deepseek', 'gemini', 'ollama'),
              topicCount: fc.nat({ max: 100 }),
              usageCount: fc.nat({ max: 500 }),
              lastUsedAt: fc.option(fc.date().map(d => d.toISOString()), { nil: null }),
              createdAt: fc.date().map(d => d.toISOString())
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (distillations) => {
            const mockResponse = {
              distillations,
              total: distillations.length
            };

            mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

            const { container } = render(
              <Wrapper>
                <DistillationHistoryEnhancedPage />
              </Wrapper>
            );

            // 等待数据加载
            await waitFor(() => {
              expect(mockedAxios.get).toHaveBeenCalledWith(
                '/api/distillation/stats',
                expect.any(Object)
              );
            });

            // 验证表格渲染
            await waitFor(() => {
              const table = container.querySelector('.ant-table');
              expect(table).toBeInTheDocument();
            });

            // 验证每行数据都显示了usage_count
            await waitFor(() => {
              distillations.forEach(dist => {
                // 查找包含usage count的元素
                const usageCountText = `${dist.usageCount}次`;
                expect(container.textContent).toContain(usageCountText);
              });
            });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should display all required columns', async () => {
      const mockData = {
        distillations: [
          {
            id: 1,
            keyword: 'test',
            provider: 'deepseek',
            topicCount: 5,
            usageCount: 10,
            lastUsedAt: '2024-01-01T10:00:00Z',
            createdAt: '2024-01-01T09:00:00Z'
          }
        ],
        total: 1
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockData });

      const { container } = render(
        <Wrapper>
          <DistillationHistoryEnhancedPage />
        </Wrapper>
      );

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalled();
      });

      // 验证所有必需列都存在
      await waitFor(() => {
        expect(container.textContent).toContain('关键词');
        expect(container.textContent).toContain('AI模型');
        expect(container.textContent).toContain('话题数量');
        expect(container.textContent).toContain('被引用次数');
        expect(container.textContent).toContain('最近使用');
        expect(container.textContent).toContain('创建时间');
        expect(container.textContent).toContain('操作');
      });
    });
  });
});
