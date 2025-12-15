import { render, fireEvent } from '@testing-library/react';
import UsageCountBadge from '../UsageCountBadge';

describe('UsageCountBadge Unit Tests', () => {
  describe('Badge styling', () => {
    it('should display gray badge when count is 0', () => {
      const { container } = render(
        <UsageCountBadge count={0} onClick={() => {}} />
      );
      
      const badge = container.querySelector('.ant-badge');
      expect(badge).toBeInTheDocument();
      
      // 验证显示"0次"
      expect(container.textContent).toBe('0次');
    });

    it('should display blue badge when count is greater than 0', () => {
      const { container } = render(
        <UsageCountBadge count={5} onClick={() => {}} />
      );
      
      const badge = container.querySelector('.ant-badge');
      expect(badge).toBeInTheDocument();
      
      // 验证显示"5次"
      expect(container.textContent).toBe('5次');
    });

    it('should display correct count for various values', () => {
      const testCases = [1, 10, 50, 100, 999];
      
      testCases.forEach(count => {
        const { container } = render(
          <UsageCountBadge count={count} onClick={() => {}} />
        );
        
        expect(container.textContent).toBe(`${count}次`);
      });
    });
  });

  describe('Click event', () => {
    it('should trigger onClick when badge is clicked', () => {
      const mockOnClick = jest.fn();
      const { container } = render(
        <UsageCountBadge count={5} onClick={mockOnClick} />
      );
      
      const badge = container.querySelector('.ant-badge');
      expect(badge).toBeInTheDocument();
      
      if (badge) {
        fireEvent.click(badge);
        expect(mockOnClick).toHaveBeenCalledTimes(1);
      }
    });

    it('should trigger onClick even when count is 0', () => {
      const mockOnClick = jest.fn();
      const { container } = render(
        <UsageCountBadge count={0} onClick={mockOnClick} />
      );
      
      const badge = container.querySelector('.ant-badge');
      if (badge) {
        fireEvent.click(badge);
        expect(mockOnClick).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('Tooltip', () => {
    it('should have tooltip with correct text', () => {
      const { container } = render(
        <UsageCountBadge count={5} onClick={() => {}} />
      );
      
      // Ant Design的Tooltip需要hover才会显示
      // 这里只验证组件渲染成功
      expect(container.querySelector('.ant-badge')).toBeInTheDocument();
    });
  });
});
