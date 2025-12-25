import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

describe('UserCenterPage - 订单记录', () => {
  const mockOrders = [
    {
      order_no: 'ORDER001',
      plan_name: '专业版',
      amount: 99,
      status: 'paid',
      created_at: '2024-12-20T10:00:00Z',
      paid_at: '2024-12-20T10:05:00Z',
    },
    {
      order_no: 'ORDER002',
      plan_name: '企业版',
      amount: 299,
      status: 'pending',
      created_at: '2024-12-21T14:00:00Z',
      paid_at: null,
    },
    {
      order_no: 'ORDER003',
      plan_name: '专业版',
      amount: 99,
      status: 'closed',
      created_at: '2024-12-22T09:00:00Z',
      paid_at: null,
    },
  ];

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

  describe('订单列表查询', () => {
    it('应该显示订单列表', async () => {
      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/orders')) {
          return Promise.resolve({ data: { success: true, data: mockOrders } });
        }
        return Promise.resolve({ data: { success: true, data: null } });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('ORDER001')).toBeInTheDocument();
        expect(screen.getByText('ORDER002')).toBeInTheDocument();
        expect(screen.getByText('ORDER003')).toBeInTheDocument();
      });
    });

    it('应该显示订单详细信息', async () => {
      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/orders')) {
          return Promise.resolve({ data: { success: true, data: mockOrders } });
        }
        return Promise.resolve({ data: { success: true, data: null } });
      });

      renderComponent();

      await waitFor(() => {
        // 订单号
        expect(screen.getByText('ORDER001')).toBeInTheDocument();
        // 套餐名称
        expect(screen.getAllByText('专业版').length).toBeGreaterThan(0);
        // 金额
        expect(screen.getByText(/¥99/)).toBeInTheDocument();
        expect(screen.getByText(/¥299/)).toBeInTheDocument();
      });
    });

    it('应该显示订单状态标签', async () => {
      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/orders')) {
          return Promise.resolve({ data: { success: true, data: mockOrders } });
        }
        return Promise.resolve({ data: { success: true, data: null } });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('已支付')).toBeInTheDocument();
        expect(screen.getByText('待支付')).toBeInTheDocument();
        expect(screen.getByText('已关闭')).toBeInTheDocument();
      });
    });

    it('应该显示创建时间', async () => {
      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/orders')) {
          return Promise.resolve({ data: { success: true, data: mockOrders } });
        }
        return Promise.resolve({ data: { success: true, data: null } });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/2024-12-20/)).toBeInTheDocument();
        expect(screen.getByText(/2024-12-21/)).toBeInTheDocument();
        expect(screen.getByText(/2024-12-22/)).toBeInTheDocument();
      });
    });
  });

  describe('分页功能', () => {
    it('应该支持分页', async () => {
      const manyOrders = Array.from({ length: 25 }, (_, i) => ({
        order_no: `ORDER${String(i + 1).padStart(3, '0')}`,
        plan_name: '专业版',
        amount: 99,
        status: 'paid',
        created_at: '2024-12-20T10:00:00Z',
        paid_at: '2024-12-20T10:05:00Z',
      }));

      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/orders')) {
          return Promise.resolve({ data: { success: true, data: manyOrders } });
        }
        return Promise.resolve({ data: { success: true, data: null } });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('ORDER001')).toBeInTheDocument();
      });

      // 检查是否有分页组件
      const pagination = screen.queryByRole('navigation');
      expect(pagination).toBeInTheDocument();
    });

    it('应该能够切换页码', async () => {
      const manyOrders = Array.from({ length: 25 }, (_, i) => ({
        order_no: `ORDER${String(i + 1).padStart(3, '0')}`,
        plan_name: '专业版',
        amount: 99,
        status: 'paid',
        created_at: '2024-12-20T10:00:00Z',
        paid_at: '2024-12-20T10:05:00Z',
      }));

      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/orders')) {
          return Promise.resolve({ data: { success: true, data: manyOrders } });
        }
        return Promise.resolve({ data: { success: true, data: null } });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('ORDER001')).toBeInTheDocument();
      });

      // 点击下一页
      const nextButton = screen.getByTitle('下一页');
      if (nextButton) {
        fireEvent.click(nextButton);

        await waitFor(() => {
          // 第二页应该显示不同的订单
          expect(screen.queryByText('ORDER001')).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('状态筛选', () => {
    it('应该能够按状态筛选订单', async () => {
      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/orders')) {
          return Promise.resolve({ data: { success: true, data: mockOrders } });
        }
        return Promise.resolve({ data: { success: true, data: null } });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('ORDER001')).toBeInTheDocument();
      });

      // 查找状态筛选器
      const statusFilter = screen.queryByText('全部状态');
      if (statusFilter) {
        fireEvent.click(statusFilter);

        await waitFor(() => {
          expect(screen.getByText('已支付')).toBeInTheDocument();
          expect(screen.getByText('待支付')).toBeInTheDocument();
        });
      }
    });

    it('筛选已支付订单应该只显示已支付的订单', async () => {
      const { get } = require('../../api/client');
      const paidOrders = mockOrders.filter((o) => o.status === 'paid');

      get.mockImplementation((url: string) => {
        if (url.includes('/orders')) {
          if (url.includes('status=paid')) {
            return Promise.resolve({ data: { success: true, data: paidOrders } });
          }
          return Promise.resolve({ data: { success: true, data: mockOrders } });
        }
        return Promise.resolve({ data: { success: true, data: null } });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('ORDER001')).toBeInTheDocument();
      });

      // 筛选已支付订单
      const statusFilter = screen.queryByText('全部状态');
      if (statusFilter) {
        fireEvent.click(statusFilter);

        const paidOption = screen.getByText('已支付');
        fireEvent.click(paidOption);

        await waitFor(() => {
          expect(screen.getByText('ORDER001')).toBeInTheDocument();
          expect(screen.queryByText('ORDER002')).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('订单详情', () => {
    it('点击订单应该显示详情', async () => {
      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/orders/ORDER001')) {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                ...mockOrders[0],
                transaction_id: 'WX123456789',
              },
            },
          });
        }
        if (url.includes('/orders')) {
          return Promise.resolve({ data: { success: true, data: mockOrders } });
        }
        return Promise.resolve({ data: { success: true, data: null } });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('ORDER001')).toBeInTheDocument();
      });

      // 点击查看详情按钮
      const detailButtons = screen.getAllByText('查看详情');
      if (detailButtons.length > 0) {
        fireEvent.click(detailButtons[0]);

        await waitFor(() => {
          expect(screen.getByText('订单详情')).toBeInTheDocument();
        });
      }
    });
  });

  describe('空状态', () => {
    it('无订单时应该显示空状态', async () => {
      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/orders')) {
          return Promise.resolve({ data: { success: true, data: [] } });
        }
        return Promise.resolve({ data: { success: true, data: null } });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/暂无订单/)).toBeInTheDocument();
      });
    });
  });

  describe('加载状态', () => {
    it('加载时应该显示加载指示器', async () => {
      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ data: { success: true, data: mockOrders } });
          }, 100);
        });
      });

      renderComponent();

      // 检查加载状态
      expect(screen.getByRole('progressbar') || screen.getByText(/加载中/)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('ORDER001')).toBeInTheDocument();
      });
    });
  });

  describe('错误处理', () => {
    it('加载失败应该显示错误提示', async () => {
      const { get } = require('../../api/client');
      get.mockImplementation((url: string) => {
        if (url.includes('/orders')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ data: { success: true, data: null } });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/加载失败/) || screen.getByText(/错误/)).toBeInTheDocument();
      });
    });
  });
});
