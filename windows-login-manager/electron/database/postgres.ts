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

      // 运行迁移
      await this.runMigrations();

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
   * 运行数据库迁移
   */
  private async runMigrations(): Promise<void> {
    if (!this.pool) {
      throw new Error('数据库连接池未初始化');
    }

    console.log('PostgreSQL: 开始运行迁移...');

    const client = await this.pool.connect();
    try {
      // 创建迁移记录表
      await client.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
          id SERIAL PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          applied_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // 获取迁移文件目录
      let migrationsDir: string;
      
      if (app && app.isPackaged) {
        // 生产环境：迁移文件在 resources/migrations
        migrationsDir = path.join(process.resourcesPath, 'migrations');
      } else {
        // 开发环境：迁移文件在 dist-electron/database/migrations
        migrationsDir = path.join(__dirname, 'migrations');
        
        // 脚本执行时的路径兼容
        if (!fs.existsSync(migrationsDir)) {
            // 尝试相对于项目根目录的路径
            const possiblePath = path.join(process.cwd(), 'electron/database/migrations');
            if (fs.existsSync(possiblePath)) {
                migrationsDir = possiblePath;
            } else {
                // 尝试相对于当前文件的路径（如果是 ts-node/tsx 执行，__dirname 可能是源文件位置）
                const sourcePath = path.join(__dirname, 'migrations');
                if (fs.existsSync(sourcePath)) {
                    migrationsDir = sourcePath;
                }
            }
        }
      }

      console.log(`PostgreSQL: 迁移目录: ${migrationsDir}`);

      // 如果迁移目录不存在，创建它
      if (!fs.existsSync(migrationsDir)) {
        fs.mkdirSync(migrationsDir, { recursive: true });
        console.log('PostgreSQL: 创建迁移目录');
      }

      // 获取所有迁移文件
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

      console.log(`PostgreSQL: 找到 ${migrationFiles.length} 个迁移文件`);

      // 执行未应用的迁移
      for (const file of migrationFiles) {
        const result = await client.query(
          'SELECT 1 FROM _migrations WHERE name = $1',
          [file]
        );

        if (result.rows.length === 0) {
          console.log(`PostgreSQL: 应用迁移: ${file}`);
          
          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
          
          // 使用事务执行迁移
          try {
            await client.query('BEGIN');
            await client.query(sql);
            await client.query(
              'INSERT INTO _migrations (name) VALUES ($1)',
              [file]
            );
            await client.query('COMMIT');
            console.log(`PostgreSQL: 迁移应用成功: ${file}`);
          } catch (error) {
            await client.query('ROLLBACK');
            console.error(`PostgreSQL: 迁移应用失败 ${file}:`, error);
            throw error;
          }
        }
      }

      console.log('PostgreSQL: 迁移完成');
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
    if (app) {
      const userDataPath = app.getPath('userData');
      return path.join(userDataPath, 'db-config.json');
    }
    // 脚本环境下使用当前目录
    return path.join(process.cwd(), 'db-config.json');
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
