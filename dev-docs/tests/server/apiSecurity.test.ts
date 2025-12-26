import { Request, Response } from 'express';
import { validatePayload, requireApiAuth, commonSchemas } from '../apiSecurity';

describe('API Security', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    mockReq = {
      body: {},
      headers: {},
      ip: '127.0.0.1'
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    nextFunction = jest.fn();
  });

  /**
   * Feature: system-security-foundation
   * Property 54: API认证要求
   * For any API endpoint, unauthenticated requests should be rejected.
   * Validates: Requirements 17.1
   */
  describe('Property 54: API authentication requirement', () => {
    test('should reject unauthenticated requests', () => {
      requireApiAuth(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'API端点需要认证'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    test('should allow authenticated requests', () => {
      (mockReq as any).user = { userId: 1, username: 'testuser' };

      requireApiAuth(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  /**
   * Feature: system-security-foundation
   * Property 56: API负载验证
   * For any API request, invalid payloads should be rejected with validation errors.
   * Validates: Requirements 17.5
   */
  describe('Property 56: API payload validation', () => {
    test('should reject invalid payloads', () => {
      mockReq.body = {
        username: 'ab', // Too short
        password: '123' // Too short
      };

      const middleware = validatePayload(commonSchemas.createUser);
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: '请求数据格式错误'
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    test('should accept valid payloads', () => {
      mockReq.body = {
        username: 'validuser',
        password: 'ValidPass123!'
      };

      const middleware = validatePayload(commonSchemas.createUser);
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should reject payloads with extra fields', () => {
      mockReq.body = {
        username: 'validuser',
        password: 'ValidPass123!',
        extraField: 'not allowed'
      };

      const middleware = validatePayload(commonSchemas.createUser);
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    test('should validate password change schema', () => {
      mockReq.body = {
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass123!'
      };

      const middleware = validatePayload(commonSchemas.changePassword);
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    test('should reject password change without required fields', () => {
      mockReq.body = {
        newPassword: 'NewPass123!'
        // Missing currentPassword
      };

      const middleware = validatePayload(commonSchemas.changePassword);
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  // Unit tests
  describe('Unit Tests', () => {
    test('should validate user update schema', () => {
      mockReq.body = {
        username: 'newusername',
        role: 'admin'
      };

      const middleware = validatePayload(commonSchemas.updateUser);
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    test('should reject invalid role in update', () => {
      mockReq.body = {
        role: 'invalid_role'
      };

      const middleware = validatePayload(commonSchemas.updateUser);
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('should validate permission grant schema', () => {
      mockReq.body = {
        userId: 123,
        permissions: ['view_users', 'edit_users']
      };

      const middleware = validatePayload(commonSchemas.grantPermission);
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    test('should reject empty permissions array', () => {
      mockReq.body = {
        userId: 123,
        permissions: []
      };

      const middleware = validatePayload(commonSchemas.grantPermission);
      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });
});
