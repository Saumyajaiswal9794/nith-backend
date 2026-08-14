// Override system env injection
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  const envContent = fs.readFileSync(path.resolve(__dirname, '.env'), 'utf8');
  const match = envContent.match(/DATABASE_URL=["']?(.*?)["']?(?:\s*$|\s*#)/m);
  if (match) process.env.DATABASE_URL = match[1];
}
const { sql } = require('./src/db/neon');

async function run() {
  try {
    // ── Add code, slug, status to existing departments table ──
    try {
      await sql`ALTER TABLE departments ADD COLUMN code VARCHAR(20) UNIQUE`;
      console.log('✅ Added code column');
    } catch (e) { console.log('⏭️  code column already exists'); }

    try {
      await sql`ALTER TABLE departments ADD COLUMN slug VARCHAR(150) UNIQUE`;
      console.log('✅ Added slug column');
    } catch (e) { console.log('⏭️  slug column already exists'); }

    try {
      await sql`ALTER TABLE departments ADD COLUMN status VARCHAR(20) DEFAULT 'active'`;
      console.log('✅ Added status column');
    } catch (e) { console.log('⏭️  status column already exists'); }

    // ── Add department_id to research tables that are missing it ──
    try {
      await sql`ALTER TABLE department_research_publications ADD COLUMN department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE`;
      console.log('✅ Added department_id to research_publications');
    } catch (e) { console.log('⏭️  department_id already exists on publications'); }

    try {
      await sql`ALTER TABLE department_research_projects ADD COLUMN department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE`;
      console.log('✅ Added department_id to research_projects');
    } catch (e) { console.log('⏭️  department_id already exists on projects'); }

    try {
      await sql`ALTER TABLE department_research_written ADD COLUMN department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE`;
      console.log('✅ Added department_id to research_written');
    } catch (e) { console.log('⏭️  department_id already exists on written'); }

    try {
      await sql`ALTER TABLE department_research_supervision ADD COLUMN department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE`;
      console.log('✅ Added department_id to research_supervision');
    } catch (e) { console.log('⏭️  department_id already exists on supervision'); }

    // ── Seed departments if empty ──
    const seedDepts = [
      { code: 'cse',  slug: 'computer-science-engineering', name_en: 'Computer Science & Engineering' },
      { code: 'ce',   slug: 'civil-engineering',              name_en: 'Civil Engineering' },
      { code: 'che',  slug: 'chemical-engineering',           name_en: 'Chemical Engineering' },
      { code: 'ece',  slug: 'electronics-communication-engineering', name_en: 'Electronics & Communication Engineering' },
      { code: 'ee',   slug: 'electrical-engineering',          name_en: 'Electrical Engineering' },
      { code: 'me',   slug: 'mechanical-engineering',          name_en: 'Mechanical Engineering' },
      { code: 'mse',  slug: 'material-science-engineering',    name_en: 'Material Science & Engineering' },
      { code: 'chem', slug: 'chemistry',                       name_en: 'Chemistry' },
      { code: 'mnc',  slug: 'mathematics-scientific-computing', name_en: 'Mathematics & Scientific Computing' },
      { code: 'phy',  slug: 'physics-photonics-science',       name_en: 'Physics & Photonics Science' },
      { code: 'ces',  slug: 'centre-for-energy-studies',        name_en: 'Centre For Energy Studies' },
      { code: 'arch', slug: 'architecture',                     name_en: 'Architecture' },
      { code: 'mgt',  slug: 'management-studies',               name_en: 'Management Studies' },
      { code: 'hss',  slug: 'humanities-social-sciences',      name_en: 'Humanities & Social Sciences' },
    ];

    for (const d of seedDepts) {
      const existing = await sql`SELECT id FROM departments WHERE code = ${d.code}`;
      if (existing.length === 0) {
        const nameExists = await sql`SELECT id FROM departments WHERE name_en = ${d.name_en}`;
        if (nameExists.length > 0) {
          // Update existing row with code/slug
          await sql`UPDATE departments SET code = ${d.code}, slug = ${d.slug}, status = 'active' WHERE name_en = ${d.name_en}`;
          console.log(`  📌 Updated ${d.code}: ${d.name_en} with code/slug`);
        } else {
          await sql`
            INSERT INTO departments (code, slug, name_en, status)
            VALUES (${d.code}, ${d.slug}, ${d.name_en}, 'active')
          `;
          console.log(`  📌 Seeded department: ${d.code}`);
        }
      } else {
        console.log(`  ⏭️  Skipping ${d.code} (already exists)`);
      }
    }

    console.log('\n✅ Department migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  }
}

run();
