import fc from 'fast-check';
import fs from 'fs';
import path from 'path';
import { DocumentParserService } from './documentParser';

/**
 * Feature: enterprise-knowledge-base, Property 10: 支持格式的完整性
 * 验证: 需求 5.1, 5.2, 5.3, 5.4
 * 
 * 对于任何支持的文件格式（.txt, .md, .pdf, .doc, .docx），
 * 系统应该能够成功提取文本内容而不抛出错误。
 */

describe('DocumentParserService - Property Tests', () => {
  const parser = new DocumentParserService();
  const testDir = path.join(__dirname, '../../test-files');

  beforeAll(() => {
    // 创建测试文件目录
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    // 清理测试文件
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  // 辅助函数：创建测试文件
  const createTestFile = (content: string, extension: string): Express.Multer.File => {
    const filename = `test-${Date.now()}-${Math.random()}${extension}`;
    const filepath = path.join(testDir, filename);
    
    fs.writeFileSync(filepath, content, 'utf-8');
    
    return {
      fieldname: 'file',
      originalname: filename,
      encoding: '7bit',
      mimetype: 'text/plain',
      destination: testDir,
      filename: filename,
      path: filepath,
      size: Buffer.byteLength(content),
      stream: null as any,
      buffer: Buffer.from(content)
    };
  };

  test('Property 10: 支持格式的完整性 - TXT文件', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 1000 }),
        async (content) => {
          const file = createTestFile(content, '.txt');
          try {
            const result = await parser.parseFile(file);
            return result.length > 0 && typeof result === 'string';
          } finally {
            // 清理文件
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 10: 支持格式的完整性 - Markdown文件', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 1000 }),
        async (content) => {
          const file = createTestFile(`# Title\n\n${content}`, '.md');
          try {
            const result = await parser.parseFile(file);
            return result.length > 0 && typeof result === 'string';
          } finally {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('不支持的格式应该抛出错误', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('.exe', '.zip', '.jpg', '.mp3', '.avi', '.mp4'),
        async (extension) => {
          const file = createTestFile('test content', extension);
          try {
            await parser.parseFile(file);
            return false; // 不应该执行到这里
          } catch (error: any) {
            return error.message.includes('不支持的文件格式');
          } finally {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
