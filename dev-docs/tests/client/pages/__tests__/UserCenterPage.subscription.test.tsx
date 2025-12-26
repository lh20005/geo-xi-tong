import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import UserCenterPage from '../UserCenterPage';

// Mock API client
jest.mock('../../api/client', () => ({
  get: jest.fn(),
  put: jest.fn(),
  post: jest.fn(),
}));

describe('UserCenterPage - 订阅信息', () => {
  const mockSubscription = {
    id: 1,
    user_id: 1,
    plan_id: 2,
    plan_name: '专业版',
    plan_code: 'pro',
    price: 99,
    start_date: '2024-12-01',
    end_date: '2024-12-31',
    auto_renew: true,
    status: 'active',
  };

  const mockExpiringSubscription = {
    ...mockSubscription,
    end_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5天后到期
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

  describe('订阅信息展示', () => {
    it('应该显示当前套餐名称', async () => {
      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/subscription/current')) {
          return Promise.resolve({ data: mockSubscription });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('专业版')).toBeInTheDocument();
      });
    });

    it('应该显示到期时间', async () => {
      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/subscription/current')) {
          return Promise.resolve({ data: mockSubscription });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/到期时间/)).toBeInTheDocument();
        expect(screen.getByText(/2024-12-31/)).toBeInTheDocument();
      });
    });

    it('应该显示自动续费状态', async () => {
      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/subscription/current')) {
          return Promise.resolve({ data: mockSubscription });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/自动续费/)).toBeInTheDocument();
      });
    });

    it('应该显示订阅状态', async () => {
      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/subscription/current')) {
          return Promise.resolve({ data: mockSubscription });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/激活/)).toBeInTheDocument();
      });
    });

    it('应该显示升级套餐按钮', async () => {
      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/subscription/current')) {
          return Promise.resolve({ data: mockSubscription });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('升级套餐')).toBeInTheDocument();
      });
    });
  });

  describe('到期提醒', () => {
    it('7天内到期应该显示警告', async () => {
      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/subscription/current')) {
          return Promise.resolve({ data: mockExpiringSubscription });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/即将到期/)).toBeInTheDocument();
      });
    });

    it('7天以上不应该显示警告', async () => {
      const { get } = require('../../api/client');
      const futureSubscription = {
        ...mockSubscription,
        end_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10天后
      };

      get.mockImplementation((url: string) => {
        if (url.includes('/subscription/current')) {
          return Promise.resolve({ data: futureSubscription });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText(/即将到期/)).not.toBeInTheDocument();
      });
    });
  });

  describe('自动续费切换', () => {
    it('应该能够开启自动续费', async () => {
      const { get, put } = require('../../api/client');
      const subscriptionWithoutAutoRenew = {
        ...mockSubscription,
        auto_renew: false,
      };

      get.mockImplementation((url: string) => {
        if (url.includes('/subscription/current')) {
          return Promise.resolve({ data: subscriptionWithoutAutoRenew });
        }
        return Promise.resolve({ data: [] });
      });

      put.mockResolvedValue({ data: { success: true } });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('专业版')).toBeInTheDocument();
      });

      const autoRenewSwitch = screen.getByRole('switch');
      fireEvent.click(autoRenewSwitch);

      await waitFor(() => {
        expect(put).toHaveBeenCalledWith(
          expect.stringContaining('/subscription/auto-renew'),
          expect.objectContaining({ auto_renew: true })
        );
      });
    });

    it('应该能够关闭自动续费', async () => {
      const { get, put } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/subscription/current')) {
          return Promise.resolve({ data: mockSubscription });
        }
        return Promise.resolve({ data: [] });
      });

      put.mockResolvedValue({ data: { success: true } });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('专业版')).toBeInTheDocument();
      });

      const autoRenewSwitch = screen.getByRole('switch');
      fireEvent.click(autoRenewSwitch);

      await waitFor(() => {
        expect(put).toHaveBeenCalledWith(
          expect.stringContaining('/subscription/auto-renew'),
          expect.objectContaining({ auto_renew: false })
        );
      });
    });

    it('切换失败应该显示错误提示', async () => {
      const { get, put } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/subscription/current')) {
          return Promise.resolve({ data: mockSubscription });
        }
        return Promise.resolve({ data: [] });
      });

      put.mockRejectedValue(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('专业版')).toBeInTheDocument();
      });

      const autoRenewSwitch = screen.getByRole('switch');
      fireEvent.click(autoRenewSwitch);

      await waitFor(() => {
        expect(screen.getByText(/操作失败/)).toBeInTheDocument();
      });
    });
  });

  describe('升级套餐', () => {
    it('点击升级按钮应该打开升级对话框', async () => {
      const { get } = require('../../api/client');
      const mockPlans = [
        { id: 2, plan_name: '专业版', price: 99 },
        { id: 3, plan_name: '企业版', price: 299 },
      ];

      get.mockImplementation((url: string) => {
        if (url.includes('/subscription/current')) {
          return Promise.resolve({ data: mockSubscription });
        }
        if (url.includes('/subscription/plans')) {
          return Promise.resolve({ data: mockPlans });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('专业版')).toBeInTheDocument();
      });

      const upgradeButton = screen.getByText('升级套餐');
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        expect(screen.getByText('选择套餐')).toBeInTheDocument();
      });
    });

    it('升级对话框应该显示可升级套餐', async () => {
      const { get } = require('../../api/client');
      const mockPlans = [
        { id: 1, plan_name: '体验版', price: 0 },
        { id: 2, plan_name: '专业版', price: 99 },
        { id: 3, plan_name: '企业版', price: 299 },
      ];

      get.mockImplementation((url: string) => {
        if (url.includes('/subscription/current')) {
          return Promise.resolve({ data: mockSubscription });
        }
        if (url.includes('/subscription/plans')) {
          return Promise.resolve({ data: mockPlans });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('专业版')).toBeInTheDocument();
      });

      const upgradeButton = screen.getByText('升级套餐');
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        // 应该显示企业版（可升级）
        expect(screen.getByText('企业版')).toBeInTheDocument();
        // 应该显示体验版但标记为不支持降级
        expect(screen.getByText('不支持降级')).toBeInTheDocument();
      });
    });

    it('应该能够选择套餐并升级', async () => {
      const { get, post } = require('../../api/client');
      const mockPlans = [
        { id: 2, plan_name: '专业版', price: 99 },
        { id: 3, plan_name: '企业版', price: 299 },
      ];

      get.mockImplementation((url: string) => {
        if (url.includes('/subscription/current')) {
          return Promise.resolve({ data: mockSubscription });
        }
        if (url.includes('/subscription/plans')) {
          return Promise.resolve({ data: mockPlans });
        }
        return Promise.resolve({ data: [] });
      });

      post.mockResolvedValue({ data: { order_no: 'ORDER123', amount: 200 } });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('专业版')).toBeInTheDocument();
      });

      const upgradeButton = screen.getByText('升级套餐');
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        expect(screen.getByText('企业版')).toBeInTheDocument();
      });

      const upgradeToEnterpriseButton = screen.getByText('立即升级');
      fireEvent.click(upgradeToEnterpriseButton);

      await waitFor(() => {
        expect(post).toHaveBeenCalledWith(
          expect.stringContaining('/subscription/upgrade'),
          expect.objectContaining({ target_plan_id: 3 })
        );
      });
    });
  });

  describe('无订阅状态', () => {
    it('无订阅时应该显示提示信息', async () => {
      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/subscription/current')) {
          return Promise.resolve({ data: null });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/暂无订阅/)).toBeInTheDocument();
      });
    });

    it('无订阅时应该显示购买按钮', async () => {
      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/subscription/current')) {
          return Promise.resolve({ data: null });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('购买套餐')).toBeInTheDocument();
      });
    });
  });
});
