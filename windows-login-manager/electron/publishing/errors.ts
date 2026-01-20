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

/**
 * 账号离线错误
 * 当账号Cookie失效或平台掉线时抛出
 */
export class AccountOfflineError extends Error {
  public readonly accountId: number;
  public readonly platformId: string;

  constructor(accountId: number, platformId: string, message?: string) {
    super(message || `账号 #${accountId} 在平台 ${platformId} 已离线`);
    this.name = 'AccountOfflineError';
    this.accountId = accountId;
    this.platformId = platformId;
    
    Object.setPrototypeOf(this, AccountOfflineError.prototype);
  }
}

/**
 * 适配器未找到错误
 */
export class AdapterNotFoundError extends Error {
  public readonly platformId: string;

  constructor(platformId: string) {
    super(`平台 ${platformId} 的适配器未实现`);
    this.name = 'AdapterNotFoundError';
    this.platformId = platformId;
    
    Object.setPrototypeOf(this, AdapterNotFoundError.prototype);
  }
}

/**
 * 任务取消错误
 */
export class TaskCancelledError extends Error {
  public readonly taskId: number;

  constructor(taskId: number) {
    super(`任务 #${taskId} 已被用户取消`);
    this.name = 'TaskCancelledError';
    this.taskId = taskId;
    
    Object.setPrototypeOf(this, TaskCancelledError.prototype);
  }
}
