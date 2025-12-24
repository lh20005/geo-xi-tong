/**
 * 日期时间格式化工具函数
 */

/**
 * 格式化日期时间为 YYYY-MM-DD HH:mm:ss
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  
  try {
    const d = new Date(date);
    
    // 检查日期是否有效
    if (isNaN(d.getTime())) {
      return '-';
    }
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error('日期格式化错误:', error);
    return '-';
  }
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  
  try {
    const d = new Date(date);
    
    // 检查日期是否有效
    if (isNaN(d.getTime())) {
      return '-';
    }
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('日期格式化错误:', error);
    return '-';
  }
}

/**
 * 格式化为相对时间（如：刚刚、5分钟前、2小时前、3天前）
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  
  try {
    const d = new Date(date);
    
    // 检查日期是否有效
    if (isNaN(d.getTime())) {
      return '-';
    }
    
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    
    if (seconds < 60) {
      return '刚刚';
    } else if (minutes < 60) {
      return `${minutes}分钟前`;
    } else if (hours < 24) {
      return `${hours}小时前`;
    } else if (days < 30) {
      return `${days}天前`;
    } else if (months < 12) {
      return `${months}个月前`;
    } else {
      return `${years}年前`;
    }
  } catch (error) {
    console.error('相对时间格式化错误:', error);
    return '-';
  }
}

/**
 * 格式化为友好的日期时间（今天显示时间，昨天显示"昨天"，更早显示日期）
 */
export function formatFriendlyDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  
  try {
    const d = new Date(date);
    
    // 检查日期是否有效
    if (isNaN(d.getTime())) {
      return '-';
    }
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;
    
    if (dateOnly.getTime() === today.getTime()) {
      return `今天 ${timeStr}`;
    } else if (dateOnly.getTime() === yesterday.getTime()) {
      return `昨天 ${timeStr}`;
    } else {
      return formatDate(d);
    }
  } catch (error) {
    console.error('友好日期时间格式化错误:', error);
    return '-';
  }
}
