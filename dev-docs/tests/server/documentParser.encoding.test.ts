import { DocumentParserService } from '../documentParser';
import fs from 'fs';
import path from 'path';

describe('DocumentParser - 中文文件名编码测试', () => {
  const parser = new DocumentParserService();
  const testDir = path.join(__dirname, 'test-files');

  beforeAll(() => {
    // 创建测试目录
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    // 清理测试文件
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it('应该正确处理中文文件名的txt文件', async () => {
    // 创建测试文件
    const testContent = '这是一个测试文件的内容';
    const testFilePath = path.join(testDir, 'test-chinese.txt');
    fs.writeFileSync(testFilePath, testContent, 'utf-8');

    // 模拟multer文件对象，文件名经过latin1编码（模拟乱码情况）
    const chineseFilename = '测试文档.txt';
    const encodedFilename = Buffer.from(chineseFilename, 'utf8').toString('latin1');
    
    const mockFile = {
      originalname: encodedFilename,
      path: testFilePath,
      size: Buffer.byteLength(testContent)
    } as Express.Multer.File;

    // 解析文件
    const content = await parser.parseFile(mockFile);
    
    // 验证内容正确解析
    expect(content).toBe(testContent);
  });

  it('应该正确处理中文文件名的md文件', async () => {
    // 创建测试文件
    const testContent = '# 中文标题\n\n这是Markdown内容';
    const testFilePath = path.join(testDir, 'test-chinese.md');
    fs.writeFileSync(testFilePath, testContent, 'utf-8');

    // 模拟multer文件对象
    const chineseFilename = '中文文档.md';
    const encodedFilename = Buffer.from(chineseFilename, 'utf8').toString('latin1');
    
    const mockFile = {
      originalname: encodedFilename,
      path: testFilePath,
      size: Buffer.byteLength(testContent)
    } as Express.Multer.File;

    // 解析文件
    const content = await parser.parseFile(mockFile);
    
    // 验证内容正确解析
    expect(content).toBe(testContent);
  });

  it('应该正确识别中文文件名的扩展名', async () => {
    // 创建测试文件
    const testContent = '测试内容';
    const testFilePath = path.join(testDir, 'test.txt');
    fs.writeFileSync(testFilePath, testContent, 'utf-8');

    // 模拟不支持的文件类型（中文文件名）
    const chineseFilename = '测试文档.xyz';
    const encodedFilename = Buffer.from(chineseFilename, 'utf8').toString('latin1');
    
    const mockFile = {
      originalname: encodedFilename,
      path: testFilePath,
      size: Buffer.byteLength(testContent)
    } as Express.Multer.File;

    // 应该抛出错误
    await expect(parser.parseFile(mockFile)).rejects.toThrow('不支持的文件格式');
  });
});
