#!/usr/bin/env node
import { pool } from '../db/database';

async function checkColumns() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('images', 'knowledge_documents', 'articles')
      ORDER BY table_name, ordinal_position
    `);
    
    console.log('Table columns:');
    let currentTable = '';
    result.rows.forEach(row => {
      if (row.column_name.includes('size') || row.column_name.includes('content') || row.column_name.includes('user')) {
        if (currentTable !== row.table_name) {
          currentTable = row.table_name;
          console.log(`\n${row.table_name}:`);
        }
        console.log(`  - ${row.column_name} (${row.data_type})`);
      }
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkColumns();
