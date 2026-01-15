/**
 * 加密工具
 * 基于机器码的数据加密/解密
 * Requirements: Phase 2 - Cookie 安全存储
 */

import CryptoJS from 'crypto-js';
import { machineIdSync } from 'node-machine-id';
import log from 'electron-log';

/**
 * 获取机器唯一标识作为加密密钥
 */
function getMachineKey(): string {
  try {
    const machineId = machineIdSync();
    // 使用 SHA256 生成固定长度的密钥
    return CryptoJS.SHA256(machineId).toString();
  } catch (error) {
    log.error('Failed to get machine ID:', error);
    // 降级方案：使用固定密钥（不推荐，但保证功能可用）
    return CryptoJS.SHA256('geo-system-fallback-key').toString();
  }
}

// 缓存机器密钥
let cachedMachineKey: string | null = null;

/**
 * 获取缓存的机器密钥
 */
function getKey(): string {
  if (!cachedMachineKey) {
    cachedMachineKey = getMachineKey();
  }
  return cachedMachineKey;
}

/**
 * 加密数据
 * @param data 要加密的数据（字符串或对象）
 * @returns 加密后的字符串
 */
export function encrypt(data: string | object): string {
  try {
    const key = getKey();
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    const encrypted = CryptoJS.AES.encrypt(dataStr, key).toString();
    return encrypted;
  } catch (error) {
    log.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * 解密数据
 * @param encryptedData 加密的字符串
 * @returns 解密后的字符串
 */
export function decrypt(encryptedData: string): string {
  try {
    const key = getKey();
    const bytes = CryptoJS.AES.decrypt(encryptedData, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!decrypted) {
      throw new Error('Decryption resulted in empty string');
    }
    
    return decrypted;
  } catch (error) {
    log.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * 加密对象并返回 JSON 字符串
 * @param obj 要加密的对象
 * @returns 加密后的字符串
 */
export function encryptObject<T>(obj: T): string {
  return encrypt(JSON.stringify(obj));
}

/**
 * 解密字符串并解析为对象
 * @param encryptedData 加密的字符串
 * @returns 解密后的对象
 */
export function decryptObject<T>(encryptedData: string): T {
  const decrypted = decrypt(encryptedData);
  return JSON.parse(decrypted) as T;
}

/**
 * 安全地尝试解密（失败时返回 null）
 * @param encryptedData 加密的字符串
 * @returns 解密后的字符串或 null
 */
export function tryDecrypt(encryptedData: string): string | null {
  try {
    return decrypt(encryptedData);
  } catch {
    return null;
  }
}

/**
 * 安全地尝试解密对象（失败时返回 null）
 * @param encryptedData 加密的字符串
 * @returns 解密后的对象或 null
 */
export function tryDecryptObject<T>(encryptedData: string): T | null {
  try {
    return decryptObject<T>(encryptedData);
  } catch {
    return null;
  }
}

/**
 * 生成随机 ID
 * @param length ID 长度
 * @returns 随机 ID 字符串
 */
export function generateRandomId(length: number = 32): string {
  return CryptoJS.lib.WordArray.random(length / 2).toString();
}

/**
 * 计算数据的 SHA256 哈希
 * @param data 要计算哈希的数据
 * @returns 哈希字符串
 */
export function sha256(data: string): string {
  return CryptoJS.SHA256(data).toString();
}

/**
 * 计算数据的 MD5 哈希
 * @param data 要计算哈希的数据
 * @returns 哈希字符串
 */
export function md5(data: string): string {
  return CryptoJS.MD5(data).toString();
}

/**
 * 验证数据完整性
 * @param data 原始数据
 * @param hash 预期的哈希值
 * @returns 是否匹配
 */
export function verifyIntegrity(data: string, hash: string): boolean {
  return sha256(data) === hash;
}
