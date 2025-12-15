import { pool } from './src/db/database';

async function test() {
  try {
    const albums = await pool.query('SELECT * FROM albums');
    console.log('相册数量:', albums.rows.length);
    console.log('相册:', albums.rows);
    
    const images = await pool.query('SELECT * FROM images');
    console.log('图片数量:', images.rows.length);
    console.log('图片:', images.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

test();
