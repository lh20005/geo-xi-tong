// LocalStorage工具函数
const STORAGE_KEY = 'distillation_current_result';

export const saveResultToLocalStorage = (result: any) => {
  try {
    const dataToStore = {
      ...result,
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
  } catch (error) {
    console.error('保存到LocalStorage失败:', error);
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw new Error('存储空间不足，无法保存结果');
    }
  }
};

export const loadResultFromLocalStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('从LocalStorage加载失败:', error);
    localStorage.removeItem(STORAGE_KEY);
  }
  return null;
};

export const clearResultFromLocalStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('清除LocalStorage失败:', error);
  }
};
