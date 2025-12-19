/**
 * 任务超时错误
 * 当任务执行时间超过配置的超时限制时抛出
 */
export class TaskTimeoutError extends Error {
  public readonly taskId?: number;
  public readonly timeoutMinutes: number;

  constructor(timeoutMinutes: number, taskId?: number) {
    super(`任务执行超时（${timeoutMinutes}分钟）`);
    this.name = 'TaskTimeoutError';
    this.timeoutMinutes = timeoutMinutes;
    this.taskId = taskId;
    
    // 维护正确的原型链
    Object.setPrototypeOf(this, TaskTimeoutError.prototype);
  }
}
