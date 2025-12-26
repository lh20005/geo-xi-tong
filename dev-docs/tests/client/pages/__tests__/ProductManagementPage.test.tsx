import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ProductManagementPage from '../ProductManagementPage';
import * as authUtils from '../../utils/auth';

// Mock API client
jest.mock('../../api/client', () => ({
  get: jest.fn(),
  put: jest.fn(),
  post: jest.fn(),
}));

// Mock auth utils
jest.mock('../../utils/auth');

const mockAuthUtils = authUtils as jest.Mocked<typeof authUtils>;

describe('ProductManagementPage', () => {
  const mockPlans = [
    {
      id: 1,
      plan_code: 'free',
      plan_name: '体验版',
      price: 0,
      duration_days: 30,
      is_active: true,
      features: [
        { feature_code: 'articles_per_day', quota_limit: 10 },
        { feature_code: 'publish_per_day', quota_limit: 20 },
      ],
    },
    {
      id: 2,
      plan_code: 'pro',
      plan_name: '专业版',
      price: 99,
      duration_days: 30,
      is_active: true,
      features: [
        { feature_code: 'articles_per_day', quota_limit: 100 },
        { feature_code: 'publish_per_day', quota_limit: 200 },
      ],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUtils.getUserRole.mockReturnValue('admin');
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <ProductManagementPage />
      </BrowserRouter>
    );
  };

  describe('权限控制', () => {
    it('应该只对 admin 角色显示页面', () => {
      mockAuthUtils.getUserRole.mockReturnValue('admin');
      renderComponent();
      expect(screen.queryByText('商品管理')).toBeInTheDocument();
    });

    it('非 admin 用户应该看到权限提示', () => {
      mockAuthUtils.getUserRole.mockReturnValue('user');
      renderComponent();
      expect(screen.queryByText('无权限访问')).toBeInTheDocument();
    });
  });

  describe('编辑对话框', () => {
    it('点击编辑按钮应该打开编辑对话框', async () => {
      const { get } = require('../../api/client');
      get.mockResolvedValue({ data: mockPlans });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('体验版')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByText('编辑');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('编辑套餐')).toBeInTheDocument();
      });
    });

    it('编辑对话框应该显示当前套餐信息', async () => {
      const { get } = require('../../api/client');
      get.mockResolvedValue({ data: mockPlans });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('体验版')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByText('编辑');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        const priceInput = screen.getByLabelText('价格') as HTMLInputElement;
        expect(priceInput.value).toBe('0');
      });
    });

    it('应该能够修改套餐价格', async () => {
      const { get, put } = require('../../api/client');
      get.mockResolvedValue({ data: mockPlans });
      put.mockResolvedValue({ data: { success: true } });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('体验版')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByText('编辑');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        const priceInput = screen.getByLabelText('价格') as HTMLInputElement;
        fireEvent.change(priceInput, { target: { value: '50' } });
      });

      const saveButton = screen.getByText('保存');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(put).toHaveBeenCalled();
      });
    });
  });

  describe('二次确认对话框', () => {
    it('价格变动超过 20% 应该显示确认对话框', async () => {
      const { get, put } = require('../../api/client');
      get.mockResolvedValue({ data: mockPlans });
      put.mockResolvedValue({ data: { success: true } });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('专业版')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByText('编辑');
      fireEvent.click(editButtons[1]); // 编辑专业版

      await waitFor(() => {
        const priceInput = screen.getByLabelText('价格') as HTMLInputElement;
        // 从 99 改为 150，变动超过 20%
        fireEvent.change(priceInput, { target: { value: '150' } });
      });

      const saveButton = screen.getByText('保存');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/价格变动超过/)).toBeInTheDocument();
      });
    });

    it('价格变动小于 20% 不应该显示确认对话框', async () => {
      const { get, put } = require('../../api/client');
      get.mockResolvedValue({ data: mockPlans });
      put.mockResolvedValue({ data: { success: true } });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('专业版')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByText('编辑');
      fireEvent.click(editButtons[1]);

      await waitFor(() => {
        const priceInput = screen.getByLabelText('价格') as HTMLInputElement;
        // 从 99 改为 105，变动小于 20%
        fireEvent.change(priceInput, { target: { value: '105' } });
      });

      const saveButton = screen.getByText('保存');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(put).toHaveBeenCalled();
        expect(screen.queryByText(/价格变动超过/)).not.toBeInTheDocument();
      });
    });

    it('确认对话框点击确认应该保存修改', async () => {
      const { get, put } = require('../../api/client');
      get.mockResolvedValue({ data: mockPlans });
      put.mockResolvedValue({ data: { success: true } });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('专业版')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByText('编辑');
      fireEvent.click(editButtons[1]);

      await waitFor(() => {
        const priceInput = screen.getByLabelText('价格') as HTMLInputElement;
        fireEvent.change(priceInput, { target: { value: '150' } });
      });

      const saveButton = screen.getByText('保存');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/价格变动超过/)).toBeInTheDocument();
      });

      const confirmButton = screen.getByText('确认修改');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(put).toHaveBeenCalled();
      });
    });

    it('确认对话框点击取消应该关闭对话框', async () => {
      const { get } = require('../../api/client');
      get.mockResolvedValue({ data: mockPlans });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('专业版')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByText('编辑');
      fireEvent.click(editButtons[1]);

      await waitFor(() => {
        const priceInput = screen.getByLabelText('价格') as HTMLInputElement;
        fireEvent.change(priceInput, { target: { value: '150' } });
      });

      const saveButton = screen.getByText('保存');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/价格变动超过/)).toBeInTheDocument();
      });

      const cancelButton = screen.getByText('取消');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText(/价格变动超过/)).not.toBeInTheDocument();
      });
    });
  });

  describe('配置历史', () => {
    it('应该能够查看配置历史', async () => {
      const { get } = require('../../api/client');
      get.mockResolvedValue({ data: mockPlans });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('体验版')).toBeInTheDocument();
      });

      const historyButtons = screen.getAllByText('历史');
      fireEvent.click(historyButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('配置历史')).toBeInTheDocument();
      });
    });

    it('应该显示历史记录列表', async () => {
      const { get } = require('../../api/client');
      const mockHistory = [
        {
          id: 1,
          plan_id: 1,
          changed_by: 'admin',
          changed_at: '2024-12-25T10:00:00Z',
          old_config: { price: 0 },
          new_config: { price: 50 },
        },
      ];

      get.mockImplementation((url: string) => {
        if (url.includes('/history')) {
          return Promise.resolve({ data: mockHistory });
        }
        return Promise.resolve({ data: mockPlans });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('体验版')).toBeInTheDocument();
      });

      const historyButtons = screen.getAllByText('历史');
      fireEvent.click(historyButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('admin')).toBeInTheDocument();
      });
    });
  });

  describe('配置回滚', () => {
    it('应该能够回滚配置', async () => {
      const { get, post } = require('../../api/client');
      const mockHistory = [
        {
          id: 1,
          plan_id: 1,
          changed_by: 'admin',
          changed_at: '2024-12-25T10:00:00Z',
          old_config: { price: 0 },
          new_config: { price: 50 },
        },
      ];

      get.mockImplementation((url: string) => {
        if (url.includes('/history')) {
          return Promise.resolve({ data: mockHistory });
        }
        return Promise.resolve({ data: mockPlans });
      });

      post.mockResolvedValue({ data: { success: true } });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('体验版')).toBeInTheDocument();
      });

      const historyButtons = screen.getAllByText('历史');
      fireEvent.click(historyButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('admin')).toBeInTheDocument();
      });

      const rollbackButton = screen.getByText('回滚');
      fireEvent.click(rollbackButton);

      await waitFor(() => {
        expect(post).toHaveBeenCalled();
      });
    });
  });
});
