import { Pool, PoolClient, PoolConfig } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

/**
 * PostgreSQL 数据库配置接口
 */
export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

/**
 * PostgreSQL 数据库管理类
 * 
 * 功能：
 * - 管理 PostgreSQL 连接池
 * - 提供查询接口
 * - 支持事务
 * - 配置管理
 */
export class PostgresDatabase {
  private pool: Pool | null = null;
  private static instance: PostgresDatabase;
  private config: PostgresConfig | null = null;

  private constructor() {
    // 私有构造函数，确保单例
  }

  /**
   * 获取单例实例
   */
  static getInstance(): PostgresDatabase {
    if (!PostgresDatabase.instance) {
      PostgresDatabase.instance = new PostgresDatabase();
    }
    return PostgresDatabase.instance;
  }

  /**
   * 初始化数据库连接
   * 
   * @param config 数据库配置（可选，如果不提供则从配置文件读取）
   */
  async initialize(config?: PostgresConfig): Promise<void> {
    try {
      // 如果已经初始化，先关闭现有连接
      if (this.pool) {
        await this.close();
      }

      // 加载配置
      this.config = config || this.loadConfig();

      // 创建连接池
      const poolConfig: PoolConfig = {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        max: 20, // 最大连接数
        idleTimeoutMillis: 30000, // 空闲连接超时时间
        connectionTimeoutMillis: 5000, // 连接超时时间
      };

      this.pool = new Pool(poolConfig);

      // 监听错误事件
      this.pool.on('error', (err) => {
        console.error('PostgreSQL pool error:', err);
      });

      // 测试连接
      await this.testConnection();

      console.log('✅ PostgreSQL 数据库连接成功');
    } catch (error) {
      console.error('❌ PostgreSQL 数据库初始化失败:', error);
      throw error;
    }
  }

  /**
   * 测试数据库连接
   */
  private async testConnection(): Promise<void> {
    if (!this.pool) {
      throw new Error('数据库连接池未初始化');
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT NOW()');
      console.log('数据库连接测试成功:', result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * 获取连接池
   */
  getPool(): Pool {
    if (!this.pool) {
      throw new Error('数据库连接池未初始化，请先调用 initialize()');
    }
    return this.pool;
  }

  /**
   * 执行查询
   * 
   * @param text SQL 查询语句
   * @param params 查询参数
   * @returns 查询结果
   */
  async query(text: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      throw new Error('数据库连接池未初始化');
    }

    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      // 记录慢查询（超过 100ms）
      if (duration > 100) {
        console.warn(`慢查询 (${duration}ms):`, text.substring(0, 100));
      }

      return res;
    } catch (error) {
      console.error('查询错误:', error);
      console.error('SQL:', text);
      console.error('参数:', params);
      throw error;
    }
  }

  /**
   * 获取一个客户端连接（用于事务）
   */
  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('数据库连接池未初始化');
    }
    return await this.pool.connect();
  }

  /**
   * 执行事务
   * 
   * @param callback 事务回调函数
   * @returns 事务结果
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('事务回滚:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('PostgreSQL 数据库连接已关闭');
    }
  }

  /**
   * 从配置文件加载数据库配置
   */
  private loadConfig(): PostgresConfig {
    try {
      // 配置文件路径
      const configPath = this.getConfigPath();

      // 如果配置文件存在，读取配置
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configData);
        console.log('从配置文件加载数据库配置:', configPath);
        return config;
      }

      // 如果配置文件不存在，返回默认配置
      console.log('配置文件不存在，使用默认配置');
      return this.getDefaultConfig();
    } catch (error) {
      console.error('加载配置文件失败，使用默认配置:', error);
      return this.getDefaultConfig();
    }
  }

  /**
   * 保存数据库配置到文件
   * 
   * @param config 数据库配置
   */
  saveConfig(config: PostgresConfig): void {
    try {
      const configPath = this.getConfigPath();
      const configDir = path.dirname(configPath);

      // 确保配置目录存在
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // 保存配置
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log('数据库配置已保存:', configPath);
    } catch (error) {
      console.error('保存配置文件失败:', error);
      throw error;
    }
  }

  /**
   * 获取配置文件路径
   */
  private getConfigPath(): string {
    // 使用 Electron 的 userData 目录
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'db-config.json');
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): PostgresConfig {
    // 从环境变量读取配置，如果没有则使用默认值
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'geo_windows',
      user: process.env.DB_USER || 'lzc',  // 修改默认用户为 lzc
      password: process.env.DB_PASSWORD || ''
    };
  }

  /**
   * 获取当前配置
   */
  getConfig(): PostgresConfig | null {
    return this.config;
  }

  /**
   * 检查数据库是否已初始化
   */
  isInitialized(): boolean {
    return this.pool !== null;
  }
}

/**
 * 导出单例实例
 */
export const db = PostgresDatabase.getInstance();

// ==================== 便捷函数导出 ====================

let dbInstance: PostgresDatabase | null = null;

/**
 * 初始化 PostgreSQL 数据库
 */
export async function initializePostgres(config?: PostgresConfig): Promise<void> {
  dbInstance = PostgresDatabase.getInstance();
  await dbInstance.initialize(config);
}

/**
 * 获取连接池
 */
export function getPool(): Pool {
  if (!dbInstance) {
    throw new Error('数据库未初始化，请先调用 initializePostgres()');
  }
  return dbInstance.getPool();
}

/**
 * 关闭数据库连接
 */
export async function closePostgres(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}
