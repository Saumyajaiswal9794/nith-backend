const express = require('express');
const router = express.Router();
const db = require('../../db/db');

// Helper: ensure env is correct for DATABASE_URL
const fs = require('fs');
const path = require('path');
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  const envContent = fs.readFileSync(path.resolve(__dirname, '../../../.env'), 'utf8');
  const match = envContent.match(/DATABASE_URL=["']?(.*?)["']?(?:\s*$|\s*#)/m);
  if (match) process.env.DATABASE_URL = match[1];
}

// ── GET /api/v1/departments  →  list all with counts ──
router.get('/', async (req, res) => {
  try {
    const listRes = await db.query('SELECT * FROM departments ORDER BY id ASC');
    const countRes = await db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active,
        COUNT(*) FILTER (WHERE status = 'inactive')::int AS inactive
      FROM departments
    `);
    res.json({
      success: true,
      data: listRes.rows,
      counts: countRes.rows[0],
    });
  } catch (error) {
    console.error('GET /departments error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch departments' });
  }
});

// ── GET /api/v1/departments/:id  →  full department record with all sections ──
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deptRes = await db.query('SELECT * FROM departments WHERE id = $1', [id]);
    if (deptRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Department not found' });
    }
    const dept = deptRes.rows[0];

    // Fetch all sections in parallel
    const [overview, mission, programmes, research, faculty, labs, contact, media, staff] = await Promise.all([
      db.query('SELECT * FROM dept_overview WHERE department_id = $1', [id]).then(r => r.rows[0] || null),
      db.query('SELECT * FROM dept_mission WHERE department_id = $1', [id]).then(r => r.rows[0] || null),
      db.query('SELECT * FROM dept_programmes WHERE department_id = $1', [id]).then(r => r.rows[0] || null),
      db.query('SELECT * FROM dept_research WHERE department_id = $1', [id]).then(r => r.rows[0] || null),
      db.query('SELECT * FROM dept_faculty WHERE department_id = $1 ORDER BY sort_order ASC', [id]).then(r => r.rows),
      db.query('SELECT * FROM dept_labs WHERE department_id = $1 ORDER BY sort_order ASC', [id]).then(r => r.rows),
      db.query('SELECT * FROM dept_contact WHERE department_id = $1', [id]).then(r => r.rows[0] || null),
      db.query('SELECT * FROM dept_media WHERE department_id = $1 ORDER BY sort_order ASC', [id]).then(r => r.rows),
      db.query('SELECT * FROM dept_staff WHERE department_id = $1 ORDER BY sort_order ASC', [id]).then(r => r.rows),
    ]);

    res.json({
      success: true,
      data: {
        ...dept,
        overview,
        mission,
        programmes,
        research,
        faculty,
        labs,
        contact,
        media,
        staff,
      },
    });
  } catch (error) {
    console.error('GET /departments/:id error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch department' });
  }
});

// ── GET /api/v1/departments/slug/:slug  →  by slug (for public site) ──
router.get('/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const deptRes = await db.query('SELECT * FROM departments WHERE slug = $1 AND status = $2', [slug, 'active']);
    if (deptRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Department not found' });
    }
    // Reuse the full fetch logic
    req.params.id = String(deptRes.rows[0].id);
    // Fetch all sections
    const id = deptRes.rows[0].id;
    const dept = deptRes.rows[0];
    const [overview, mission, programmes, research, faculty, labs, contact, media, staff] = await Promise.all([
      db.query('SELECT * FROM dept_overview WHERE department_id = $1', [id]).then(r => r.rows[0] || null),
      db.query('SELECT * FROM dept_mission WHERE department_id = $1', [id]).then(r => r.rows[0] || null),
      db.query('SELECT * FROM dept_programmes WHERE department_id = $1', [id]).then(r => r.rows[0] || null),
      db.query('SELECT * FROM dept_research WHERE department_id = $1', [id]).then(r => r.rows[0] || null),
      db.query('SELECT * FROM dept_faculty WHERE department_id = $1 ORDER BY sort_order ASC', [id]).then(r => r.rows),
      db.query('SELECT * FROM dept_labs WHERE department_id = $1 ORDER BY sort_order ASC', [id]).then(r => r.rows),
      db.query('SELECT * FROM dept_contact WHERE department_id = $1', [id]).then(r => r.rows[0] || null),
      db.query('SELECT * FROM dept_media WHERE department_id = $1 ORDER BY sort_order ASC', [id]).then(r => r.rows),
      db.query('SELECT * FROM dept_staff WHERE department_id = $1 ORDER BY sort_order ASC', [id]).then(r => r.rows),
    ]);
    res.json({
      success: true,
      data: { ...dept, overview, mission, programmes, research, faculty, labs, contact, media, staff },
    });
  } catch (error) {
    console.error('GET /departments/slug/:slug error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch department by slug' });
  }
});

// ── POST /api/v1/departments  →  create new department ──
router.post('/', async (req, res) => {
  try {
    const { code, slug, name_en, name_hi, short_description_en, short_description_hi, image_url, status } = req.body;
    if (!code || !slug || !name_en) {
      return res.status(400).json({ success: false, error: 'code, slug, and name_en are required' });
    }
    // Check uniqueness
    const dupCode = await db.query('SELECT id FROM departments WHERE code = $1', [code]);
    if (dupCode.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Department code already exists' });
    }
    const dupSlug = await db.query('SELECT id FROM departments WHERE slug = $1', [slug]);
    if (dupSlug.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Department slug already exists' });
    }
    const result = await db.query(
      `INSERT INTO departments (code, slug, name_en, name_hi, short_description_en, short_description_hi, image_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [code, slug, name_en, name_hi || null, short_description_en || null, short_description_hi || null, image_url || null, status || 'active']
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('POST /departments error:', error);
    res.status(500).json({ success: false, error: 'Failed to create department' });
  }
});

// ── PUT /api/v1/departments/:id  →  update department (any subset of fields) ──
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['code', 'slug', 'name_en', 'name_hi', 'short_description_en', 'short_description_hi', 'image_url', 'status'];
    const keys = Object.keys(req.body).filter(k => allowed.includes(k));
    if (keys.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }
    // If code/slug are being changed, check uniqueness
    if (req.body.code) {
      const dup = await db.query('SELECT id FROM departments WHERE code = $1 AND id != $2', [req.body.code, id]);
      if (dup.rows.length > 0) return res.status(409).json({ success: false, error: 'Department code already exists' });
    }
    if (req.body.slug) {
      const dup = await db.query('SELECT id FROM departments WHERE slug = $1 AND id != $2', [req.body.slug, id]);
      if (dup.rows.length > 0) return res.status(409).json({ success: false, error: 'Department slug already exists' });
    }
    const setStr = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const vals = keys.map(k => req.body[k]);
    vals.push(id);
    const result = await db.query(
      `UPDATE departments SET ${setStr}, updated_at = CURRENT_TIMESTAMP WHERE id = $${vals.length} RETURNING *`,
      vals
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Department not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('PUT /departments/:id error:', error);
    res.status(500).json({ success: false, error: 'Failed to update department' });
  }
});

// ── DELETE /api/v1/departments/:id  →  delete department (cascade) ──
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM departments WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Department not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('DELETE /departments/:id error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete department' });
  }
});

// ══════════════════════════════════════════════════════════════════════
// SECTION-SPECIFIC ENDPOINTS  PUT /api/v1/departments/:id/sections/:sectionName
// ══════════════════════════════════════════════════════════════════════

const SECTION_TABLES = {
  overview:   { table: 'dept_overview',   hasItems: false },
  mission:    { table: 'dept_mission',    hasItems: false },
  programmes: { table: 'dept_programmes', hasItems: false },
  research:   { table: 'dept_research',   hasItems: false },
  contact:    { table: 'dept_contact',    hasItems: false },
  faculty:    { table: 'dept_faculty',    hasItems: true },
  labs:       { table: 'dept_labs',       hasItems: true },
  media:      { table: 'dept_media',      hasItems: true },
  staff:      { table: 'dept_staff',      hasItems: true },
};

// For list-type sections: add a single item
const SECTION_ITEM_FIELDS = {
  faculty: ['group_title_en', 'group_title_hi', 'name_en', 'name_hi', 'designation_en', 'designation_hi', 'interests_en', 'interests_hi', 'email', 'photo_url', 'sort_order', 'is_featured'],
  labs:    ['name_en', 'name_hi', 'description_en', 'description_hi', 'group_label_en', 'group_label_hi', 'sort_order'],
  media:   ['title_en', 'title_hi', 'description_en', 'description_hi', 'image_url', 'type', 'sort_order'],
  staff:   ['staff_type', 'name_en', 'name_hi', 'designation_en', 'designation_hi', 'phone', 'email', 'sort_order'],
};

// PUT /api/v1/departments/:id/sections/:sectionName  →  upsert section
router.put('/:id/sections/:sectionName', async (req, res) => {
  try {
    const { id, sectionName } = req.params;
    const section = SECTION_TABLES[sectionName];
    if (!section) {
      return res.status(400).json({ success: false, error: `Invalid section: ${sectionName}` });
    }
    // Verify department exists
    const deptCheck = await db.query('SELECT id FROM departments WHERE id = $1', [id]);
    if (deptCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Department not found' });
    }

    if (section.hasItems) {
      // For list-type sections, the body can contain `items` array for bulk replace,
      // or individual fields for adding a single item
      if (req.body.items && Array.isArray(req.body.items)) {
        // Bulk replace: delete existing and insert all
        await db.query(`DELETE FROM ${section.table} WHERE department_id = $1`, [id]);
        if (req.body.items.length > 0) {
          const allowedFields = SECTION_ITEM_FIELDS[sectionName];
          for (const item of req.body.items) {
            const keys = allowedFields.filter(f => item[f] !== undefined);
            if (keys.length === 0) continue;
            const cols = ['department_id', ...keys];
            const placeholders = cols.map((_, i) => `$${i + 1}`);
            const vals = [id, ...keys.map(k => item[k])];
            await db.query(
              `INSERT INTO ${section.table} (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
              vals
            );
          }
        }
        const result = await db.query(`SELECT * FROM ${section.table} WHERE department_id = $1 ORDER BY sort_order ASC, id ASC`, [id]);
        return res.json({ success: true, data: result.rows });
      } else {
        // Add single item
        const allowedFields = SECTION_ITEM_FIELDS[sectionName];
        const keys = allowedFields.filter(f => req.body[f] !== undefined);
        if (keys.length === 0) {
          return res.status(400).json({ success: false, error: 'No valid fields provided' });
        }
        const cols = ['department_id', ...keys];
        const placeholders = cols.map((_, i) => `$${i + 1}`);
        const vals = [id, ...keys.map(k => req.body[k])];
        const result = await db.query(
          `INSERT INTO ${section.table} (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
          vals
        );
        return res.status(201).json({ success: true, data: result.rows[0] });
      }
    } else {
      // Singleton sections (overview, mission, programmes, research, contact)
      const body = req.body;
      // Build column/value pairs
      const cols = Object.keys(body).filter(k => k !== 'department_id');
      if (cols.length === 0) {
        return res.status(400).json({ success: false, error: 'No fields provided' });
      }
      const placeholders = cols.map((_, i) => `$${i + 1}`);
      const vals = cols.map(k => typeof body[k] === 'object' ? JSON.stringify(body[k]) : body[k]);
      vals.push(id);

      // Upsert
      const result = await db.query(
        `INSERT INTO ${section.table} (department_id, ${cols.join(', ')})
         VALUES ($${vals.length}, ${placeholders.join(', ')})
         ON CONFLICT (department_id) DO UPDATE SET
           ${cols.map((c, i) => `${c} = EXCLUDED.${c}`).join(', ')},
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        vals
      );
      return res.json({ success: true, data: result.rows[0] });
    }
  } catch (error) {
    console.error(`PUT /departments/${req.params.id}/sections/${req.params.sectionName} error:`, error);
    res.status(500).json({ success: false, error: 'Failed to update section' });
  }
});

// DELETE a single item from list-type sections
router.delete('/:id/sections/:sectionName/:itemId', async (req, res) => {
  try {
    const { id, sectionName, itemId } = req.params;
    const section = SECTION_TABLES[sectionName];
    if (!section || !section.hasItems) {
      return res.status(400).json({ success: false, error: `Invalid section or not a list type` });
    }
    const result = await db.query(
      `DELETE FROM ${section.table} WHERE id = $1 AND department_id = $2 RETURNING *`,
      [itemId, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(`DELETE /departments/${id}/sections/${sectionName}/${itemId} error:`, error);
    res.status(500).json({ success: false, error: 'Failed to delete item' });
  }
});

// PUT a single item in list-type sections
router.put('/:id/sections/:sectionName/:itemId', async (req, res) => {
  try {
    const { id, sectionName, itemId } = req.params;
    const section = SECTION_TABLES[sectionName];
    if (!section || !section.hasItems) {
      return res.status(400).json({ success: false, error: `Invalid section or not a list type` });
    }
    const allowedFields = SECTION_ITEM_FIELDS[sectionName];
    const keys = allowedFields.filter(f => req.body[f] !== undefined);
    if (keys.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields' });
    }
    const setStr = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const vals = keys.map(k => req.body[k]);
    vals.push(itemId, id);
    const result = await db.query(
      `UPDATE ${section.table} SET ${setStr}, updated_at = CURRENT_TIMESTAMP WHERE id = $${vals.length - 1} AND department_id = $${vals.length} RETURNING *`,
      vals
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(`PUT /departments/${id}/sections/${sectionName}/${itemId} error:`, error);
    res.status(500).json({ success: false, error: 'Failed to update item' });
  }
});

module.exports = router;
