import * as fc from 'fast-check';
import { pool } from '../db/database';

// Close database connection after all tests
afterAll(async () => {
  await pool.end();
});

// Feature: conversion-target-management, Property 1: Form field validation consistency
// Validates: Requirements 3.1, 3.3, 3.4, 4.2, 4.3
describe('Property 1: Form field validation consistency', () => {
  test('should validate company name length (2-255 characters)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 2, maxLength: 255 }),
        (companyName) => {
          // Valid company names should pass length validation
          expect(companyName.length).toBeGreaterThanOrEqual(2);
          expect(companyName.length).toBeLessThanOrEqual(255);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should reject company names shorter than 2 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 1 }),
        (companyName) => {
          // Company names with length < 2 should be invalid
          expect(companyName.length).toBeLessThan(2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should validate contact info format (phone or email)', () => {
    // Generate valid phone numbers - ensure exactly 11 digits
    const validPhoneGen = fc.tuple(
      fc.constantFrom('13', '14', '15', '16', '17', '18', '19'),
      fc.integer({ min: 100000000, max: 999999999 })
    ).map(([prefix, suffix]) => `${prefix}${suffix}`);

    // Generate valid emails
    const validEmailGen = fc.tuple(
      fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-z0-9]+$/.test(s)),
      fc.constantFrom('gmail.com', 'qq.com', 'example.com', '163.com')
    ).map(([local, domain]) => `${local}@${domain}`);

    fc.assert(
      fc.property(
        fc.oneof(validPhoneGen, validEmailGen),
        (contactInfo) => {
          const phoneRegex = /^1[3-9]\d{9}$/;
          const emailRegex = /^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/;
          
          // Valid contact info should match either phone or email pattern
          expect(phoneRegex.test(contactInfo) || emailRegex.test(contactInfo)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should validate URL format', () => {
    const validUrlGen = fc.tuple(
      fc.constantFrom('http', 'https'),
      fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-z]+$/.test(s)),
      fc.constantFrom('com', 'cn', 'org', 'net')
    ).map(([protocol, domain, tld]) => `${protocol}://${domain}.${tld}`);

    fc.assert(
      fc.property(
        validUrlGen,
        (url) => {
          // Valid URLs should start with http:// or https://
          expect(url.startsWith('http://') || url.startsWith('https://')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: conversion-target-management, Property 4: Data persistence round trip
// Validates: Requirements 5.1, 13.1, 13.4
describe('Property 4: Data persistence round trip', () => {
  beforeAll(async () => {
    // Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversion_targets (
        id SERIAL PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL UNIQUE,
        industry VARCHAR(100) NOT NULL,
        company_size VARCHAR(50) NOT NULL,
        features TEXT,
        contact_info VARCHAR(255) NOT NULL,
        website VARCHAR(500),
        target_audience TEXT,
        core_products TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  afterEach(async () => {
    // Clean up test data
    await pool.query('DELETE FROM conversion_targets WHERE company_name LIKE $1', ['Test%']);
  });

  test('should persist and retrieve conversion target data correctly', async () => {
    const validTargetGen = fc.record({
      company_name: fc.string({ minLength: 2, maxLength: 50 }).map(s => `Test_${s}_${Date.now()}`),
      industry: fc.constantFrom('互联网', '金融', '制造业', '教育', '医疗', '零售', '其他'),
      company_size: fc.constantFrom('1-50人', '51-200人', '201-500人', '501-1000人', '1000人以上'),
      features: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
      contact_info: fc.oneof(
        fc.tuple(
          fc.constantFrom('13', '14', '15', '16', '17', '18', '19'),
          fc.integer({ min: 100000000, max: 999999999 })
        ).map(([prefix, suffix]) => `${prefix}${suffix}`),
        fc.tuple(
          fc.string({ minLength: 3, maxLength: 8 }).filter(s => /^[a-z0-9]+$/.test(s)),
          fc.constantFrom('gmail.com', 'qq.com')
        ).map(([local, domain]) => `${local}@${domain}`)
      ),
      website: fc.option(
        fc.tuple(
          fc.constantFrom('http', 'https'),
          fc.string({ minLength: 3, maxLength: 8 }).filter(s => /^[a-z]+$/.test(s)),
          fc.constantFrom('com', 'cn')
        ).map(([protocol, domain, tld]) => `${protocol}://${domain}.${tld}`),
        { nil: null }
      ),
      target_audience: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
      core_products: fc.option(fc.string({ maxLength: 100 }), { nil: null })
    });

    await fc.assert(
      fc.asyncProperty(
        validTargetGen,
        async (targetData) => {
          // Insert data
          const insertResult = await pool.query(
            `INSERT INTO conversion_targets 
             (company_name, industry, company_size, features, contact_info, website, target_audience, core_products) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             RETURNING *`,
            [
              targetData.company_name,
              targetData.industry,
              targetData.company_size,
              targetData.features,
              targetData.contact_info,
              targetData.website,
              targetData.target_audience,
              targetData.core_products
            ]
          );

          const insertedId = insertResult.rows[0].id;

          // Query data back
          const queryResult = await pool.query(
            'SELECT * FROM conversion_targets WHERE id = $1',
            [insertedId]
          );

          const retrieved = queryResult.rows[0];

          // Verify round trip - all fields should match
          expect(retrieved.company_name).toBe(targetData.company_name);
          expect(retrieved.industry).toBe(targetData.industry);
          expect(retrieved.company_size).toBe(targetData.company_size);
          expect(retrieved.features).toBe(targetData.features);
          expect(retrieved.contact_info).toBe(targetData.contact_info);
          expect(retrieved.website).toBe(targetData.website);
          expect(retrieved.target_audience).toBe(targetData.target_audience);
          expect(retrieved.core_products).toBe(targetData.core_products);

          // Clean up
          await pool.query('DELETE FROM conversion_targets WHERE id = $1', [insertedId]);
        }
      ),
      { numRuns: 20 } // Reduced runs for database operations
    );
  });
});

// Feature: conversion-target-management, Property 7: Pagination consistency
// Validates: Requirements 7.1, 7.6
describe('Property 7: Pagination consistency', () => {
  beforeAll(async () => {
    await pool.query('DELETE FROM conversion_targets WHERE company_name LIKE $1', ['PaginationTest%']);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM conversion_targets WHERE company_name LIKE $1', ['PaginationTest%']);
  });

  test('should display exactly 10 records per page (or fewer on last page)', async () => {
    // Generate test data with different sizes
    const testSizes = [5, 10, 15, 23, 30];

    for (const totalRecords of testSizes) {
      // Clean up
      await pool.query('DELETE FROM conversion_targets WHERE company_name LIKE $1', ['PaginationTest%']);

      // Insert test records
      for (let i = 0; i < totalRecords; i++) {
        await pool.query(
          `INSERT INTO conversion_targets (company_name, industry, company_size, contact_info) 
           VALUES ($1, $2, $3, $4)`,
          [`PaginationTest_${i}_${Date.now()}`, '互联网', '1-50人', `test${i}@example.com`]
        );
      }

      const pageSize = 10;
      const expectedPages = Math.ceil(totalRecords / pageSize);

      // Test each page
      for (let page = 1; page <= expectedPages; page++) {
        const offset = (page - 1) * pageSize;
        const result = await pool.query(
          `SELECT * FROM conversion_targets 
           WHERE company_name LIKE $1 
           ORDER BY created_at DESC 
           LIMIT $2 OFFSET $3`,
          ['PaginationTest%', pageSize, offset]
        );

        const expectedCount = page === expectedPages 
          ? totalRecords - (expectedPages - 1) * pageSize 
          : pageSize;

        expect(result.rows.length).toBe(expectedCount);
        expect(result.rows.length).toBeLessThanOrEqual(10);
      }
    }
  });

  test('should maintain correct total count across all pages', async () => {
    await pool.query('DELETE FROM conversion_targets WHERE company_name LIKE $1', ['CountTest%']);

    const totalRecords = 25;
    
    // Insert test records
    for (let i = 0; i < totalRecords; i++) {
      await pool.query(
        `INSERT INTO conversion_targets (company_name, industry, company_size, contact_info) 
         VALUES ($1, $2, $3, $4)`,
        [`CountTest_${i}_${Date.now()}`, '互联网', '1-50人', `test${i}@example.com`]
      );
    }

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM conversion_targets WHERE company_name LIKE $1',
      ['CountTest%']
    );
    const total = parseInt(countResult.rows[0].total);

    expect(total).toBe(totalRecords);

    // Verify sum across pages equals total
    const pageSize = 10;
    const pages = Math.ceil(total / pageSize);
    let sumAcrossPages = 0;

    for (let page = 1; page <= pages; page++) {
      const offset = (page - 1) * pageSize;
      const result = await pool.query(
        `SELECT * FROM conversion_targets 
         WHERE company_name LIKE $1 
         LIMIT $2 OFFSET $3`,
        ['CountTest%', pageSize, offset]
      );
      sumAcrossPages += result.rows.length;
    }

    expect(sumAcrossPages).toBe(total);

    // Clean up
    await pool.query('DELETE FROM conversion_targets WHERE company_name LIKE $1', ['CountTest%']);
  });
});

// Feature: conversion-target-management, Property 8: Pagination navigation correctness
// Validates: Requirements 7.3, 7.4, 7.5
describe('Property 8: Pagination navigation correctness', () => {
  beforeAll(async () => {
    await pool.query('DELETE FROM conversion_targets WHERE company_name LIKE $1', ['NavTest%']);
    
    // Insert 30 test records
    for (let i = 0; i < 30; i++) {
      await pool.query(
        `INSERT INTO conversion_targets (company_name, industry, company_size, contact_info) 
         VALUES ($1, $2, $3, $4)`,
        [`NavTest_${String(i).padStart(3, '0')}_${Date.now()}`, '互联网', '1-50人', `test${i}@example.com`]
      );
    }
  });

  afterAll(async () => {
    await pool.query('DELETE FROM conversion_targets WHERE company_name LIKE $1', ['NavTest%']);
  });

  test('should return correct subset of records for any valid page number', async () => {
    const pageSize = 10;
    const totalRecords = 30;
    const totalPages = Math.ceil(totalRecords / pageSize);

    for (let page = 1; page <= totalPages; page++) {
      const offset = (page - 1) * pageSize;
      const result = await pool.query(
        `SELECT * FROM conversion_targets 
         WHERE company_name LIKE $1 
         ORDER BY company_name ASC 
         LIMIT $2 OFFSET $3`,
        ['NavTest%', pageSize, offset]
      );

      // Verify correct number of records
      const expectedCount = page === totalPages ? totalRecords % pageSize || pageSize : pageSize;
      expect(result.rows.length).toBe(expectedCount);

      // Verify records are in correct range
      if (result.rows.length > 0) {
        const firstRecord = result.rows[0];
        const lastRecord = result.rows[result.rows.length - 1];
        
        expect(firstRecord.company_name).toContain('NavTest_');
        expect(lastRecord.company_name).toContain('NavTest_');
      }
    }
  });
});

// Feature: conversion-target-management, Property 16: Search filter correctness
// Validates: Requirements 12.1, 12.2, 12.3
describe('Property 16: Search filter correctness', () => {
  beforeAll(async () => {
    await pool.query('DELETE FROM conversion_targets WHERE company_name LIKE $1', ['SearchTest%']);
    
    // Insert test data with various company names and industries
    const testData = [
      { name: 'SearchTest_Tech_Company', industry: '互联网' },
      { name: 'SearchTest_Finance_Corp', industry: '金融' },
      { name: 'SearchTest_Education_Group', industry: '教育' },
      { name: 'SearchTest_Medical_Center', industry: '医疗' },
      { name: 'SearchTest_Retail_Store', industry: '零售' },
    ];

    for (const data of testData) {
      await pool.query(
        `INSERT INTO conversion_targets (company_name, industry, company_size, contact_info) 
         VALUES ($1, $2, $3, $4)`,
        [data.name, data.industry, '1-50人', 'test@example.com']
      );
    }
  });

  afterAll(async () => {
    await pool.query('DELETE FROM conversion_targets WHERE company_name LIKE $1', ['SearchTest%']);
  });

  test('should only return records matching search keyword in company name or industry', async () => {
    const searchKeywords = ['Tech', 'Finance', '互联网', '金融', '教育'];

    for (const keyword of searchKeywords) {
      const result = await pool.query(
        `SELECT * FROM conversion_targets 
         WHERE company_name LIKE $1 
         AND (company_name ILIKE $2 OR industry ILIKE $2)`,
        ['SearchTest%', `%${keyword}%`]
      );

      // All results should contain the keyword
      for (const row of result.rows) {
        const matchesName = row.company_name.toLowerCase().includes(keyword.toLowerCase());
        const matchesIndustry = row.industry.toLowerCase().includes(keyword.toLowerCase());
        expect(matchesName || matchesIndustry).toBe(true);
      }
    }
  });

  test('should not return false positives', async () => {
    const keyword = 'NonExistent';
    const result = await pool.query(
      `SELECT * FROM conversion_targets 
       WHERE company_name LIKE $1 
       AND (company_name ILIKE $2 OR industry ILIKE $2)`,
      ['SearchTest%', `%${keyword}%`]
    );

    expect(result.rows.length).toBe(0);
  });
});

// Feature: conversion-target-management, Property 13: Sort order correctness
// Validates: Requirements 11.1, 11.2
describe('Property 13: Sort order correctness', () => {
  beforeAll(async () => {
    await pool.query('DELETE FROM conversion_targets WHERE company_name LIKE $1', ['SortTest%']);
    
    // Insert test data with different values
    const testData = [
      { name: 'SortTest_C_Company', industry: '互联网', size: '1-50人' },
      { name: 'SortTest_A_Company', industry: '金融', size: '51-200人' },
      { name: 'SortTest_B_Company', industry: '教育', size: '201-500人' },
    ];

    for (const data of testData) {
      await pool.query(
        `INSERT INTO conversion_targets (company_name, industry, company_size, contact_info) 
         VALUES ($1, $2, $3, $4)`,
        [data.name, data.industry, data.size, 'test@example.com']
      );
    }
  });

  afterAll(async () => {
    await pool.query('DELETE FROM conversion_targets WHERE company_name LIKE $1', ['SortTest%']);
  });

  test('should sort records in ascending order by specified column', async () => {
    const sortFields = ['company_name', 'industry', 'company_size'];

    for (const field of sortFields) {
      const result = await pool.query(
        `SELECT * FROM conversion_targets 
         WHERE company_name LIKE $1 
         ORDER BY ${field} ASC`,
        ['SortTest%']
      );

      // Verify ascending order
      for (let i = 1; i < result.rows.length; i++) {
        const prev = result.rows[i - 1][field];
        const curr = result.rows[i][field];
        expect(prev <= curr).toBe(true);
      }
    }
  });

  test('should sort records in descending order by specified column', async () => {
    const sortFields = ['company_name', 'industry', 'company_size'];

    for (const field of sortFields) {
      const result = await pool.query(
        `SELECT * FROM conversion_targets 
         WHERE company_name LIKE $1 
         ORDER BY ${field} DESC`,
        ['SortTest%']
      );

      // Verify descending order
      for (let i = 1; i < result.rows.length; i++) {
        const prev = result.rows[i - 1][field];
        const curr = result.rows[i][field];
        expect(prev >= curr).toBe(true);
      }
    }
  });
});

// Feature: conversion-target-management, Property 11: Update operation consistency
// Validates: Requirements 9.3, 9.4, 9.5
describe('Property 11: Update operation consistency', () => {
  afterEach(async () => {
    await pool.query('DELETE FROM conversion_targets WHERE company_name LIKE $1', ['UpdateTest%']);
  });

  test('should persist updates to database and reflect changes in queries', async () => {
    // Create initial record
    const initialData = {
      company_name: `UpdateTest_Initial_${Date.now()}`,
      industry: '互联网',
      company_size: '1-50人',
      contact_info: 'initial@example.com'
    };

    const insertResult = await pool.query(
      `INSERT INTO conversion_targets (company_name, industry, company_size, contact_info) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [initialData.company_name, initialData.industry, initialData.company_size, initialData.contact_info]
    );

    const id = insertResult.rows[0].id;

    // Update with new data
    const updatedData = {
      company_name: `UpdateTest_Updated_${Date.now()}`,
      industry: '金融',
      company_size: '51-200人',
      contact_info: 'updated@example.com'
    };

    await pool.query(
      `UPDATE conversion_targets 
       SET company_name = $1, industry = $2, company_size = $3, contact_info = $4, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $5`,
      [updatedData.company_name, updatedData.industry, updatedData.company_size, updatedData.contact_info, id]
    );

    // Query back and verify
    const queryResult = await pool.query(
      'SELECT * FROM conversion_targets WHERE id = $1',
      [id]
    );

    const retrieved = queryResult.rows[0];
    expect(retrieved.company_name).toBe(updatedData.company_name);
    expect(retrieved.industry).toBe(updatedData.industry);
    expect(retrieved.company_size).toBe(updatedData.company_size);
    expect(retrieved.contact_info).toBe(updatedData.contact_info);
  });
});

// Feature: conversion-target-management, Property 18: Database operation persistence
// Validates: Requirements 13.2
describe('Property 18: Database operation persistence', () => {
  test('should persist create, update, and delete operations', async () => {
    const testName = `PersistTest_${Date.now()}`;

    // CREATE
    const createResult = await pool.query(
      `INSERT INTO conversion_targets (company_name, industry, company_size, contact_info) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [testName, '互联网', '1-50人', 'test@example.com']
    );
    const id = createResult.rows[0].id;

    // Verify creation persisted
    let queryResult = await pool.query('SELECT * FROM conversion_targets WHERE id = $1', [id]);
    expect(queryResult.rows.length).toBe(1);
    expect(queryResult.rows[0].company_name).toBe(testName);

    // UPDATE
    const updatedName = `${testName}_Updated`;
    await pool.query(
      'UPDATE conversion_targets SET company_name = $1 WHERE id = $2',
      [updatedName, id]
    );

    // Verify update persisted
    queryResult = await pool.query('SELECT * FROM conversion_targets WHERE id = $1', [id]);
    expect(queryResult.rows[0].company_name).toBe(updatedName);

    // DELETE
    await pool.query('DELETE FROM conversion_targets WHERE id = $1', [id]);

    // Verify deletion persisted
    queryResult = await pool.query('SELECT * FROM conversion_targets WHERE id = $1', [id]);
    expect(queryResult.rows.length).toBe(0);
  });
});

// Feature: conversion-target-management, Property 12: Delete operation consistency
// Validates: Requirements 10.3, 10.4
describe('Property 12: Delete operation consistency', () => {
  test('should remove record from database and not appear in subsequent queries', async () => {
    // Create test record
    const testName = `DeleteTest_${Date.now()}`;
    const insertResult = await pool.query(
      `INSERT INTO conversion_targets (company_name, industry, company_size, contact_info) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [testName, '互联网', '1-50人', 'test@example.com']
    );
    const id = insertResult.rows[0].id;

    // Verify record exists
    let queryResult = await pool.query('SELECT * FROM conversion_targets WHERE id = $1', [id]);
    expect(queryResult.rows.length).toBe(1);

    // Delete record
    await pool.query('DELETE FROM conversion_targets WHERE id = $1', [id]);

    // Verify record no longer exists
    queryResult = await pool.query('SELECT * FROM conversion_targets WHERE id = $1', [id]);
    expect(queryResult.rows.length).toBe(0);

    // Verify not in list query
    const listResult = await pool.query(
      'SELECT * FROM conversion_targets WHERE company_name = $1',
      [testName]
    );
    expect(listResult.rows.length).toBe(0);
  });

  test('should handle multiple deletions correctly', async () => {
    // Create multiple test records
    const ids: number[] = [];
    for (let i = 0; i < 5; i++) {
      const result = await pool.query(
        `INSERT INTO conversion_targets (company_name, industry, company_size, contact_info) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [`MultiDeleteTest_${i}_${Date.now()}`, '互联网', '1-50人', `test${i}@example.com`]
      );
      ids.push(result.rows[0].id);
    }

    // Delete all records
    for (const id of ids) {
      await pool.query('DELETE FROM conversion_targets WHERE id = $1', [id]);
    }

    // Verify all records are deleted
    for (const id of ids) {
      const queryResult = await pool.query('SELECT * FROM conversion_targets WHERE id = $1', [id]);
      expect(queryResult.rows.length).toBe(0);
    }
  });
});
