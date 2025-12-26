import * as fc from 'fast-check';
import { render } from '@testing-library/react';
import UsageCountBadge from '../UsageCountBadge';

describe('UsageCountBadge Property Tests', () => {
  // Feature: distillation-usage-display-enhancement, Property 2: 使用次数格式化
  describe('Property 2: 使用次数格式化', () => {
    it('should always format count as "N次"', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 10000 }),
          (count) => {
            const { container } = render(
              <UsageCountBadge count={count} onClick={() => {}} />
            );
            
            // 验证显示格式为"N次"
            const text = container.textContent;
            expect(text).toBe(`${count}次`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle zero count correctly', () => {
      const { container } = render(
        <UsageCountBadge count={0} onClick={() => {}} />
      );
      
      expect(container.textContent).toBe('0次');
    });

    it('should handle large numbers correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 999999 }),
          (count) => {
            const { container } = render(
              <UsageCountBadge count={count} onClick={() => {}} />
            );
            
            expect(container.textContent).toBe(`${count}次`);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
