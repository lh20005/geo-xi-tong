/**
 * Token 同步工具
 * 确保 Electron storage 和 localStorage 之间的 token 同步
 */

/**
 * 从 Electron storage 同步 token 到 localStorage
 */
export async function syncTokensToLocalStorage(): Promise<boolean> {
  try {
    if (!window.electron) {
      console.log('[TokenSync] 不在 Electron 环境中');
      return false;
    }

    console.log('[TokenSync] 🔄 开始同步 tokens...');
    const tokens = await window.electron.storage.getTokens();
    
    if (tokens?.authToken) {
      localStorage.setItem('auth_token', tokens.authToken);
      localStorage.setItem('refresh_token', tokens.refreshToken);
      console.log('[TokenSync] ✅ Tokens 已同步到 localStorage');
      return true;
    } else {
      console.log('[TokenSync] ⚠️ Electron storage 中没有 tokens');
      return false;
    }
  } catch (error) {
    console.error('[TokenSync] ❌ 同步失败:', error);
    return false;
  }
}

/**
 * 从 localStorage 同步 token 到 Electron storage
 */
export async function syncTokensToElectronStorage(): Promise<boolean> {
  try {
    if (!window.electron) {
      console.log('[TokenSync] 不在 Electron 环境中');
      return false;
    }

    const authToken = localStorage.getItem('auth_token');
    const refreshToken = localStorage.getItem('refresh_token');
    
    if (authToken && refreshToken) {
      await window.electron.storage.saveTokens({
        authToken,
        refreshToken
      });
      console.log('[TokenSync] ✅ Tokens 已同步到 Electron storage');
      return true;
    } else {
      console.log('[TokenSync] ⚠️ localStorage 中没有 tokens');
      return false;
    }
  } catch (error) {
    console.error('[TokenSync] ❌ 同步失败:', error);
    return false;
  }
}

/**
 * 双向同步 - 确保两个存储都有 token
 */
export async function ensureTokensSync(): Promise<void> {
  try {
    console.log('[TokenSync] 🔄 执行双向同步...');
    
    // 先尝试从 Electron storage 同步到 localStorage
    const syncedFromElectron = await syncTokensToLocalStorage();
    
    // 如果 Electron storage 没有，尝试从 localStorage 同步
    if (!syncedFromElectron) {
      await syncTokensToElectronStorage();
    }
    
    console.log('[TokenSync] ✅ 同步完成');
  } catch (error) {
    console.error('[TokenSync] ❌ 同步过程出错:', error);
  }
}

/**
 * 检查 token 是否存在
 */
export async function checkTokensExist(): Promise<{
  electronStorage: boolean;
  localStorage: boolean;
}> {
  const result = {
    electronStorage: false,
    localStorage: false
  };

  // 检查 Electron storage
  if (window.electron) {
    try {
      const tokens = await window.electron.storage.getTokens();
      result.electronStorage = !!(tokens?.authToken);
    } catch (error) {
      console.error('[TokenSync] 检查 Electron storage 失败:', error);
    }
  }

  // 检查 localStorage
  result.localStorage = !!(localStorage.getItem('auth_token'));

  console.log('[TokenSync] Token 存在状态:', result);
  return result;
}
