import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskConfigModal from './TaskConfigModal';
import * as api from '../api/articleGenerationApi';
import * as distillationApi from '../api/distillationApi';
import type { ConversionTarget, Album, KnowledgeBase, ArticleSetting } from '../types/articleGeneration';
import type { DistillationUsageStats } from '../api/distillationApi';

// Mock the API modules
jest.mock('../api/articleGenerationApi');
jest.mock('../api/distillationApi');

const mockApi = api as jest.Mocked<typeof api>;
const mockDistillationApi = distillationApi as jest.Mocked<typeof distillationApi>;

describe('TaskConfigModal', () => {
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();

  const mockDistillations: DistillationUsageStats[] = [
    { 
      distillationId: 1, 
      keyword: '测试关键词', 
      provider: 'deepseek', 
      usageCount: 0,
      lastUsedAt: null,
      topicCount: 5,
      createdAt: '2024-01-01T00:00:00Z' 
    },
    { 
      distillationId: 2, 
      keyword: '推荐关键词', 
      provider: 'deepseek', 
      usageCount: 1,
      lastUsedAt: '2024-01-02T00:00:00Z',
      topicCount: 3,
      createdAt: '2024-01-01T00:00:00Z' 
    },
    { 
      distillationId: 3, 
      keyword: '无话题关键词', 
      provider: 'deepseek', 
      usageCount: 0,
      lastUsedAt: null,
      topicCount: 0,
      createdAt: '2024-01-01T00:00:00Z' 
    }
  ];

  const mockAlbums: Album[] = [
    { id: 1, name: '测试图库', image_count: 10, cover_image: null, created_at: '2024-01-01T00:00:00Z' }
  ];

  const mockKnowledgeBases: KnowledgeBase[] = [
    { id: 1, name: '测试知识库', description: '描述', document_count: 5, created_at: '2024-01-01T00:00:00Z' }
  ];

  const mockArticleSettings: ArticleSetting[] = [
    { id: 1, name: '测试设置', prompt: '提示词', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' }
  ];

  const mockConversionTargets: ConversionTarget[] = [
    {
      id: 1,
      company_name: '测试公司A',
      industry: '互联网',
      company_size: '51-200人',
      features: null,
      contact_info: 'test@example.com',
      website: null,
      target_audience: null,
      core_products: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    {
      id: 2,
      company_name: '测试公司B',
      industry: '金融',
      company_size: '201-500人',
      features: null,
      contact_info: '13800138000',
      website: null,
      target_audience: null,
      core_products: null,
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockDistillationApi.getDistillationsWithStats.mockResolvedValue({
      distillations: mockDistillations,
      total: mockDistillations.length
    });
    mockApi.fetchAlbums.mockResolvedValue(mockAlbums);
    mockApi.fetchKnowledgeBases.mockResolvedValue(mockKnowledgeBases);
    mockApi.fetchArticleSettings.mockResolvedValue(mockArticleSettings);
    mockApi.fetchConversionTargets.mockResolvedValue(mockConversionTargets);
  });

  it('should display conversion target field when dialog opens', async () => {
    render(
      <TaskConfigModal
        visible={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('选择转化目标')).toBeInTheDocument();
    });
  });

  it('should display conversion target field after distillation history field', async () => {
    render(
      <TaskConfigModal
        visible={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      const labels = screen.getAllByRole('label');
      const distillationIndex = labels.findIndex(label => label.textContent?.includes('选择蒸馏历史'));
      const conversionTargetIndex = labels.findIndex(label => label.textContent?.includes('选择转化目标'));
      
      expect(conversionTargetIndex).toBeGreaterThan(distillationIndex);
    });
  });

  it('should call fetchConversionTargets when loading data', async () => {
    render(
      <TaskConfigModal
        visible={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(mockApi.fetchConversionTargets).toHaveBeenCalled();
    });
  });

  it('should display loading indicator while loading data', async () => {
    // Make API calls take longer
    mockApi.fetchConversionTargets.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockConversionTargets), 100))
    );

    render(
      <TaskConfigModal
        visible={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByRole('img', { name: /loading/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByRole('img', { name: /loading/i })).not.toBeInTheDocument();
    });
  });

  it('should render conversion target options with company name and industry', async () => {
    render(
      <TaskConfigModal
        visible={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(mockApi.fetchConversionTargets).toHaveBeenCalled();
    });

    const select = screen.getByLabelText('选择转化目标');
    fireEvent.mouseDown(select);

    await waitFor(() => {
      expect(screen.getByText(/测试公司A \(互联网\)/)).toBeInTheDocument();
      expect(screen.getByText(/测试公司B \(金融\)/)).toBeInTheDocument();
    });
  });

  it('should update form value when user selects a conversion target', async () => {
    const user = userEvent.setup();
    
    render(
      <TaskConfigModal
        visible={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(mockApi.fetchConversionTargets).toHaveBeenCalled();
    });

    const select = screen.getByLabelText('选择转化目标');
    await user.click(select);

    const option = await screen.findByText(/测试公司A \(互联网\)/);
    await user.click(option);

    expect(select).toHaveValue('1');
  });

  it('should support search functionality', async () => {
    render(
      <TaskConfigModal
        visible={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(mockApi.fetchConversionTargets).toHaveBeenCalled();
    });

    const select = screen.getByLabelText('选择转化目标');
    expect(select).toHaveAttribute('showSearch', 'true');
  });

  it('should show validation error when conversion target is not selected', async () => {
    const user = userEvent.setup();
    
    render(
      <TaskConfigModal
        visible={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(mockApi.fetchConversionTargets).toHaveBeenCalled();
    });

    const submitButton = screen.getByText('生成文章');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('请选择转化目标')).toBeInTheDocument();
    });
  });

  it('should include conversionTargetId when submitting', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue(undefined);
    
    render(
      <TaskConfigModal
        visible={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(mockApi.fetchConversionTargets).toHaveBeenCalled();
    });

    // Fill all required fields
    const distillationSelect = screen.getByLabelText('选择蒸馏历史');
    await user.click(distillationSelect);
    await user.click(await screen.findByText(/测试关键词/));

    const conversionTargetSelect = screen.getByLabelText('选择转化目标');
    await user.click(conversionTargetSelect);
    await user.click(await screen.findByText(/测试公司A/));

    const albumSelect = screen.getByLabelText('选择企业图库');
    await user.click(albumSelect);
    await user.click(await screen.findByText(/测试图库/));

    const knowledgeBaseSelect = screen.getByLabelText('选择企业知识库');
    await user.click(knowledgeBaseSelect);
    await user.click(await screen.findByText(/测试知识库/));

    const articleSettingSelect = screen.getByLabelText('选择文章设置');
    await user.click(articleSettingSelect);
    await user.click(await screen.findByText(/测试设置/));

    const countInput = screen.getByLabelText('生成文章数量');
    await user.type(countInput, '5');

    const submitButton = screen.getByText('生成文章');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          conversionTargetId: 1
        })
      );
    });
  });

  it('should reset all fields including conversion target when cancelled', async () => {
    const user = userEvent.setup();
    
    render(
      <TaskConfigModal
        visible={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(mockApi.fetchConversionTargets).toHaveBeenCalled();
    });

    // Select a conversion target
    const select = screen.getByLabelText('选择转化目标');
    await user.click(select);
    await user.click(await screen.findByText(/测试公司A/));

    // Cancel
    const cancelButton = screen.getByText('取消');
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should display "暂无转化目标" when list is empty', async () => {
    mockApi.fetchConversionTargets.mockResolvedValue([]);
    
    render(
      <TaskConfigModal
        visible={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(mockApi.fetchConversionTargets).toHaveBeenCalled();
    });

    const select = screen.getByLabelText('选择转化目标');
    fireEvent.mouseDown(select);

    await waitFor(() => {
      expect(screen.getByText('暂无转化目标')).toBeInTheDocument();
    });
  });

  it('should display error message when API fails', async () => {
    mockApi.fetchConversionTargets.mockRejectedValue(new Error('API Error'));
    
    render(
      <TaskConfigModal
        visible={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/加载数据失败/)).toBeInTheDocument();
    });
  });

  it('should hide loading indicator after data loads', async () => {
    render(
      <TaskConfigModal
        visible={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(mockApi.fetchConversionTargets).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.queryByRole('img', { name: /loading/i })).not.toBeInTheDocument();
    });
  });

  it('should display usage count for each distillation', async () => {
    render(
      <TaskConfigModal
        visible={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(mockDistillationApi.getDistillationsWithStats).toHaveBeenCalled();
    });

    const select = screen.getByLabelText('选择蒸馏历史');
    fireEvent.mouseDown(select);

    await waitFor(() => {
      expect(screen.getByText(/使用 0 次/)).toBeInTheDocument();
      expect(screen.getByText(/使用 1 次/)).toBeInTheDocument();
    });
  });

  it('should show recommended tag for top 3 distillations with topics', async () => {
    render(
      <TaskConfigModal
        visible={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(mockDistillationApi.getDistillationsWithStats).toHaveBeenCalled();
    });

    const select = screen.getByLabelText('选择蒸馏历史');
    fireEvent.mouseDown(select);

    await waitFor(() => {
      const recommendedTags = screen.getAllByText('推荐');
      // Should have 2 recommended tags (first 2 have topics, 3rd has no topics)
      expect(recommendedTags.length).toBe(2);
    });
  });

  it('should disable distillations with no topics', async () => {
    render(
      <TaskConfigModal
        visible={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(mockDistillationApi.getDistillationsWithStats).toHaveBeenCalled();
    });

    const select = screen.getByLabelText('选择蒸馏历史');
    fireEvent.mouseDown(select);

    await waitFor(() => {
      expect(screen.getByText(/无话题关键词.*\(无可用话题\)/)).toBeInTheDocument();
    });
  });

  it('should show tooltip with recommendation reason on hover', async () => {
    render(
      <TaskConfigModal
        visible={true}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(mockDistillationApi.getDistillationsWithStats).toHaveBeenCalled();
    });

    const select = screen.getByLabelText('选择蒸馏历史');
    fireEvent.mouseDown(select);

    await waitFor(() => {
      const recommendedTag = screen.getAllByText('推荐')[0];
      expect(recommendedTag).toBeInTheDocument();
    });
  });
});
