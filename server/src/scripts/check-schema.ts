#!/usr/bin/env node
import { pool } from '../db/database';

async function checkSchema() {
  try {
    console.log('\n=== IMAGES TABLE ===');
    const imagesResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'images'
      ORDER BY ordinal_position
    `);
    imagesResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });

    console.log('\n=== KNOWLEDGE_DOCUMENTS TABLE ===');
    const docsResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'knowledge_documents'
      ORDER BY ordinal_position
    `);
    docsResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });

    console.log('\n=== ARTICLES TABLE ===');
    const articlesResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'articles'
      ORDER BY ordinal_position
    `);
    articlesResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkSchema();
