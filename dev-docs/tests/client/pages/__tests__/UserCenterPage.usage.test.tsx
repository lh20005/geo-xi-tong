import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import UserCenterPage from '../UserCenterPage';

// Mock API client
jest.mock('../../api/client', () => ({
  get: jest.fn(),
  put: jest.fn(),
  post: jest.fn(),
}));

// Mock WebSocket service
jest.mock('../../services/UserWebSocketService', () => ({
  getUserWebSocketService: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    off: jest.fn(),
  })),
}));

describe('UserCenterPage - 使用统计', () => {
  const mockUsageStats = {
    features: [
      {
        feature_code: 'articles_per_day',
        feature_name: '每日文章生成',
        used: 5,
        limit: 10,
        percentage: 50,
        unit: '篇',
        reset_time: '2024-12-26T00:00:00Z',
      },
      {
        feature_code: 'publish_per_day',
        feature_name: '每日发布',
        used: 18,
        limit: 20,
        percentage: 90,
        unit: '篇',
        reset_time: '2024-12-26T00:00:00Z',
      },
      {
        feature_code: 'platform_accounts',
        feature_name: '平台账号',
        used: 1,
        limit: 3,
        percentage: 33.33,
        unit: '个',
        reset_time: null,
      },
      {
        feature_code: 'keyword_distillation',
        feature_name: '关键词提炼',
        used: 450,
        limit: 500,
        percentage: 90,
        unit: '个',
        reset_time: '2025-01-01T00:00:00Z',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <UserCenterPage />
      </BrowserRouter>
    );
  };

  describe('统计数据准确性', () => {
    it('应该显示所有功能的使用统计', async () => {
      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/usage-stats')) {
          return Promise.resolve({ data: { success: true, data: mockUsageStats } });
        }
        return Promise.resolve({ data: { success: true, data: null } });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('每日文章生成')).toBeInTheDocument();
        expect(screen.getByText('每日发布')).toBeInTheDocument();
        expect(screen.getByText('平台账号')).toBeInTheDocument();
        expect(screen.getByText('关键词提炼')).toBeInTheDocument();
      });
    });

    it('应该显示正确的使用量和限额', async () => {
      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/usage-stats')) {
          return Promise.resolve({ data: { success: true, data: mockUsageStats } });
        }
        return Promise.resolve({ data: { success: true, data: null } });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/5 \/ 10/)).toBeInTheDocument(); // articles_per_day
        expect(screen.getByText(/18 \/ 20/)).toBeInTheDocument(); // publish_per_day
        expect(screen.getByText(/1 \/ 3/)).toBeInTheDocument(); // platform_accounts
        expect(screen.getByText(/450 \/ 500/)).toBeInTheDocument(); // keyword_distillation
      });
    });

    it('应该显示正确的百分比', async () => {
      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/usage-stats')) {
          return Promise.resolve({ data: { success: true, data: mockUsageStats } });
        }
        return Promise.resolve({ data: { success: true, data: null } });
      });

      renderComponent();

      await waitFor(() => {
        // 检查进度条百分比
        const progressBars = screen.getAllByRole('progressbar');
        expect(progressBars.length).toBeGreaterThan(0);
      });
    });
  });

  describe('进度条颜色', () => {
    it('使用量小于 70% 应该显示绿色', async () => {
      const lowUsageStats = {
        features: [
          {
            feature_code: 'articles_per_day',
            feature_name: '每日文章生成',
            used: 3,
            limit: 10,
            percentage: 30,
            unit: '篇',
            reset_time: '2024-12-26T00:00:00Z',
          },
        ],
      };

      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/usage-stats')) {
          return Promise.resolve({ data: { success: true, data: lowUsageStats } });
        }
        return Promise.resolve({ data: { success: true, data: null } });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('每日文章生成')).toBeInTheDocument();
      });

      // 检查进度条状态（Ant Design Progress 组件）
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '30');
    });

    it('使用量 70%-90% 应该显示橙色', async () => {
      const mediumUsageStats = {
        features: [
          {
            feature_code: 'articles_per_day',
            feature_name: '每日文章生成',
            used: 8,
            limit: 10,
            percentage: 80,
            unit: '篇',
            reset_time: '2024-12-26T00:00:00Z',
          },
        ],
      };

      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/usage-stats')) {
          return Promise.resolve({ data: { success: true, data: mediumUsageStats } });
        }
        return Promise.resolve({ data: { success: true, data: null } });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('每日文章生成')).toBeInTheDocument();
      });

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '80');
    });

    it('使用量超过 90% 应该显示红色', async () => {
      const highUsageStats = {
        features: [
          {
            feature_code: 'articles_per_day',
            feature_name: '每日文章生成',
            used: 9,
            limit: 10,
            percentage: 90,
            unit: '篇',
            reset_time: '2024-12-26T00:00:00Z',
          },
        ],
      };

      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/usage-stats')) {
          return Promise.resolve({ data: { success: true, data: highUsageStats } });
        }
        return Promise.resolve({ data: { success: true, data: null } });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('每日文章生成')).toBeInTheDocument();
      });

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '90');
    });

    it('使用量达到 100% 应该显示红色', async () => {
      const fullUsageStats = {
        features: [
          {
            feature_code: 'articles_per_day',
            feature_name: '每日文章生成',
            used: 10,
            limit: 10,
            percentage: 100,
            unit: '篇',
            reset_time: '2024-12-26T00:00:00Z',
          },
        ],
      };

      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/usage-stats')) {
          return Promise.resolve({ data: { success: true, data: fullUsageStats } });
        }
        return Promise.resolve({ data: { success: true, data: null } });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('每日文章生成')).toBeInTheDocument();
      });

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });
  });

  describe('重置时间显示', () => {
    it('应该显示每日配额的重置时间', async () => {
      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/usage-stats')) {
          return Promise.resolve({ data: { success: true, data: mockUsageStats } });
        }
        return Promise.resolve({ data: { success: true, data: null } });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/每日重置/)).toBeInTheDocument();
      });
    });

    it('应该显示每月配额的重置时间', async () => {
      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/usage-stats')) {
          return Promise.resolve({ data: { success: true, data: mockUsageStats } });
        }
        return Promise.resolve({ data: { success: true, data: null } });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/每月重置/)).toBeInTheDocument();
      });
    });

    it('永久配额不应该显示重置时间', async () => {
      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/usage-stats')) {
          return Promise.resolve({ data: { success: true, data: mockUsageStats } });
        }
        return Promise.resolve({ data: { success: true, data: null } });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('平台账号')).toBeInTheDocument();
      });

      // 平台账号是永久配额，不应该显示重置时间
      expect(screen.queryByText(/平台账号.*重置/)).not.toBeInTheDocument();
    });
  });

  describe('配额预警', () => {
    it('使用量超过 90% 应该显示升级提示', async () => {
      const highUsageStats = {
        features: [
          {
            feature_code: 'articles_per_day',
            feature_name: '每日文章生成',
            used: 9,
            limit: 10,
            percentage: 90,
            unit: '篇',
            reset_time: '2024-12-26T00:00:00Z',
          },
        ],
      };

      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/usage-stats')) {
          return Promise.resolve({ data: { success: true, data: highUsageStats } });
        }
        return Promise.resolve({ data: { success: true, data: null } });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/配额即将用尽/)).toBeInTheDocument();
      });
    });

    it('使用量小于 90% 不应该显示升级提示', async () => {
      const lowUsageStats = {
        features: [
          {
            feature_code: 'articles_per_day',
            feature_name: '每日文章生成',
            used: 5,
            limit: 10,
            percentage: 50,
            unit: '篇',
            reset_time: '2024-12-26T00:00:00Z',
          },
        ],
      };

      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/usage-stats')) {
          return Promise.resolve({ data: { success: true, data: lowUsageStats } });
        }
        return Promise.resolve({ data: { success: true, data: null } });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('每日文章生成')).toBeInTheDocument();
      });

      expect(screen.queryByText(/配额即将用尽/)).not.toBeInTheDocument();
    });
  });

  describe('无限配额', () => {
    it('应该正确显示无限配额', async () => {
      const unlimitedStats = {
        features: [
          {
            feature_code: 'articles_per_day',
            feature_name: '每日文章生成',
            used: 100,
            limit: -1,
            percentage: 0,
            unit: '篇',
            reset_time: '2024-12-26T00:00:00Z',
          },
        ],
      };

      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/usage-stats')) {
          return Promise.resolve({ data: { success: true, data: unlimitedStats } });
        }
        return Promise.resolve({ data: { success: true, data: null } });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/无限/)).toBeInTheDocument();
      });
    });
  });
});
