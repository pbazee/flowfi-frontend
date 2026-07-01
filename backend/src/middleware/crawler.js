const { getSupabaseAdmin } = require('../lib/supabase');
const { logger } = require('../lib/logger');

// Known crawler user agents
const crawlerUserAgents = [
  'facebookexternalhit',
  'Twitterbot',
  'WhatsApp',
  'LinkedInBot',
  'Pinterest',
  'Slackbot',
  'Discordbot',
  'TelegramBot',
];

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

function isCrawler(userAgent) {
  if (!userAgent) return false;
  return crawlerUserAgents.some(crawler => userAgent.includes(crawler));
}

function generateHtml(meta) {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${meta.title}</title>
        <meta property="og:title" content="${meta.title}" />
        <meta property="og:description" content="${meta.description}" />
        <meta property="og:image" content="${meta.image}" />
        <meta property="og:url" content="${meta.url}" />
        <meta property="og:type" content="${meta.type || 'website'}" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${meta.title}" />
        <meta name="twitter:description" content="${meta.description}" />
        <meta name="twitter:image" content="${meta.image}" />
      </head>
      <body>
        <h1>${meta.title}</h1>
        <p>${meta.description}</p>
        <p>You are being redirected...</p>
        <script>window.location.replace("${meta.url}");</script>
      </body>
    </html>
  `;
}

async function crawlerMiddleware(req, res, next) {
  const userAgent = req.headers['user-agent'] || '';

  if (!isCrawler(userAgent)) {
    return next();
  }

  try {
    const db = getSupabaseAdmin();

    // Blog matches: /blog/:id
    if (req.path.startsWith('/blog/')) {
      const slug = req.path.split('/')[2];
      if (slug) {
        const { data } = await db.from('blog_posts').select('*').eq('id', slug).maybeSingle();
        if (data) {
          return res.send(generateHtml({
            title: data.title,
            description: data.excerpt || 'Read this post on FlowFi',
            image: data.featured_image || `${FRONTEND_URL}/og-image.png`,
            url: `${FRONTEND_URL}${req.path}`,
            type: 'article',
          }));
        }
      }
    }

    // Shop Product matches: /shop/:slug
    if (req.path.startsWith('/shop/') && req.path !== '/shop/cart' && req.path !== '/shop/checkout') {
      const slug = req.path.split('/')[2];
      if (slug) {
        const { data } = await db.from('platform_shop_products').select('*').eq('slug', slug).maybeSingle();
        if (data) {
          const image = (data.images && data.images[0]) || `${FRONTEND_URL}/og-image.png`;
          return res.send(generateHtml({
            title: data.name,
            description: data.short_description || data.description,
            image,
            url: `${FRONTEND_URL}${req.path}`,
            type: 'product',
          }));
        }
      }
    }
  } catch (err) {
    logger.error('Crawler middleware error: ' + err.message);
  }

  next();
}

module.exports = { crawlerMiddleware };
