/**
 * 异步互斥锁 (Mutex)
 * 
 * 用于确保同一时间只有一个异步操作可以访问临界区
 * 基于队列实现，保证先到先得的公平性
 * 
 * 参考: https://dev.to/0916dhkim/simple-typescript-mutex-implementation-5544
 */

type ReleaseFunction = () => void;

interface QueueEntry {
  resolve: (release: ReleaseFunction) => void;
}

export class Mutex {
  private _queue: QueueEntry[] = [];
  private _isLocked = false;

  /**
   * 获取锁
   * 如果锁已被占用，会等待直到锁可用
   * @returns 释放锁的函数
   */
  acquire(): Promise<ReleaseFunction> {
    return new Promise<ReleaseFunction>((resolve) => {
      this._queue.push({ resolve });
      this._dispatch();
    });
  }

  /**
   * 在互斥锁保护下执行回调函数
   * 自动获取和释放锁
   * @param callback 要执行的异步函数
   * @returns 回调函数的返回值
   */
  async runExclusive<T>(callback: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await callback();
    } finally {
      release();
    }
  }

  /**
   * 检查锁是否被占用
   */
  isLocked(): boolean {
    return this._isLocked;
  }

  /**
   * 获取等待队列长度
   */
  getQueueLength(): number {
    return this._queue.length;
  }

  /**
   * 分发锁给下一个等待者
   */
  private _dispatch(): void {
    if (this._isLocked) {
      return;
    }
    const nextEntry = this._queue.shift();
    if (!nextEntry) {
      return;
    }
    this._isLocked = true;
    nextEntry.resolve(this._buildRelease());
  }

  /**
   * 构建释放函数
   */
  private _buildRelease(): ReleaseFunction {
    return () => {
      this._isLocked = false;
      this._dispatch();
    };
  }
}

/**
 * 全局任务执行锁
 * 确保同一时间只有一个发布任务在执行
 */
export const globalTaskMutex = new Mutex();
