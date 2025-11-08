import { Router } from 'express';
import { storage } from './storage';

const router = Router();

// Generate sitemap.xml with all project vanity URLs
router.get('/sitemap.xml', async (req, res) => {
  try {
    const projects = await storage.getAllDevtoolsProjects();
    
    // Filter projects with vanity_slug
    const projectsWithVanity = projects.filter(p => p.vanity_slug);
    
    const baseUrl = 'https://riddleswap.com';
    
    // Generate sitemap XML
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/swap</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/nft-marketplace</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/token-launchpad</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
${projectsWithVanity.map(project => `  <url>
    <loc>${baseUrl}/project/${project.vanity_slug}</loc>
    <lastmod>${project.updatedAt?.toISOString() || new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n')}
</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (error) {
    console.error('❌ Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

export default router;
