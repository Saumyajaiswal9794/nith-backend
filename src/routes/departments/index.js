const express = require('express');
const router = express.Router();
const db = require('../../db/db');

// Fix DATABASE_URL if overridden by system env
const fs = require('fs');
const path = require('path');
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  const envContent = fs.readFileSync(path.resolve(__dirname, '../../../.env'), 'utf8');
  const match = envContent.match(/DATABASE_URL=["']?(.*?)["']?(?:\s*$|\s*#)/m);
  if (match) process.env.DATABASE_URL = match[1];
}

// ── GET /api/v1/departments → list all with counts ──
router.get('/', async (req, res) => {
  try {
    const listRes = await db.query('SELECT * FROM departments ORDER BY id ASC');
    const countRes = await db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active,
        COUNT(*) FILTER (WHERE (status = 'inactive' OR status IS NULL))::int AS inactive
      FROM departments
    `);
    res.json({ success: true, data: listRes.rows, counts: countRes.rows[0] });
  } catch (error) {
    console.error('GET /departments error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch departments' });
  }
});

// ── GET /api/v1/departments/:id → full department with all sections ──
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deptRes = await db.query('SELECT * FROM departments WHERE id = $1', [id]);
    if (deptRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Department not found' });
    const dept = deptRes.rows[0];

    const [visions, faculty, staff, programmes, labs, contact, publications, projects, written, supervision] = await Promise.all([
      db.query('SELECT * FROM department_visions WHERE department_id = $1', [id]).then(r => r.rows[0] || null),
      db.query('SELECT * FROM department_faculty WHERE department_id = $1 ORDER BY id ASC', [id]).then(r => r.rows),
      db.query('SELECT * FROM department_staff WHERE department_id = $1 ORDER BY id ASC', [id]).then(r => r.rows),
      db.query('SELECT * FROM department_prog WHERE department_id = $1 ORDER BY id ASC', [id]).then(r => r.rows),
      db.query('SELECT * FROM department_labs WHERE department_id = $1 ORDER BY id ASC', [id]).then(r => r.rows),
      db.query('SELECT * FROM department_contact WHERE department_id = $1', [id]).then(r => r.rows[0] || null),
      db.query('SELECT * FROM department_research_publications WHERE department_id = $1 ORDER BY year DESC', [id]).then(r => r.rows),
      db.query('SELECT * FROM department_research_projects WHERE department_id = $1 ORDER BY id ASC', [id]).then(r => r.rows),
      db.query('SELECT * FROM department_research_written WHERE department_id = $1 ORDER BY year DESC', [id]).then(r => r.rows),
      db.query('SELECT * FROM department_research_supervision WHERE department_id = $1 ORDER BY id ASC', [id]).then(r => r.rows),
    ]);

    res.json({
      success: true,
      data: { ...dept, visions, faculty, staff, programmes, labs, contact, publications, projects, written, supervision },
    });
  } catch (error) {
    console.error('GET /departments/:id error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch department' });
  }
});

// ── GET /departments/slug/:slug → by slug (public) ──
router.get('/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const deptRes = await db.query('SELECT * FROM departments WHERE slug = $1 AND (status = $2 OR status IS NULL)', [slug, 'active']);
    if (deptRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Department not found' });
    const id = deptRes.rows[0].id;
    const dept = deptRes.rows[0];

    const [visions, faculty, staff, programmes, labs, contact, publications, projects, written, supervision] = await Promise.all([
      db.query('SELECT * FROM department_visions WHERE department_id = $1', [id]).then(r => r.rows[0] || null),
      db.query('SELECT * FROM department_faculty WHERE department_id = $1 ORDER BY id ASC', [id]).then(r => r.rows),
      db.query('SELECT * FROM department_staff WHERE department_id = $1 ORDER BY id ASC', [id]).then(r => r.rows),
      db.query('SELECT * FROM department_prog WHERE department_id = $1 ORDER BY id ASC', [id]).then(r => r.rows),
      db.query('SELECT * FROM department_labs WHERE department_id = $1 ORDER BY id ASC', [id]).then(r => r.rows),
      db.query('SELECT * FROM department_contact WHERE department_id = $1', [id]).then(r => r.rows[0] || null),
      db.query('SELECT * FROM department_research_publications WHERE department_id = $1 ORDER BY year DESC', [id]).then(r => r.rows),
      db.query('SELECT * FROM department_research_projects WHERE department_id = $1 ORDER BY id ASC', [id]).then(r => r.rows),
      db.query('SELECT * FROM department_research_written WHERE department_id = $1 ORDER BY year DESC', [id]).then(r => r.rows),
      db.query('SELECT * FROM department_research_supervision WHERE department_id = $1 ORDER BY id ASC', [id]).then(r => r.rows),
    ]);

    res.json({
      success: true,
      data: { ...dept, visions, faculty, staff, programmes, labs, contact, publications, projects, written, supervision },
    });
  } catch (error) {
    console.error('GET /departments/slug/:slug error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch department by slug' });
  }
});

// ── POST /api/v1/departments → create ──
router.post('/', async (req, res) => {
  try {
    const { code, slug, name_en, name_hn, description_en, description_hn, courses_name_en, courses_name_hn, photo_url, status } = req.body;
    if (!code || !slug || !name_en) {
      return res.status(400).json({ success: false, error: 'code, slug, and name_en are required' });
    }
    const dupCode = await db.query('SELECT id FROM departments WHERE code = $1', [code]);
    if (dupCode.rows.length > 0) return res.status(409).json({ success: false, error: 'Department code already exists' });
    const dupSlug = await db.query('SELECT id FROM departments WHERE slug = $1', [slug]);
    if (dupSlug.rows.length > 0) return res.status(409).json({ success: false, error: 'Department slug already exists' });

    const result = await db.query(
      `INSERT INTO departments (code, slug, name_en, name_hn, description_en, description_hn, courses_name_en, courses_name_hn, photo_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [code, slug, name_en, name_hn || null, description_en || null, description_hn || null, courses_name_en || null, courses_name_hn || null, photo_url || null, status || 'active']
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('POST /departments error:', error);
    res.status(500).json({ success: false, error: 'Failed to create department' });
  }
});

// ── PUT /api/v1/departments/:id → update ──
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['code', 'slug', 'name_en', 'name_hn', 'description_en', 'description_hn', 'courses_name_en', 'courses_name_hn', 'photo_url', 'status'];
    const keys = Object.keys(req.body).filter(k => allowed.includes(k));
    if (keys.length === 0) return res.status(400).json({ success: false, error: 'No valid fields to update' });

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
      `UPDATE departments SET ${setStr}, updated_at = CURRENT_TIMESTAMP WHERE id = $${vals.length} RETURNING *`, vals
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Department not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('PUT /departments/:id error:', error);
    res.status(500).json({ success: false, error: 'Failed to update department' });
  }
});

// ── DELETE /api/v1/departments/:id → delete ──
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM departments WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Department not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('DELETE /departments/:id error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete department' });
  }
});

// ══════════════════════════════════════════════════════════════════════
// SECTION ENDPOINTS — uses existing final.sql table names
// ══════════════════════════════════════════════════════════════════════

const SECTION_CONFIG = {
  visions:     { table: 'department_visions',              type: 'singleton', fields: ['vision_en','vision_hn','mission_en','mission_hn'] },
  programmes:   { table: 'department_prog',                type: 'list',      fields: ['program_name_en','program_name_hn'] },
  faculty:      { table: 'department_faculty',             type: 'list',      fields: ['name_en','type','name','area_of_interest','email','profile_link'] },
  staff:        { table: 'department_staff',               type: 'list',      fields: ['name_en','type','name','designation','phone_no','email'] },
  labs:         { table: 'department_labs',                type: 'list',      fields: ['lab_name_en','lab_name_hn'] },
  contact:      { table: 'department_contact',             type: 'singleton', fields: ['hod_en','hod_hn','phone_no','hod_email','office_email','department','college','address'] },
  publications: { table: 'department_research_publications', type: 'list',   fields: ['journal_name','title','author','sci','year','department_id'] },
  projects:     { table: 'department_research_projects',   type: 'list',      fields: ['role','project_type','title','funding_agency','from','to','amount','status','co_investigator','sanction_order','department_id'] },
  written:      { table: 'department_research_written',    type: 'list',      fields: ['type','title','publisher','author','isbn','year','department_id'] },
  supervision:  { table: 'department_research_supervision', type: 'list',    fields: ['program_name','scholar_name','research_topic','status','year','co_supervisor','department_id'] },
};

// PUT /api/v1/departments/:id/sections/:sectionName → upsert section
router.put('/:id/sections/:sectionName', async (req, res) => {
  try {
    const { id, sectionName } = req.params;
    const section = SECTION_CONFIG[sectionName];
    if (!section) return res.status(400).json({ success: false, error: `Invalid section: ${sectionName}. Valid: ${Object.keys(SECTION_CONFIG).join(', ')}` });

    const deptCheck = await db.query('SELECT id FROM departments WHERE id = $1', [id]);
    if (deptCheck.rows.length === 0) return res.status(404).json({ success: false, error: 'Department not found' });

    if (section.type === 'singleton') {
      const body = req.body;
      const cols = Object.keys(body).filter(k => section.fields.includes(k));
      if (cols.length === 0) return res.status(400).json({ success: false, error: 'No valid fields' });
      const placeholders = cols.map((_, i) => `$${i + 1}`);
      const vals = cols.map(k => body[k]);
      vals.push(id);

      const result = await db.query(
        `INSERT INTO ${section.table} (department_id, ${cols.join(', ')})
         VALUES ($${vals.length}, ${placeholders.join(', ')})
         ON CONFLICT (department_id) DO UPDATE SET
           ${cols.map(c => `${c} = EXCLUDED.${c}`).join(', ')},
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        vals
      );
      return res.json({ success: true, data: result.rows[0] });

    } else {
      // List type — bulk replace
      if (req.body.items && Array.isArray(req.body.items)) {
        await db.query(`DELETE FROM ${section.table} WHERE department_id = $1`, [id]);
        for (const item of req.body.items) {
          const keys = section.fields.filter(f => item[f] !== undefined);
          if (keys.length === 0) continue;
          const cols = ['department_id', ...keys];
          const placeholders = cols.map((_, i) => `$${i + 1}`);
          const vals = [id, ...keys.map(k => item[k])];
          await db.query(`INSERT INTO ${section.table} (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`, vals);
        }
        const result = await db.query(`SELECT * FROM ${section.table} WHERE department_id = $1 ORDER BY id ASC`, [id]);
        return res.json({ success: true, data: result.rows });
      } else {
        // Single item add
        const keys = section.fields.filter(f => req.body[f] !== undefined);
        if (keys.length === 0) return res.status(400).json({ success: false, error: 'No valid fields' });
        const cols = ['department_id', ...keys];
        const placeholders = cols.map((_, i) => `$${i + 1}`);
        const vals = [id, ...keys.map(k => req.body[k])];
        const result = await db.query(`INSERT INTO ${section.table} (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`, vals);
        return res.status(201).json({ success: true, data: result.rows[0] });
      }
    }
  } catch (error) {
    console.error(`PUT /departments/${req.params.id}/sections/${req.params.sectionName} error:`, error);
    res.status(500).json({ success: false, error: 'Failed to update section' });
  }
});

// DELETE single item from list sections
router.delete('/:id/sections/:sectionName/:itemId', async (req, res) => {
  try {
    const { id, sectionName, itemId } = req.params;
    const section = SECTION_CONFIG[sectionName];
    if (!section || section.type !== 'list') return res.status(400).json({ success: false, error: 'Invalid section or not a list type' });
    const result = await db.query(`DELETE FROM ${section.table} WHERE id = $1 AND department_id = $2 RETURNING *`, [itemId, id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Item not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete item' });
  }
});

// PUT single item in list sections
router.put('/:id/sections/:sectionName/:itemId', async (req, res) => {
  try {
    const { id, sectionName, itemId } = req.params;
    const section = SECTION_CONFIG[sectionName];
    if (!section || section.type !== 'list') return res.status(400).json({ success: false, error: 'Invalid section or not a list type' });
    const keys = section.fields.filter(f => req.body[f] !== undefined);
    if (keys.length === 0) return res.status(400).json({ success: false, error: 'No valid fields' });
    const setStr = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const vals = keys.map(k => req.body[k]);
    vals.push(itemId, id);
    const result = await db.query(
      `UPDATE ${section.table} SET ${setStr}, updated_at = CURRENT_TIMESTAMP WHERE id = $${vals.length - 1} AND department_id = $${vals.length} RETURNING *`, vals
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Item not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update item' });
  }
});

module.exports = router;
