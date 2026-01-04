#!/usr/bin/env node
import { pool } from '../db/database';

async function checkTables() {
  try {
    const result = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname='public' 
        AND (tablename LIKE '%gallery%' OR tablename LIKE '%image%' OR tablename LIKE '%document%' OR tablename LIKE '%article%')
      ORDER BY tablename
    `);
    
    console.log('Found tables:');
    result.rows.forEach(row => console.log('  -', row.tablename));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkTables();
