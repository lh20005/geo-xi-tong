import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export class DocumentParserService {
  /**
   * 解析文件并提取文本内容
   * @param file - Multer上传的文件对象
   * @returns 提取的文本内容
   */
  async parseFile(file: Express.Multer.File): Promise<string> {
    // 修复中文文件名编码问题
    const originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const extension = path.extname(originalname).toLowerCase();
    
    switch (extension) {
      case '.txt':
        return this.parseTxt(file);
      case '.md':
        return this.parseMarkdown(file);
      case '.pdf':
        return this.parsePdf(file);
      case '.doc':
      case '.docx':
        return this.parseWord(file);
      default:
        throw new Error(`不支持的文件格式: ${extension}。支持的格式: .txt, .md, .pdf, .doc, .docx`);
    }
  }

  /**
   * 解析纯文本文件
   */
  private async parseTxt(file: Express.Multer.File): Promise<string> {
    try {
      const content = fs.readFileSync(file.path, 'utf-8');
      return content.trim();
    } catch (error: any) {
      throw new Error(`解析TXT文件失败: ${error.message}`);
    }
  }

  /**
   * 解析Markdown文件
   */
  private async parseMarkdown(file: Express.Multer.File): Promise<string> {
    try {
      // Markdown文件本质上也是文本文件
      const content = fs.readFileSync(file.path, 'utf-8');
      return content.trim();
    } catch (error: any) {
      throw new Error(`解析Markdown文件失败: ${error.message}`);
    }
  }

  /**
   * 解析PDF文件
   */
  private async parsePdf(file: Express.Multer.File): Promise<string> {
    try {
      const dataBuffer = fs.readFileSync(file.path);
      const data = await pdfParse(dataBuffer);
      return data.text.trim();
    } catch (error: any) {
      throw new Error(`解析PDF文件失败: ${error.message}`);
    }
  }

  /**
   * 解析Word文档
   */
  private async parseWord(file: Express.Multer.File): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ path: file.path });
      return result.value.trim();
    } catch (error: any) {
      throw new Error(`解析Word文档失败: ${error.message}`);
    }
  }
}
