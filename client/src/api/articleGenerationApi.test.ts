import axios from 'axios';
import { fetchConversionTargets } from './articleGenerationApi';
import type { ConversionTarget } from '../types/articleGeneration';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('fetchConversionTargets', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully fetch conversion targets list', async () => {
    // Arrange
    const mockTargets: ConversionTarget[] = [
      {
        id: 1,
        company_name: '测试公司A',
        industry: '互联网',
        company_size: '51-200人',
        features: '创新型企业',
        contact_info: 'test@example.com',
        website: 'https://example.com',
        target_audience: 'B2B客户',
        core_products: '云服务',
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

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          targets: mockTargets,
          total: 2,
          page: 1,
          pageSize: 10
        }
      }
    });

    // Act
    const result = await fetchConversionTargets();

    // Assert
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/conversion-targets');
    expect(result).toEqual(mockTargets);
    expect(result).toHaveLength(2);
    expect(result[0].company_name).toBe('测试公司A');
    expect(result[1].industry).toBe('金融');
  });

  it('should return empty array when API returns no data', async () => {
    // Arrange
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          targets: [],
          total: 0,
          page: 1,
          pageSize: 10
        }
      }
    });

    // Act
    const result = await fetchConversionTargets();

    // Assert
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it('should return empty array when data structure is missing', async () => {
    // Arrange
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true
      }
    });

    // Act
    const result = await fetchConversionTargets();

    // Assert
    expect(result).toEqual([]);
  });

  it('should throw error when API call fails', async () => {
    // Arrange
    const errorMessage = 'Network Error';
    mockedAxios.get.mockRejectedValueOnce(new Error(errorMessage));

    // Act & Assert
    await expect(fetchConversionTargets()).rejects.toThrow(errorMessage);
  });

  it('should throw error with response data when API returns error', async () => {
    // Arrange
    const errorResponse = {
      response: {
        status: 500,
        data: {
          error: '获取转化目标列表失败',
          code: 'DATABASE_ERROR'
        }
      }
    };
    mockedAxios.get.mockRejectedValueOnce(errorResponse);

    // Act & Assert
    await expect(fetchConversionTargets()).rejects.toEqual(errorResponse);
  });

  it('should return correct data format matching ConversionTarget interface', async () => {
    // Arrange
    const mockTarget: ConversionTarget = {
      id: 1,
      company_name: '完整数据公司',
      industry: '制造业',
      company_size: '1000人以上',
      features: '行业领先',
      contact_info: 'contact@company.com',
      website: 'https://company.com',
      target_audience: '大型企业',
      core_products: '工业设备',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    };

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          targets: [mockTarget]
        }
      }
    });

    // Act
    const result = await fetchConversionTargets();

    // Assert
    expect(result[0]).toHaveProperty('id');
    expect(result[0]).toHaveProperty('company_name');
    expect(result[0]).toHaveProperty('industry');
    expect(result[0]).toHaveProperty('company_size');
    expect(result[0]).toHaveProperty('features');
    expect(result[0]).toHaveProperty('contact_info');
    expect(result[0]).toHaveProperty('website');
    expect(result[0]).toHaveProperty('target_audience');
    expect(result[0]).toHaveProperty('core_products');
    expect(result[0]).toHaveProperty('created_at');
    expect(result[0]).toHaveProperty('updated_at');
    
    expect(typeof result[0].id).toBe('number');
    expect(typeof result[0].company_name).toBe('string');
    expect(typeof result[0].industry).toBe('string');
  });
});
