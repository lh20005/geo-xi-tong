import { render, waitFor, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import UsageHistoryModal from '../UsageHistoryModal';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Wrapper component for Router
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('UsageHistoryModal Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Data loading and display', () => {
    it('should load and display usage history data', async () => {
      const mockData = {
        distillationId: 1,
        keyword: 'test-keyword',
        totalUsageCount: 3,
        usageHistory: [
          {
            id: 1,
            taskId: 1,
            articleId: 1,
            articleTitle: 'Test Article 1',
            usedAt: '2024-01-01T10:00:00Z'
          },
          {
            id: 2,
            taskId: 1,
            articleId: 2,
            articleTitle: 'Test Article 2',
            usedAt: '2024-01-02T10:00:00Z'
          }
        ],
        total: 2,
        page: 1,
        pageSize: 10
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockData });

      render(
        <Wrapper>
          <UsageHistoryModal
            visible={true}
            distillationId={1}
            onClose={() => {}}
          />
        </Wrapper>
      );

      // 等待数据加载
      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith(
          '/api/distillation/1/usage',
          expect.objectContaining({
            params: { page: 1, pageSize: 10 }
          })
        );
      });

      // 验证关键词和总使用次数显示
      await waitFor(() => {
        expect(screen.getByText(/test-keyword/i)).toBeInTheDocument();
        expect(screen.getByText(/3次/i)).toBeInTheDocument();
      });
    });

    it('should handle loading state', () => {
      mockedAxios.get.mockImplementation(() => new Promise(() => {}));

      render(
        <Wrapper>
          <UsageHistoryModal
            visible={true}
            distillationId={1}
            onClose={() => {}}
          />
        </Wrapper>
      );

      // 验证加载状态
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should handle error state', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      render(
        <Wrapper>
          <UsageHistoryModal
            visible={true}
            distillationId={1}
            onClose={() => {}}
          />
        </Wrapper>
      );

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalled();
      });

      // 错误会通过message.error显示，这里验证API被调用
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty state', () => {
    it('should display empty state when no usage history', async () => {
      const mockData = {
        distillationId: 1,
        keyword: 'test-keyword',
        totalUsageCount: 0,
        usageHistory: [],
        total: 0,
        page: 1,
        pageSize: 10
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockData });

      render(
        <Wrapper>
          <UsageHistoryModal
            visible={true}
            distillationId={1}
            onClose={() => {}}
          />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/该蒸馏结果尚未被使用/i)).toBeInTheDocument();
      });
    });
  });

  describe('Pagination', () => {
    it('should handle pagination correctly', async () => {
      const mockData = {
        distillationId: 1,
        keyword: 'test-keyword',
        totalUsageCount: 25,
        usageHistory: Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          taskId: 1,
          articleId: i + 1,
          articleTitle: `Test Article ${i + 1}`,
          usedAt: '2024-01-01T10:00:00Z'
        })),
        total: 25,
        page: 1,
        pageSize: 10
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockData });

      const { container } = render(
        <Wrapper>
          <UsageHistoryModal
            visible={true}
            distillationId={1}
            onClose={() => {}}
          />
        </Wrapper>
      );

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalled();
      });

      // 验证分页组件存在
      await waitFor(() => {
        const pagination = container.querySelector('.ant-pagination');
        expect(pagination).toBeInTheDocument();
      });
    });
  });

  describe('Deleted articles handling', () => {
    it('should display "文章已删除" for deleted articles', async () => {
      const mockData = {
        distillationId: 1,
        keyword: 'test-keyword',
        totalUsageCount: 2,
        usageHistory: [
          {
            id: 1,
            taskId: 1,
            articleId: 1,
            articleTitle: null,
            usedAt: '2024-01-01T10:00:00Z'
          }
        ],
        total: 1,
        page: 1,
        pageSize: 10
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockData });

      render(
        <Wrapper>
          <UsageHistoryModal
            visible={true}
            distillationId={1}
            onClose={() => {}}
          />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/文章已删除/i)).toBeInTheDocument();
      });
    });
  });

  describe('Modal visibility', () => {
    it('should not render when visible is false', () => {
      const { container } = render(
        <Wrapper>
          <UsageHistoryModal
            visible={false}
            distillationId={1}
            onClose={() => {}}
          />
        </Wrapper>
      );

      expect(container.querySelector('.ant-modal')).not.toBeInTheDocument();
    });

    it('should render when visible is true', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          distillationId: 1,
          keyword: 'test',
          totalUsageCount: 0,
          usageHistory: [],
          total: 0,
          page: 1,
          pageSize: 10
        }
      });

      render(
        <Wrapper>
          <UsageHistoryModal
            visible={true}
            distillationId={1}
            onClose={() => {}}
          />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });
  });
});
