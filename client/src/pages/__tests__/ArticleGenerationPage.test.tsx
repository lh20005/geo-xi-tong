import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ArticleGenerationPage from '../ArticleGenerationPage';
import * as articleGenerationApi from '../../api/articleGenerationApi';
import type { GenerationTask } from '../../types/articleGeneration';

// Mock the API module
vi.mock('../../api/articleGenerationApi');

// Mock Ant Design components that might cause issues in tests
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    message: {
      error: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
  };
});

describe('ArticleGenerationPage - Table Enhancement', () => {
  const mockTasks: GenerationTask[] = [
    {
      id: 1,
      distillationId: 1,
      albumId: 1,
      knowledgeBaseId: 1,
      articleSettingId: 1,
      conversionTargetId: 5,
      requestedCount: 10,
      generatedCount: 5,
      status: 'running',
      progress: 50,
      errorMessage: null,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T01:00:00Z',
      conversionTargetName: 'Test Company Ltd',
      keyword: 'AI技术',
      provider: 'deepseek',
    },
    {
      id: 2,
      distillationId: 2,
      albumId: 1,
      knowledgeBaseId: 1,
      articleSettingId: 1,
      conversionTargetId: null,
      requestedCount: 5,
      generatedCount: 5,
      status: 'completed',
      progress: 100,
      errorMessage: null,
      createdAt: '2025-01-02T00:00:00Z',
      updatedAt: '2025-01-02T01:00:00Z',
      conversionTargetName: null,
      keyword: '机器学习',
      provider: 'gemini',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(articleGenerationApi.fetchTasks).mockResolvedValue({
      tasks: mockTasks,
      total: 2,
      page: 1,
      pageSize: 10,
    });
  });

  describe('Column Rendering Tests', () => {
    it('should render table with new columns: 转化目标, 关键词, 蒸馏结果', async () => {
      render(<ArticleGenerationPage />);

      await waitFor(() => {
        expect(screen.getByText('转化目标')).toBeInTheDocument();
        expect(screen.getByText('关键词')).toBeInTheDocument();
        expect(screen.getByText('蒸馏结果')).toBeInTheDocument();
      });
    });

    it('should NOT render 更新时间 column', async () => {
      render(<ArticleGenerationPage />);

      await waitFor(() => {
        expect(screen.queryByText('更新时间')).not.toBeInTheDocument();
      });
    });

    it('should NOT render 错误信息 column', async () => {
      render(<ArticleGenerationPage />);

      await waitFor(() => {
        expect(screen.queryByText('错误信息')).not.toBeInTheDocument();
      });
    });
  });

  describe('Conversion Target Display Tests', () => {
    /**
     * Feature: article-generation-table-enhancement
     * Tests Requirements 1.1, 1.3
     */
    it('should display conversion target name when present', async () => {
      render(<ArticleGenerationPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Company Ltd')).toBeInTheDocument();
      });
    });

    it('should display "-" when conversion target is null', async () => {
      render(<ArticleGenerationPage />);

      await waitFor(() => {
        const cells = screen.getAllByText('-');
        expect(cells.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Keyword Display Tests', () => {
    /**
     * Feature: article-generation-table-enhancement
     * Tests Requirements 2.1, 2.4
     */
    it('should render keywords as blue Tags', async () => {
      render(<ArticleGenerationPage />);

      await waitFor(() => {
        const keywordTag1 = screen.getByText('AI技术');
        const keywordTag2 = screen.getByText('机器学习');
        
        expect(keywordTag1).toBeInTheDocument();
        expect(keywordTag2).toBeInTheDocument();
        
        // Check if they are rendered as Tag components (they should have the ant-tag class)
        expect(keywordTag1.closest('.ant-tag')).toBeInTheDocument();
        expect(keywordTag2.closest('.ant-tag')).toBeInTheDocument();
      });
    });
  });

  describe('Provider Display Tests', () => {
    /**
     * Feature: article-generation-table-enhancement
     * Tests Requirements 3.1, 3.3, 3.4
     */
    it('should render DeepSeek provider as purple Tag', async () => {
      render(<ArticleGenerationPage />);

      await waitFor(() => {
        const deepseekTag = screen.getByText('DeepSeek');
        expect(deepseekTag).toBeInTheDocument();
        expect(deepseekTag.closest('.ant-tag')).toBeInTheDocument();
      });
    });

    it('should render Gemini provider as green Tag', async () => {
      render(<ArticleGenerationPage />);

      await waitFor(() => {
        const geminiTag = screen.getByText('Gemini');
        expect(geminiTag).toBeInTheDocument();
        expect(geminiTag.closest('.ant-tag')).toBeInTheDocument();
      });
    });
  });

  describe('Column Order Tests', () => {
    /**
     * Feature: article-generation-table-enhancement
     * Tests Requirements 1.1, 2.1, 3.1
     */
    it('should display columns in correct order', async () => {
      const { container } = render(<ArticleGenerationPage />);

      await waitFor(() => {
        const headers = container.querySelectorAll('.ant-table-thead th');
        const headerTexts = Array.from(headers).map(h => h.textContent);

        // Check that new columns appear after 状态 and before 进度
        const statusIndex = headerTexts.findIndex(text => text?.includes('状态'));
        const conversionTargetIndex = headerTexts.findIndex(text => text?.includes('转化目标'));
        const keywordIndex = headerTexts.findIndex(text => text?.includes('关键词'));
        const providerIndex = headerTexts.findIndex(text => text?.includes('蒸馏结果'));
        const progressIndex = headerTexts.findIndex(text => text?.includes('进度'));

        expect(statusIndex).toBeGreaterThan(-1);
        expect(conversionTargetIndex).toBeGreaterThan(statusIndex);
        expect(keywordIndex).toBeGreaterThan(conversionTargetIndex);
        expect(providerIndex).toBeGreaterThan(keywordIndex);
        expect(progressIndex).toBeGreaterThan(providerIndex);
      });
    });
  });

  describe('Data Consistency Tests', () => {
    /**
     * Feature: article-generation-table-enhancement
     * Tests Requirements 6.2, 6.3
     */
    it('should display data from API response correctly', async () => {
      render(<ArticleGenerationPage />);

      await waitFor(() => {
        // Check conversion target
        expect(screen.getByText('Test Company Ltd')).toBeInTheDocument();
        
        // Check keywords
        expect(screen.getByText('AI技术')).toBeInTheDocument();
        expect(screen.getByText('机器学习')).toBeInTheDocument();
        
        // Check providers
        expect(screen.getByText('DeepSeek')).toBeInTheDocument();
        expect(screen.getByText('Gemini')).toBeInTheDocument();
      });
    });
  });
});
