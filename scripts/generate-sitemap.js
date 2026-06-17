import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base app URL from meta information
const BASE_URL = 'https://ais-pre-butl6lxhsd5bvsed2kqeou-491441782414.europe-west2.run.app';

// Standard fallback works list (from index.html defaultData)
const DEFAULT_WORKS = [
  { id: 'work-1', title: 'Видеопроизводство полного цикла' },
  { id: 'work-2', title: 'Клипы, реклама и документальное кино' },
  { id: 'work-3', title: 'Коммерческий бренд контент и моушн' }
];

function parseFirestoreValue(value) {
  if (!value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('integerValue' in value) return Number(value.integerValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('arrayValue' in value) {
    const values = value.arrayValue.values || [];
    return values.map(parseFirestoreValue);
  }
  if ('mapValue' in value) {
    const fields = value.mapValue.fields || {};
    const obj = {};
    for (const key in fields) {
      obj[key] = parseFirestoreValue(fields[key]);
    }
    return obj;
  }
  if ('nullValue' in value) return null;
  return value;
}

async function getWorksList() {
  try {
    const configPath = path.join(__dirname, '../firebase-applet-config.json');
    if (!fs.existsSync(configPath)) {
      console.log('Firebase configuration not found, using preset default works list.');
      return DEFAULT_WORKS;
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const { projectId, firestoreDatabaseId } = config;
    if (!projectId || !firestoreDatabaseId) {
      console.log('Incomplete Firebase parameters, using preset default works list.');
      return DEFAULT_WORKS;
    }

    const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/portfolio/config`;
    console.log(`Connecting to Firestore endpoint: ${docUrl}`);
    
    const response = await fetch(docUrl);
    if (!response.ok) {
      console.log(`Firestore API status: ${response.status}. Using defaults.`);
      return DEFAULT_WORKS;
    }

    const data = await response.json();
    if (!data || !data.fields) {
      console.log('Firestore document has not been initiated yet. Using defaults.');
      return DEFAULT_WORKS;
    }

    const docData = parseFirestoreValue({ mapValue: { fields: data.fields } });
    if (docData && Array.isArray(docData.works)) {
      console.log(`Found ${docData.works.length} live portfolio works from cloud database.`);
      return docData.works;
    }
  } catch (error) {
    console.warn('Error reading live portfolio configuration, using defaults:', error.message);
  }
  return DEFAULT_WORKS;
}

async function main() {
  const works = await getWorksList();
  const currentDate = new Date().toISOString().split('T')[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Главная страница портфолио -->
  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <!-- Раздел со всеми работами -->
  <url>
    <loc>${BASE_URL}/#works-page</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
`;

  // Add individual works anchors to sitemap for indexing
  works.forEach((work) => {
    if (work && work.id) {
      const workIdEscaped = encodeURIComponent(work.id);
      const titleComment = work.title ? `Работа: ${work.title}` : `Работа ID: ${work.id}`;
      xml += `  <!-- ${titleComment} -->
  <url>
    <loc>${BASE_URL}/#${workIdEscaped}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
    }
  });

  xml += `</urlset>\n`;

  const publicDir = path.join(__dirname, '../public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const sitemapPath = path.join(publicDir, 'sitemap.xml');
  fs.writeFileSync(sitemapPath, xml, 'utf-8');
  console.log(`SEO Sitemap loaded. Generated site index successfully at: ${sitemapPath}`);
}

main();
