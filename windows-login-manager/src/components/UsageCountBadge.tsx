import React from 'react';
import { Badge, Tooltip } from 'antd';

interface UsageCountBadgeProps {
  count: number;
  onClick?: () => void;
}

/**
 * 使用次数徽章组件
 * Task 6.1: 创建UsageCountBadge组件
 * 
 * 功能：
 * - count为0时显示灰色Badge
 * - count大于0时显示蓝色Badge
 * - 格式化显示"N次"
 * - 支持点击事件
 * - 悬停显示提示
 */
const UsageCountBadge: React.FC<UsageCountBadgeProps> = ({ count, onClick }) => {
  // Feature: distillation-usage-display-enhancement, Property 2: 使用次数格式化
  const formatCount = (num: number): string => {
    return `${num}次`;
  };

  // const badgeColor = count === 0 ? 'default' : 'blue';
  const badgeText = formatCount(count);

  const badge = (
    <Badge
      count={badgeText}
      style={{
        backgroundColor: count === 0 ? '#d9d9d9' : '#1890ff',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    />
  );

  // 如果有点击事件，显示提示
  if (onClick) {
    return (
      <Tooltip title="点击查看使用历史">
        {badge}
      </Tooltip>
    );
  }

  return badge;
};

export default UsageCountBadge;
