import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ArticleListPage from './ArticleListPage';
import { apiClient } from '../api/client';

// Mock API client
vi.mock('../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('ArticleListPage - Image Embedding', () => {
  // Feature: article-image-embedding, Property 6: 编辑保存一致性
  // 验证需求: 4.1, 4.4
  describe('Property 6: 编辑保存一致性', () => {
    it('编辑后保存的内容应该与输入一致', async () => {
      const mockArticle = {
        id: 1,
        title: '测试文章',
        content: '原始内容\n\n![图片](https://example.com/image.jpg)',
        keyword: '测试',
        created_at: new Date().toISOString(),
      };

      (apiClient.get as any).mockResolvedValueOnce({
        data: { articles: [mockArticle] },
      });

      (apiClient.get as any).mockResolvedValueOnce({
        data: mockArticle,
      });

      const updatedContent = '更新后的内容\n\n![新图片](https://example.com/new.jpg)';
      (apiClient.put as any).mockResolvedValueOnce({
        data: { ...mockArticle, content: updatedContent },
      });

      const { container } = render(<ArticleListPage />);

      await waitFor(() => {
        expect(screen.getByText('测试')).toBeInTheDocument();
      });

      // 点击查看按钮
      const viewButton = screen.getByText('查看');
      await userEvent.click(viewButton);

      // 点击编辑按钮
      await waitFor(() => {
        const editButton = screen.getByText('编辑');
        userEvent.click(editButton);
      });

      // 修改内容
      const contentTextarea = screen.getByPlaceholderText(/请输入文章内容/);
      await userEvent.clear(contentTextarea);
      await userEvent.type(contentTextarea, updatedContent);

      // 保存
      const saveButton = screen.getByText('保存');
      await userEvent.click(saveButton);

      // 验证API调用
      await waitFor(() => {
        expect(apiClient.put).toHaveBeenCalledWith(
          `/articles/${mockArticle.id}`,
          expect.objectContaining({
            content: updatedContent,
          })
        );
      });
    });
  });

  // Feature: article-image-embedding, Property 7: 图片标记语法验证
  // 验证需求: 4.2
  describe('Property 7: 图片标记语法验证', () => {
    it('应该允许保存包含Markdown图片标记的内容', async () => {
      const mockArticle = {
        id: 1,
        title: '测试文章',
        content: '内容',
        keyword: '测试',
        created_at: new Date().toISOString(),
      };

      (apiClient.get as any).mockResolvedValue({
        data: { articles: [mockArticle] },
      });

      (apiClient.get as any).mockResolvedValueOnce({
        data: mockArticle,
      });

      const contentWithImage = '文字\n\n![图片](https://example.com/image.jpg)\n\n更多文字';
      (apiClient.put as any).mockResolvedValueOnce({
        data: { ...mockArticle, content: contentWithImage },
      });

      render(<ArticleListPage />);

      await waitFor(() => {
        expect(screen.getByText('测试')).toBeInTheDocument();
      });

      // 验证Markdown语法被接受
      expect(contentWithImage).toMatch(/!\[.*?\]\(.*?\)/);
    });
  });
});


describe('ArticleListPage - Column Enhancement', () => {
  /**
   * Feature: article-list-enhancement
   * Tests for column display requirements
   * Validates: Requirements 2.1, 2.3, 3.1, 3.3, 4.1, 4.2
   */
  
  describe('Column Display', () => {
    it('should display Conversion Target column before Keywords column', async () => {
      const mockArticles = [
        {
          id: 1,
          keyword: '英国留学',
          conversionTargetName: '杭州鸥飞留学机构',
          distillationKeyword: '英国留学',
          createdAt: new Date().toISOString(),
        },
      ];

      (apiClient.get as any).mockResolvedValueOnce({
        data: { articles: mockArticles },
      });

      render(<ArticleListPage />);

      await waitFor(() => {
        expect(screen.getByText('转化目标')).toBeInTheDocument();
        expect(screen.getByText('关键词')).toBeInTheDocument();
      });

      // Verify column headers exist
      const headers = screen.getAllByRole('columnheader');
      const conversionTargetIndex = headers.findIndex(h => h.textContent === '转化目标');
      const keywordIndex = headers.findIndex(h => h.textContent === '关键词');
      
      // Conversion Target should come before Keywords
      expect(conversionTargetIndex).toBeLessThan(keywordIndex);
    });

    it('should display Distillation Result column after Keywords column', async () => {
      const mockArticles = [
        {
          id: 1,
          keyword: '英国留学',
          conversionTargetName: '杭州鸥飞留学机构',
          distillationKeyword: '英国留学',
          createdAt: new Date().toISOString(),
        },
      ];

      (apiClient.get as any).mockResolvedValueOnce({
        data: { articles: mockArticles },
      });

      render(<ArticleListPage />);

      await waitFor(() => {
        expect(screen.getByText('蒸馏结果')).toBeInTheDocument();
        expect(screen.getByText('关键词')).toBeInTheDocument();
      });

      // Verify column headers exist
      const headers = screen.getAllByRole('columnheader');
      const keywordIndex = headers.findIndex(h => h.textContent === '关键词');
      const distillationIndex = headers.findIndex(h => h.textContent === '蒸馏结果');
      
      // Distillation Result should come after Keywords
      expect(distillationIndex).toBeGreaterThan(keywordIndex);
    });

    it('should NOT display Preview column', async () => {
      const mockArticles = [
        {
          id: 1,
          keyword: '英国留学',
          conversionTargetName: '杭州鸥飞留学机构',
          distillationKeyword: '英国留学',
          createdAt: new Date().toISOString(),
        },
      ];

      (apiClient.get as any).mockResolvedValueOnce({
        data: { articles: mockArticles },
      });

      render(<ArticleListPage />);

      await waitFor(() => {
        expect(screen.getByText('关键词')).toBeInTheDocument();
      });

      // Verify Preview column does not exist
      expect(screen.queryByText('预览')).not.toBeInTheDocument();
    });

    it('should NOT display AI Model column', async () => {
      const mockArticles = [
        {
          id: 1,
          keyword: '英国留学',
          conversionTargetName: '杭州鸥飞留学机构',
          distillationKeyword: '英国留学',
          createdAt: new Date().toISOString(),
        },
      ];

      (apiClient.get as any).mockResolvedValueOnce({
        data: { articles: mockArticles },
      });

      render(<ArticleListPage />);

      await waitFor(() => {
        expect(screen.getByText('关键词')).toBeInTheDocument();
      });

      // Verify AI Model column does not exist
      expect(screen.queryByText('AI模型')).not.toBeInTheDocument();
    });
  });

  describe('NULL Value Handling', () => {
    it('should display placeholder for NULL conversion target', async () => {
      const mockArticles = [
        {
          id: 1,
          keyword: '英国留学',
          conversionTargetName: null,
          distillationKeyword: '英国留学',
          createdAt: new Date().toISOString(),
        },
      ];

      (apiClient.get as any).mockResolvedValueOnce({
        data: { articles: mockArticles },
      });

      const { container } = render(<ArticleListPage />);

      await waitFor(() => {
        expect(screen.getByText('英国留学')).toBeInTheDocument();
      });

      // Check for placeholder (dash or empty)
      const cells = container.querySelectorAll('td');
      const hasPlaceholder = Array.from(cells).some(cell => 
        cell.textContent === '-' || cell.textContent?.trim() === ''
      );
      expect(hasPlaceholder).toBe(true);
    });

    it('should display placeholder for NULL distillation keyword', async () => {
      const mockArticles = [
        {
          id: 1,
          keyword: '英国留学',
          conversionTargetName: '杭州鸥飞留学机构',
          distillationKeyword: null,
          createdAt: new Date().toISOString(),
        },
      ];

      (apiClient.get as any).mockResolvedValueOnce({
        data: { articles: mockArticles },
      });

      const { container } = render(<ArticleListPage />);

      await waitFor(() => {
        expect(screen.getByText('英国留学')).toBeInTheDocument();
      });

      // Check for placeholder (dash or empty)
      const cells = container.querySelectorAll('td');
      const hasPlaceholder = Array.from(cells).some(cell => 
        cell.textContent === '-' || cell.textContent?.trim() === ''
      );
      expect(hasPlaceholder).toBe(true);
    });
  });

  describe('Creation Time Formatting', () => {
    it('should format creation time correctly', async () => {
      const testDate = '2025-12-15T06:17:32.836Z';
      const mockArticles = [
        {
          id: 1,
          keyword: '英国留学',
          conversionTargetName: '杭州鸥飞留学机构',
          distillationKeyword: '英国留学',
          createdAt: testDate,
        },
      ];

      (apiClient.get as any).mockResolvedValueOnce({
        data: { articles: mockArticles },
      });

      const { container } = render(<ArticleListPage />);

      await waitFor(() => {
        expect(screen.getByText('英国留学')).toBeInTheDocument();
      });

      // Verify date is formatted (should contain date/time elements)
      const formattedDate = new Date(testDate).toLocaleString('zh-CN');
      const cells = container.querySelectorAll('td');
      const hasFormattedDate = Array.from(cells).some(cell => 
        cell.textContent?.includes(formattedDate.split(' ')[0]) // Check for date part
      );
      expect(hasFormattedDate).toBe(true);
    });
  });
});
