// Override any system-level env injection for DATABASE_URL
const dotenv = require('dotenv');
dotenv.config({ path: require('path').resolve(__dirname, '.env') });
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  // Extract from .env file directly
  const fs = require('fs');
  const envContent = fs.readFileSync(require('path').resolve(__dirname, '.env'), 'utf8');
  const match = envContent.match(/DATABASE_URL=["']?(.*?)["']?(?:\s*$|\s*#)/m);
  if (match) process.env.DATABASE_URL = match[1];
}
const { sql } = require('./src/db/neon');

async function run() {
  try {
    // ── Main departments table ──
    await sql`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        code VARCHAR(20) UNIQUE NOT NULL,
        slug VARCHAR(150) UNIQUE NOT NULL,
        name_en VARCHAR(255) NOT NULL,
        name_hi VARCHAR(255),
        short_description_en TEXT,
        short_description_hi TEXT,
        image_url TEXT,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ departments table created');

    // ── Department Overview section ──
    await sql`
      CREATE TABLE IF NOT EXISTS dept_overview (
        id SERIAL PRIMARY KEY,
        department_id INTEGER UNIQUE REFERENCES departments(id) ON DELETE CASCADE,
        title_en TEXT,
        title_hi TEXT,
        descriptions_en JSONB DEFAULT '[]',
        descriptions_hi JSONB DEFAULT '[]',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ dept_overview created');

    // ── Department Mission section ──
    await sql`
      CREATE TABLE IF NOT EXISTS dept_mission (
        id SERIAL PRIMARY KEY,
        department_id INTEGER UNIQUE REFERENCES departments(id) ON DELETE CASCADE,
        vision_en TEXT,
        vision_hi TEXT,
        mission_en JSONB DEFAULT '[]',
        mission_hi JSONB DEFAULT '[]',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ dept_mission created');

    // ── Department Programmes section ──
    await sql`
      CREATE TABLE IF NOT EXISTS dept_programmes (
        id SERIAL PRIMARY KEY,
        department_id INTEGER UNIQUE REFERENCES departments(id) ON DELETE CASCADE,
        programmes_en JSONB DEFAULT '[]',
        programmes_hi JSONB DEFAULT '[]',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ dept_programmes created');

    // ── Department Research Publications section ──
    await sql`
      CREATE TABLE IF NOT EXISTS dept_research (
        id SERIAL PRIMARY KEY,
        department_id INTEGER UNIQUE REFERENCES departments(id) ON DELETE CASCADE,
        categories_en JSONB DEFAULT '[]',
        categories_hi JSONB DEFAULT '[]',
        publications_en JSONB DEFAULT '[]',
        publications_hi JSONB DEFAULT '[]',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ dept_research created');

    // ── Department Faculty section ──
    await sql`
      CREATE TABLE IF NOT EXISTS dept_faculty (
        id SERIAL PRIMARY KEY,
        department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
        group_title_en VARCHAR(255),
        group_title_hi VARCHAR(255),
        name_en VARCHAR(255) NOT NULL,
        name_hi VARCHAR(255),
        designation_en VARCHAR(255),
        designation_hi VARCHAR(255),
        interests_en TEXT,
        interests_hi TEXT,
        email VARCHAR(255),
        photo_url TEXT,
        sort_order INTEGER DEFAULT 0,
        is_featured BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ dept_faculty created');

    // ── Department Labs section ──
    await sql`
      CREATE TABLE IF NOT EXISTS dept_labs (
        id SERIAL PRIMARY KEY,
        department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
        name_en VARCHAR(255) NOT NULL,
        name_hi VARCHAR(255),
        description_en TEXT,
        description_hi TEXT,
        group_label_en VARCHAR(255),
        group_label_hi VARCHAR(255),
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ dept_labs created');

    // ── Department Contact section ──
    await sql`
      CREATE TABLE IF NOT EXISTS dept_contact (
        id SERIAL PRIMARY KEY,
        department_id INTEGER UNIQUE REFERENCES departments(id) ON DELETE CASCADE,
        hod_name_en VARCHAR(255),
        hod_name_hi VARCHAR(255),
        hod_title_en VARCHAR(255),
        hod_title_hi VARCHAR(255),
        department_name_en VARCHAR(255),
        department_name_hi VARCHAR(255),
        institute_name_en VARCHAR(255),
        institute_name_hi VARCHAR(255),
        address_en TEXT,
        address_hi TEXT,
        phone VARCHAR(100),
        hod_email VARCHAR(255),
        office_email VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ dept_contact created');

    // ── Department Media section ──
    await sql`
      CREATE TABLE IF NOT EXISTS dept_media (
        id SERIAL PRIMARY KEY,
        department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
        title_en VARCHAR(255),
        title_hi VARCHAR(255),
        description_en TEXT,
        description_hi TEXT,
        image_url TEXT,
        type VARCHAR(50) DEFAULT 'image' CHECK (type IN ('image', 'video', 'document')),
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ dept_media created');

    // ── Staff section (office + technical) ──
    await sql`
      CREATE TABLE IF NOT EXISTS dept_staff (
        id SERIAL PRIMARY KEY,
        department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
        staff_type VARCHAR(50) DEFAULT 'office' CHECK (staff_type IN ('office', 'technical')),
        name_en VARCHAR(255) NOT NULL,
        name_hi VARCHAR(255),
        designation_en VARCHAR(255),
        designation_hi VARCHAR(255),
        phone VARCHAR(100),
        email VARCHAR(255),
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ dept_staff created');

    // ── Seed initial departments from main frontend data ──
    const seedDepts = [
      { code: 'cse',  slug: 'computer-science-engineering', name: 'Computer Science & Engineering' },
      { code: 'ce',   slug: 'civil-engineering',              name: 'Civil Engineering' },
      { code: 'che',  slug: 'chemical-engineering',           name: 'Chemical Engineering' },
      { code: 'ece',  slug: 'electronics-communication-engineering', name: 'Electronics & Communication Engineering' },
      { code: 'ee',   slug: 'electrical-engineering',          name: 'Electrical Engineering' },
      { code: 'me',   slug: 'mechanical-engineering',          name: 'Mechanical Engineering' },
      { code: 'mse',  slug: 'material-science-engineering',    name: 'Material Science & Engineering' },
      { code: 'chem', slug: 'chemistry',                       name: 'Chemistry' },
      { code: 'mnc',  slug: 'mathematics-scientific-computing', name: 'Mathematics & Scientific Computing' },
      { code: 'phy',  slug: 'physics-photonics-science',       name: 'Physics & Photonics Science' },
      { code: 'ces',  slug: 'centre-for-energy-studies',        name: 'Centre For Energy Studies' },
      { code: 'arch', slug: 'architecture',                     name: 'Architecture' },
      { code: 'mgt',  slug: 'management-studies',               name: 'Management Studies' },
      { code: 'hss',  slug: 'humanities-social-sciences',      name: 'Humanities & Social Sciences' },
    ];

    for (const d of seedDepts) {
      // Only insert if code doesn't already exist
      const existing = await sql`SELECT id FROM departments WHERE code = ${d.code}`;
      if (existing.length === 0) {
        await sql`
          INSERT INTO departments (code, slug, name_en, name_hi, short_description_en, short_description_hi, status)
          VALUES (${d.code}, ${d.slug}, ${d.name}, NULL, NULL, NULL, 'active')
        `;
        console.log(`  📌 Seeded department: ${d.code}`);
      } else {
        console.log(`  ⏭️  Skipping ${d.code} (already exists)`);
      }
    }

    console.log('\n✅ All department tables created and seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  }
}

run();
