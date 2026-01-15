/**
 * 适配器版本管理服务
 * 
 * 用于平台适配器热更新支持。
 * 
 * 功能：
 * - 获取所有适配器版本列表
 * - 获取单个适配器版本信息
 * - 下载适配器代码
 * - 获取适配器更新日志
 * - 更新适配器版本（管理员）
 */

import { pool } from '../db/database';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// 适配器代码存储目录
const ADAPTERS_DIR = path.join(__dirname, '../../uploads/adapters');

/**
 * 适配器版本信息接口
 */
export interface AdapterVersion {
  platform: string;
  platformName: string;
  version: string;
  minClientVersion: string | null;
  updatedAt: string;
  status: string;
}

/**
 * 更新日志条目接口
 */
export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

/**
 * 适配器版本管理服务
 */
export class AdapterVersionService {
  private static instance: AdapterVersionService;

  private constructor() {
    // 确保适配器目录存在
    this.ensureAdaptersDir();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): AdapterVersionService {
    if (!AdapterVersionService.instance) {
      AdapterVersionService.instance = new AdapterVersionService();
    }
    return AdapterVersionService.instance;
  }

  /**
   * 确保适配器目录存在
   */
  private ensureAdaptersDir(): void {
    if (!fs.existsSync(ADAPTERS_DIR)) {
      fs.mkdirSync(ADAPTERS_DIR, { recursive: true });
      console.log(`[AdapterVersionService] 创建适配器目录: ${ADAPTERS_DIR}`);
    }
  }

  /**
   * 获取所有适配器版本列表
   */
  async getVersions(): Promise<{
    adapters: Record<string, { version: string; updatedAt: string }>;
    minClientVersion: string;
  }> {
    const result = await pool.query(
      `SELECT platform, version, updated_at, min_client_version
       FROM adapter_versions
       WHERE is_active = true
       ORDER BY platform`
    );

    const adapters: Record<string, { version: string; updatedAt: string }> = {};
    let minClientVersion = '1.0.0';

    for (const row of result.rows) {
      adapters[row.platform] = {
        version: row.version,
        updatedAt: row.updated_at.toISOString().split('T')[0]
      };
      
      // 取所有适配器中最高的最低客户端版本要求
      if (row.min_client_version && this.compareVersions(row.min_client_version, minClientVersion) > 0) {
        minClientVersion = row.min_client_version;
      }
    }

    return {
      adapters,
      minClientVersion
    };
  }

  /**
   * 获取单个适配器版本信息
   */
  async getAdapterVersion(platform: string): Promise<AdapterVersion | null> {
    const result = await pool.query(
      `SELECT platform, version, min_client_version, updated_at, is_active
       FROM adapter_versions
       WHERE platform = $1`,
      [platform]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      platform: row.platform,
      platformName: row.platform,  // 使用 platform 作为名称
      version: row.version,
      minClientVersion: row.min_client_version,
      updatedAt: row.updated_at.toISOString(),
      status: row.is_active ? 'active' : 'disabled'
    };
  }

  /**
   * 下载适配器代码
   */
  async downloadAdapter(platform: string): Promise<{
    code: string;
    version: string;
    hash: string;
  } | null> {
    const result = await pool.query(
      `SELECT version, code_url, changelog
       FROM adapter_versions
       WHERE platform = $1 AND is_active = true`,
      [platform]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const { version, code_url, changelog } = result.rows[0];

    // 如果没有代码文件路径，返回空代码
    if (!code_url) {
      return {
        code: '',
        version,
        hash: ''
      };
    }

    // 如果是 URL，直接返回 URL（客户端自行下载）
    // 如果是本地路径，读取文件
    if (code_url.startsWith('http')) {
      return {
        code: code_url,  // 返回 URL
        version,
        hash: ''
      };
    }

    const fullPath = path.join(ADAPTERS_DIR, code_url);

    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      console.warn(`[AdapterVersionService] 适配器代码文件不存在: ${fullPath}`);
      return {
        code: '',
        version,
        hash: ''
      };
    }

    const code = fs.readFileSync(fullPath, 'utf-8');
    const hash = crypto.createHash('sha256').update(code).digest('hex');

    return {
      code,
      version,
      hash
    };
  }

  /**
   * 获取适配器更新日志
   */
  async getChangelog(platform: string): Promise<{
    platform: string;
    changelog: string;
  } | null> {
    const result = await pool.query(
      `SELECT platform, changelog
       FROM adapter_versions
       WHERE platform = $1`,
      [platform]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const { changelog } = result.rows[0];

    return {
      platform,
      changelog: changelog || ''
    };
  }

  /**
   * 更新适配器版本（管理员）
   */
  async updateAdapterVersion(
    platform: string,
    version: string,
    code: string,
    changes: string[],
    minClientVersion?: string
  ): Promise<boolean> {
    // 计算代码哈希
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    // 保存代码文件
    const codePath = `${platform}_${version}.js`;
    const fullPath = path.join(ADAPTERS_DIR, codePath);
    fs.writeFileSync(fullPath, code);

    // 获取现有更新日志
    const existingResult = await pool.query(
      `SELECT changelog FROM adapter_versions WHERE platform = $1`,
      [platform]
    );

    let changelogText = '';
    if (existingResult.rows.length > 0 && existingResult.rows[0].changelog) {
      changelogText = existingResult.rows[0].changelog;
    }

    // 添加新的更新日志条目
    const newEntry = `${version} (${new Date().toISOString().split('T')[0]}): ${changes.join('; ')}`;
    changelogText = changelogText ? `${newEntry}\n${changelogText}` : newEntry;

    // 更新数据库
    const result = await pool.query(
      `UPDATE adapter_versions
       SET version = $1,
           code_url = $2,
           changelog = $3,
           min_client_version = COALESCE($4, min_client_version),
           updated_at = NOW()
       WHERE platform = $5
       RETURNING id`,
      [version, codePath, changelogText, minClientVersion, platform]
    );

    if (result.rows.length === 0) {
      // 如果不存在，插入新记录
      await pool.query(
        `INSERT INTO adapter_versions 
         (platform, version, code_url, changelog, min_client_version)
         VALUES ($1, $2, $3, $4, $5)`,
        [platform, version, codePath, changelogText, minClientVersion || '1.0.0']
      );
    }

    console.log(`[AdapterVersionService] 更新适配器版本: ${platform} -> ${version}`);
    return true;
  }

  /**
   * 比较版本号
   * 返回: 1 (a > b), -1 (a < b), 0 (a == b)
   */
  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const numA = partsA[i] || 0;
      const numB = partsB[i] || 0;

      if (numA > numB) return 1;
      if (numA < numB) return -1;
    }

    return 0;
  }

  /**
   * 检查客户端版本是否满足要求
   */
  async checkClientVersion(clientVersion: string): Promise<{
    compatible: boolean;
    minRequired: string;
    message?: string;
  }> {
    const { minClientVersion } = await this.getVersions();

    const compatible = this.compareVersions(clientVersion, minClientVersion) >= 0;

    return {
      compatible,
      minRequired: minClientVersion,
      message: compatible ? undefined : `客户端版本过低，请升级到 ${minClientVersion} 或更高版本`
    };
  }

  /**
   * 获取需要更新的适配器列表
   */
  async getUpdatesNeeded(
    localVersions: Record<string, string>
  ): Promise<string[]> {
    const { adapters } = await this.getVersions();
    const updates: string[] = [];

    for (const [platform, info] of Object.entries(adapters)) {
      const localVersion = localVersions[platform];
      if (!localVersion || this.compareVersions(info.version, localVersion) > 0) {
        updates.push(platform);
      }
    }

    return updates;
  }
}

// 导出单例实例
export const adapterVersionService = AdapterVersionService.getInstance();
