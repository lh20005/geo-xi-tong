import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Table } from 'antd';
import type { TableProps, ColumnsType } from 'antd/es/table';
import { Resizable, ResizeCallbackData } from 'react-resizable';
import 'react-resizable/css/styles.css';
import './ResizableTable.css';

// 阻尼系数：值越小，拖拽越慢（0.3 = 30% 的移动速度）
const DAMPING_FACTOR = 0.4;

// 可调整大小的表头单元格
interface ResizableTitleProps extends React.HTMLAttributes<HTMLTableCellElement> {
  onResize: (e: React.SyntheticEvent, data: ResizeCallbackData) => void;
  width: number;
  minWidth?: number;
}

const ResizableTitle: React.FC<ResizableTitleProps> = (props) => {
  const { onResize, width, minWidth = 30, ...restProps } = props; // 默认最小30px
  const lastWidthRef = useRef(width);
  const accumulatedDeltaRef = useRef(0);

  // 重置累积值当宽度从外部改变时
  useEffect(() => {
    lastWidthRef.current = width;
    accumulatedDeltaRef.current = 0;
  }, [width]);

  if (!width) {
    return <th {...restProps} />;
  }

  // 带阻尼的 resize 处理
  const handleDampedResize = (e: React.SyntheticEvent, data: ResizeCallbackData) => {
    const rawDelta = data.size.width - lastWidthRef.current;
    
    // 应用阻尼：累积变化量
    accumulatedDeltaRef.current += rawDelta * DAMPING_FACTOR;
    
    // 只有当累积变化超过 1px 时才更新
    if (Math.abs(accumulatedDeltaRef.current) >= 1) {
      const dampedWidth = lastWidthRef.current + accumulatedDeltaRef.current;
      lastWidthRef.current = dampedWidth;
      accumulatedDeltaRef.current = 0;
      
      // 调用原始的 onResize，传入阻尼后的宽度
      onResize(e, {
        ...data,
        size: { ...data.size, width: dampedWidth }
      });
    }
  };

  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="react-resizable-handle"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            right: -5,
            bottom: 0,
            width: 10,
            height: '100%',
            cursor: 'col-resize',
            zIndex: 1,
            // 隐藏手柄的视觉样式，仅保留功能
            background: 'transparent',
          }}
        />
      }
      onResize={handleDampedResize}
      draggableOpts={{ enableUserSelectHack: false }}
      minConstraints={[minWidth, 0]}
    >
      <th {...restProps} />
    </Resizable>
  );
};

// 列宽存储版本号 - 当需要重置所有用户的列宽时，增加此版本号
const COLUMN_WIDTH_VERSION = 3;

// 存储列宽的工具函数
const getStoredColumnWidths = (tableId: string): Record<string, number> => {
  try {
    // 检查版本号
    const storedVersion = localStorage.getItem('table_column_widths_version');
    if (storedVersion !== String(COLUMN_WIDTH_VERSION)) {
      // 版本不匹配，清除所有旧的列宽数据
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('table_column_widths_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      localStorage.setItem('table_column_widths_version', String(COLUMN_WIDTH_VERSION));
      return {};
    }
    
    const stored = localStorage.getItem(`table_column_widths_${tableId}`);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const setStoredColumnWidths = (tableId: string, widths: Record<string, number>) => {
  try {
    localStorage.setItem(`table_column_widths_${tableId}`, JSON.stringify(widths));
  } catch {
    // 忽略存储错误
  }
};

// ResizableTable 组件的 Props
export interface ResizableTableProps<T> extends Omit<TableProps<T>, 'columns'> {
  tableId: string; // 用于 localStorage 存储的唯一标识
  columns: ColumnsType<T>;
  minColumnWidth?: number; // 最小列宽，默认 50
}

function ResizableTable<T extends object>({
  tableId,
  columns: initialColumns,
  minColumnWidth = 50,
  ...tableProps
}: ResizableTableProps<T>) {
  // 初始化列宽（从 localStorage 读取或使用默认值）
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const stored = getStoredColumnWidths(tableId);
    const initial: Record<string, number> = {};
    
    initialColumns.forEach((col: any) => {
      const key = col.key || col.dataIndex;
      if (key) {
        const definedWidth = col.width || 150;
        const storedWidth = stored[key];
        // 使用存储的宽度，但确保不小于列定义的宽度
        // 这样可以防止之前保存的较小宽度导致内容被截断
        initial[key] = storedWidth ? Math.max(storedWidth, definedWidth) : definedWidth;
      }
    });
    
    return initial;
  });

  // 当 tableId 变化时重新加载存储的列宽
  // 注意：不依赖 initialColumns，避免数据刷新时重置列宽
  useEffect(() => {
    const stored = getStoredColumnWidths(tableId);
    const newWidths: Record<string, number> = {};
    
    initialColumns.forEach((col: any) => {
      const key = col.key || col.dataIndex;
      if (key) {
        const definedWidth = col.width || 150;
        const storedWidth = stored[key];
        // 使用存储的宽度，但确保不小于列定义的宽度
        newWidths[key] = storedWidth ? Math.max(storedWidth, definedWidth) : definedWidth;
      }
    });
    
    setColumnWidths(newWidths);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]); // 只依赖 tableId，不依赖 initialColumns

  // 获取列定义的宽度
  const getColumnDefinedWidth = useCallback((key: string): number => {
    const col = initialColumns.find((c: any) => (c.key || c.dataIndex) === key);
    return (col as any)?.width || 150;
  }, [initialColumns]);

  // 处理列宽调整
  const handleResize = useCallback(
    (key: string) =>
      (_: React.SyntheticEvent, { size }: ResizeCallbackData) => {
        const definedWidth = getColumnDefinedWidth(key);
        setColumnWidths((prev) => {
          const newWidths = {
            ...prev,
            // 使用列定义的宽度作为最小值，防止列被拖得太小
            [key]: Math.max(size.width, definedWidth),
          };
          // 保存到 localStorage
          setStoredColumnWidths(tableId, newWidths);
          return newWidths;
        });
      },
    [tableId, getColumnDefinedWidth]
  );

  // 构建带有调整后宽度的列配置
  const resizableColumns = initialColumns.map((col: any) => {
    const key = col.key || col.dataIndex;
    const definedWidth = col.width || 150;
    const width = key ? (columnWidths[key] || definedWidth) : definedWidth;

    // fixed 列也支持拖拽
    return {
      ...col,
      width,
      onHeaderCell: () => ({
        width,
        onResize: key ? handleResize(key) : undefined,
        minWidth: definedWidth, // 使用列定义的宽度作为最小值
      }),
    };
  });

  // 计算所有列的总宽度
  const totalWidth = resizableColumns.reduce((sum: number, col: any) => {
    return sum + (col.width || 150);
  }, 0);

  // 如果有 rowSelection，加上选择列的宽度
  const selectionColumnWidth = 50;
  const finalTotalWidth = tableProps.rowSelection ? totalWidth + selectionColumnWidth : totalWidth;

  // 获取原始的 scroll.x 设置
  const originalScrollX = tableProps.scroll?.x;
  // 使用计算出的总宽度和原始设置中的较大值
  const scrollX = typeof originalScrollX === 'number' 
    ? Math.max(finalTotalWidth, originalScrollX)
    : finalTotalWidth;

  // 处理 rowSelection 的选择列宽度
  const enhancedTableProps = {
    ...tableProps,
    rowSelection: tableProps.rowSelection ? {
      ...tableProps.rowSelection,
      columnWidth: selectionColumnWidth,
    } : undefined,
    // 使用计算出的总宽度作为 scroll.x
    scroll: {
      ...tableProps.scroll,
      x: scrollX,
    },
  };

  // 自定义表格组件
  const components = {
    header: {
      cell: ResizableTitle,
    },
  };

  return (
    <Table<T>
      {...enhancedTableProps}
      columns={resizableColumns}
      components={components}
      bordered
      tableLayout="fixed"
    />
  );
}

export default ResizableTable;
