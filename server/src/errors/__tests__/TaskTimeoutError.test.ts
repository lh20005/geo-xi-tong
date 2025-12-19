import { TaskTimeoutError } from '../TaskTimeoutError';

describe('TaskTimeoutError', () => {
  describe('构造函数', () => {
    it('应该创建带有超时时间的错误', () => {
      const error = new TaskTimeoutError(15);
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TaskTimeoutError);
      expect(error.name).toBe('TaskTimeoutError');
      expect(error.timeoutMinutes).toBe(15);
      expect(error.message).toBe('任务执行超时（15分钟）');
      expect(error.taskId).toBeUndefined();
    });

    it('应该创建带有任务ID的错误', () => {
      const error = new TaskTimeoutError(10, 123);
      
      expect(error.timeoutMinutes).toBe(10);
      expect(error.taskId).toBe(123);
      expect(error.message).toBe('任务执行超时（10分钟）');
    });

    it('应该维护正确的原型链', () => {
      const error = new TaskTimeoutError(5);
      
      expect(Object.getPrototypeOf(error)).toBe(TaskTimeoutError.prototype);
      expect(error instanceof TaskTimeoutError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('错误属性', () => {
    it('应该包含所有必需的属性', () => {
      const error = new TaskTimeoutError(20, 456);
      
      expect(error).toHaveProperty('name');
      expect(error).toHaveProperty('message');
      expect(error).toHaveProperty('timeoutMinutes');
      expect(error).toHaveProperty('taskId');
      expect(error).toHaveProperty('stack');
    });

    it('应该正确设置超时时间', () => {
      const testCases = [1, 5, 10, 15, 30, 60];
      
      testCases.forEach(timeout => {
        const error = new TaskTimeoutError(timeout);
        expect(error.timeoutMinutes).toBe(timeout);
        expect(error.message).toContain(`${timeout}分钟`);
      });
    });

    it('应该正确设置任务ID', () => {
      const testCases = [1, 100, 999, 12345];
      
      testCases.forEach(taskId => {
        const error = new TaskTimeoutError(15, taskId);
        expect(error.taskId).toBe(taskId);
      });
    });
  });

  describe('错误捕获', () => {
    it('应该能够被try-catch捕获', () => {
      expect(() => {
        throw new TaskTimeoutError(15);
      }).toThrow(TaskTimeoutError);
    });

    it('应该能够被Error类型捕获', () => {
      expect(() => {
        throw new TaskTimeoutError(15);
      }).toThrow(Error);
    });

    it('应该能够通过instanceof检查', () => {
      try {
        throw new TaskTimeoutError(15, 123);
      } catch (error) {
        expect(error instanceof TaskTimeoutError).toBe(true);
        expect(error instanceof Error).toBe(true);
        
        if (error instanceof TaskTimeoutError) {
          expect(error.timeoutMinutes).toBe(15);
          expect(error.taskId).toBe(123);
        }
      }
    });
  });

  describe('错误消息格式', () => {
    it('应该包含超时时间信息', () => {
      const error = new TaskTimeoutError(25);
      expect(error.message).toMatch(/25分钟/);
    });

    it('应该使用中文消息', () => {
      const error = new TaskTimeoutError(10);
      expect(error.message).toContain('任务执行超时');
    });
  });
});
