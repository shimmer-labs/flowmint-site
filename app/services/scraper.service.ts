/**
 * Web Scraping Service
 * Extracts brand data from any website using Cheerio
 * This replaces Shopify GraphQL API calls from ottomate
 */

import * as cheerio from 'cheerio';

export interface ScrapedData {
  url: string;
  siteName: string;
  tagline: string;
  description: string;
  primaryColor?: string;
  brandColors?: { primary?: string; secondary?: string; accent?: string };
  logo?: string;
  images: {
    hero?: string;
    products: string[];
    lifestyle: string[];
  };
  products: Array<{
    title: string;
    description?: string;
    price?: number;
    image?: string;
  }>;
  blogPosts: Array<{
    title: string;
    excerpt?: string;
    content?: string;
  }>;
  pricingTiers?: Array<{
    name: string;
    price?: string;
    features: string[];
  }>;
  aboutContent?: string;
  servicesOffered?: string[];
  scrapedAt: Date;
}

/**
 * Main scraping function
 */
export async function scrapeWebsite(url: string): Promise<ScrapedData> {
  console.log(`🔍 Scraping website: ${url}`);

  // Fetch homepage
  const html = await fetchWithUserAgent(url);
  const $ = cheerio.load(html);

  // Extract homepage data
  const siteName = extractSiteName($, url);
  const tagline = extractTagline($);
  const description = extractDescription($);
  const primaryColor = extractPrimaryColor($);
  const brandColors = extractBrandColors($, html);
  const logo = extractLogo($, url);

  // Extract images from homepage
  console.log('📸 Looking for images...');
  const heroImage = extractHeroImage($, url);
  const lifestyleImages = extractLifestyleImages($, url);

  // Find and scrape product/service pages (in parallel)
  console.log('🛍️  Looking for products/services...');
  const productUrls = await findProductPages(url, $);
  const products = await Promise.all(
    productUrls.slice(0, 5).map(pUrl => scrapeProduct(pUrl)) // Limit to 5 products
  );

  // Find and scrape blog/news posts (in parallel)
  console.log('📝 Looking for blog posts...');
  const blogUrls = await findBlogPages(url, $);
  const blogPosts = await Promise.all(
    blogUrls.slice(0, 3).map(bUrl => scrapeBlogPost(bUrl)) // Limit to 3 posts
  );

  // Find and scrape pricing page (for SaaS)
  console.log('💰 Looking for pricing page...');
  const pricingTiers = await scrapePricingPage(url);

  // Find and scrape about page
  console.log('ℹ️  Looking for about page...');
  const aboutContent = await scrapeAboutPage(url);

  // Extract services (for agencies/service businesses)
  console.log('🔧 Looking for services...');
  const servicesOffered = await findServices(url, $);

  // Extract product images from scraped products
  const productImages = products
    .filter(Boolean)
    .map((p: any) => p.image)
    .filter(Boolean)
    .slice(0, 5);

  return {
    url,
    siteName,
    tagline,
    description,
    primaryColor,
    brandColors,
    logo,
    images: {
      hero: heroImage,
      products: productImages,
      lifestyle: lifestyleImages,
    },
    products: products.filter(Boolean) as any,
    blogPosts: blogPosts.filter(Boolean) as any,
    pricingTiers,
    aboutContent,
    servicesOffered,
    scrapedAt: new Date(),
  };
}

/**
 * Fetch URL with proper user agent
 */
async function fetchWithUserAgent(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'FlowMintBot/1.0 (+https://flowmint.me/bot)',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

/**
 * Extract site name from homepage
 */
function extractSiteName($: cheerio.CheerioAPI, url: string): string {
  return (
    $('meta[property="og:site_name"]').attr('content') ||
    $('title').text().split('|')[0].split('-')[0].trim() ||
    $('h1').first().text().trim() ||
    new URL(url).hostname.replace('www.', '')
  );
}

/**
 * Extract tagline/description
 */
function extractTagline($: cheerio.CheerioAPI): string {
  return (
    $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    $('p').first().text().trim() ||
    ''
  );
}

/**
 * Extract full description
 */
function extractDescription($: cheerio.CheerioAPI): string {
  return (
    $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    ''
  );
}

/**
 * Extract primary brand color
 */
function extractPrimaryColor($: cheerio.CheerioAPI): string | undefined {
  return $('meta[name="theme-color"]').attr('content') || undefined;
}

/**
 * Extract logo URL
 */
function extractLogo($: cheerio.CheerioAPI, baseUrl: string): string | undefined {
  const ogImage = $('meta[property="og:image"]').attr('content');
  const favicon = $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href');

  if (ogImage) {
    return new URL(ogImage, baseUrl).href;
  }
  if (favicon) {
    return new URL(favicon, baseUrl).href;
  }
  return undefined;
}

/**
 * Reject images that aren't real brand/hero/product photos: SVGs and data URIs
 * (icons/line-art), placeholder/dummy/spacer images, favicons/icons/logos,
 * trust badges, screenshots, and CDN thumbnails. This is what stops the
 * RevSlider `dummy.png` / line-art `.svg` / screenshot junk from landing in
 * generated emails. Heuristics adapted + extended from ai-email-designer.
 */
const IMAGE_JUNK_PATTERNS = [
  "logo", "icon", "favicon", "sprite", "spinner", "loading",
  "placeholder", "dummy", "spacer", "pixel", "blank", "default-",
  "no-image", "noimage", "screenshot", "/thumb", "_thumb", "/small",
  "_small", "/tiny", "_tiny", "badge", "seal", "trust", "1x1",
];

function isJunkImage(src: string, alt = "", className = ""): boolean {
  const s = src.trim().toLowerCase();
  // Empty/anchor/JS srcs (e.g. <img src="#"> lazy placeholders) aren't images
  if (!s || s === "#" || s.startsWith("#") || s.startsWith("javascript:")) return true;
  // Vector/icon and inline images are never the brand photo we want
  if (s.endsWith(".svg") || s.includes(".svg?") || s.startsWith("data:")) return true;
  const hay = `${s} ${alt.toLowerCase()} ${className.toLowerCase()}`;
  if (IMAGE_JUNK_PATTERNS.some((p) => hay.includes(p))) return true;
  // Tiny images declared in the URL (e.g. ?width=32, /32x32/, ?w=50)
  const sizeMatch = s.match(/[?&]width=(\d+)|\/(\d+)x(\d+)[\/.]|[?&]w=(\d+)|[?&]h=(\d+)/);
  if (sizeMatch) {
    const sizes = sizeMatch.slice(1).filter(Boolean).map(Number);
    if (sizes.some((n) => n < 150)) return true;
  }
  return false;
}

function isTooSmall($img: cheerio.Cheerio<any>): boolean {
  const w = parseInt($img.attr("width") || "", 10);
  const h = parseInt($img.attr("height") || "", 10);
  if (!Number.isNaN(w) && w < 200) return true;
  if (!Number.isNaN(h) && h < 150) return true;
  return false;
}

/**
 * Extract the hero image (main brand photo). Returns undefined when we can't
 * find a real photo, so the email goes text-led rather than embedding junk.
 */
function extractHeroImage($: cheerio.CheerioAPI, baseUrl: string): string | undefined {
  const heroSelectors = [
    'img[class*="hero"]', '[class*="hero"] img',
    '[class*="banner"] img', 'img[class*="banner"]',
    '[class*="splash"] img', '[class*="masthead"] img',
    'section:first-of-type img',
    'header img:not([class*="logo"]):not([alt*="logo"])',
  ];
  for (const selector of heroSelectors) {
    const imgs = $(selector);
    for (let i = 0; i < Math.min(imgs.length, 6); i++) {
      const img = imgs.eq(i);
      const src = img.attr("src") || img.attr("data-src");
      if (!src) continue;
      if (isJunkImage(src, img.attr("alt") || "", img.attr("class") || "")) continue;
      if (isTooSmall(img)) continue;
      try { return new URL(src, baseUrl).href; } catch { /* bad URL */ }
    }
  }
  // og:image fallback, only if it isn't itself junk/logo
  const og = $('meta[property="og:image"]').attr("content");
  if (og && !isJunkImage(og)) {
    try { return new URL(og, baseUrl).href; } catch { /* bad URL */ }
  }
  return undefined;
}

/**
 * Extract real lifestyle/marketing photos from the homepage (max 4).
 */
function extractLifestyleImages($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const images: string[] = [];
  $("main img, section img, article img, .content img").each((_, el) => {
    if (images.length >= 4) return false;
    const $img = $(el);
    const src = $img.attr("src") || $img.attr("data-src");
    if (!src) return;
    if (isJunkImage(src, $img.attr("alt") || "", $img.attr("class") || "")) return;
    if (isTooSmall($img)) return;
    try {
      const full = new URL(src, baseUrl).href;
      if (!images.includes(full)) images.push(full);
    } catch { /* bad URL */ }
  });
  return images;
}

/**
 * Extract real brand colors from the page (theme-color, CSS custom properties,
 * header/nav/button styles). Returns only colors we actually found — no vivid
 * fallback — so brand-analysis keeps the model's guess rather than inventing a
 * color when a site hides them in external CSS. Adapted from ai-email-designer.
 */
function extractBrandColors(
  $: cheerio.CheerioAPI,
  html: string
): { primary?: string; secondary?: string; accent?: string } {
  const counts = new Map<string, { count: number; priority: number }>();
  const add = (raw: string, priority: number) => {
    const c = normalizeColor(raw);
    if (!c || c.length < 7 || isUnusableColor(c)) return;
    const e = counts.get(c);
    if (e) { e.count++; e.priority = Math.max(e.priority, priority); }
    else counts.set(c, { count: 1, priority });
  };

  const themeColor = $('meta[name="theme-color"]').attr("content");
  if (themeColor) add(themeColor, 100);

  // CSS custom properties whose NAME contains primary/brand/accent/main/theme
  // (catches --primary-color, --brand, and Elementor's --e-global-color-primary).
  const varRe = /--[a-z0-9-]*(?:primary|brand|accent|main|theme)[a-z0-9-]*:\s*(#[0-9a-f]{3,6}|rgba?\([^)]+\))/gi;
  let m: RegExpExecArray | null;
  while ((m = varRe.exec(html)) !== null) {
    const hex = cssColorToHex(m[1]);
    if (hex) add(hex, 90);
  }

  $('header, nav, .header, .navbar, [class*="logo"], .brand').each((_, el) => {
    extractColorsFromCSS($(el).attr("style") || "", (c) => add(c, 80));
  });
  $('a.btn, button, .button, [class*="btn-primary"], [class*="cta"]').each((_, el) => {
    extractColorsFromCSS($(el).attr("style") || "", (c) => add(c, 70));
  });

  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  while ((m = styleRe.exec(html)) !== null) {
    extractColorsFromCSS(m[1], (c) => add(c, 10));
  }

  const sorted = Array.from(counts.entries())
    .sort((a, b) => (b[1].priority - a[1].priority) || (b[1].count - a[1].count))
    .map(([c]) => c);

  return { primary: sorted[0], secondary: sorted[1], accent: sorted[2] };
}

function extractColorsFromCSS(css: string, add: (c: string) => void) {
  let mm: RegExpExecArray | null;
  const hexRe = /(?:color|background-color|background|border-color|fill|stroke):\s*(#[0-9a-f]{3,6})/gi;
  while ((mm = hexRe.exec(css)) !== null) add(mm[1]);
  const rgbRe = /(?:color|background-color|background):\s*rgba?\((\d+),\s*(\d+),\s*(\d+)/gi;
  while ((mm = rgbRe.exec(css)) !== null) add(rgbToHex(+mm[1], +mm[2], +mm[3]));
}

function cssColorToHex(v: string): string | null {
  if (v.startsWith("#")) return v;
  const rgb = v.match(/(\d+),\s*(\d+),\s*(\d+)/);
  return rgb ? rgbToHex(+rgb[1], +rgb[2], +rgb[3]) : null;
}

function normalizeColor(color: string): string {
  if (!color || !color.startsWith("#")) return "";
  if (color.length === 4) {
    return ("#" + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]).toUpperCase();
  }
  return color.slice(0, 7).toUpperCase();
}

/** Filter out white/near-white, black/near-black, and grays (useless as brand colors). */
function isUnusableColor(hex: string): boolean {
  const c = hex.toUpperCase();
  const exact = new Set([
    "#FFFFFF", "#000000", "#F8F9FA", "#E9ECEF", "#DEE2E6", "#CED4DA",
    "#F5F5F5", "#EEEEEE", "#E0E0E0", "#BDBDBD", "#FAFAFA", "#F0F0F0",
    "#333333", "#666666", "#999999", "#CCCCCC", "#111111", "#222222",
    "#444444", "#555555", "#777777", "#888888", "#AAAAAA", "#BBBBBB",
  ]);
  if (exact.has(c)) return true;
  const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return false;
  const isGray = Math.max(r, g, b) - Math.min(r, g, b) < 20;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum > 0.9) return true; // near white
  if (lum < 0.08) return true; // near black
  if (isGray && lum > 0.3 && lum < 0.7) return true; // mid gray
  return false;
}

function rgbToHex(r: number, g: number, b: number): string {
  return ("#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")).toUpperCase();
}

/**
 * Find product/service page URLs
 */
async function findProductPages(baseUrl: string, $: cheerio.CheerioAPI): Promise<string[]> {
  const productLinks: string[] = [];

  // Check common product/service page patterns
  const commonPaths = [
    '/products', '/shop', '/store', '/catalog',  // E-commerce
    '/features', '/solutions', '/services',      // SaaS/Services
    '/what-we-do', '/offerings'                  // Agency
  ];

  for (const path of commonPaths) {
    const url = new URL(path, baseUrl).href;
    if (await urlExists(url)) {
      productLinks.push(url);
      break; // Just get the first one that exists
    }
  }

  // Find links with product/service keywords (limit to 5)
  $('a[href*="product"], a[href*="shop"], a[href*="item"], a[href*="feature"], a[href*="solution"], a[href*="service"]').each((i, el) => {
    if (productLinks.length >= 5) return false; // Break early
    const href = $(el).attr('href');
    if (href && !href.includes('#') && !productLinks.includes(href)) {
      try {
        productLinks.push(new URL(href, baseUrl).href);
      } catch {
        // Invalid URL, skip
      }
    }
  });

  return productLinks.slice(0, 5);
}

/**
 * Scrape individual product
 */
async function scrapeProduct(url: string): Promise<any> {
  try {
    const html = await fetchWithUserAgent(url);
    const $ = cheerio.load(html);

    const title = (
      $('h1.product-title').text() ||
      $('h1[itemprop="name"]').text() ||
      $('meta[property="og:title"]').attr('content') ||
      $('h1').first().text()
    ).trim();

    const description = (
      $('.product-description').first().text() ||
      $('[itemprop="description"]').first().text() ||
      $('meta[name="description"]').attr('content') ||
      ''
    ).trim().substring(0, 500);

    const priceText = (
      $('.price').first().text() ||
      $('[itemprop="price"]').attr('content') ||
      $('meta[property="product:price:amount"]').attr('content') ||
      ''
    );

    const priceMatch = priceText.match(/[\d,]+\.?\d*/);
    const price = priceMatch ? parseFloat(priceMatch[0].replace(',', '')) : undefined;

    // Extract product image
    const imageSrc = (
      $('meta[property="og:image"]').attr('content') ||
      $('[itemprop="image"]').attr('src') ||
      $('[itemprop="image"]').attr('content') ||
      $('.product-image img').first().attr('src') ||
      $('.product-img img').first().attr('src') ||
      $('img[alt*="product"]').first().attr('src') ||
      $('main img, article img').first().attr('src')
    );

    let image: string | undefined = undefined;
    if (imageSrc) {
      try {
        image = new URL(imageSrc, url).href;
      } catch {
        // Invalid URL
      }
    }

    return title ? { title, description, price, image } : null;
  } catch (error) {
    console.error(`Failed to scrape product ${url}:`, error);
    return null;
  }
}

/**
 * Find blog/news/content page URLs
 */
async function findBlogPages(baseUrl: string, $: cheerio.CheerioAPI): Promise<string[]> {
  const blogLinks: string[] = [];

  // Check common blog/content paths (more comprehensive)
  const commonPaths = [
    '/blog', '/news', '/articles', '/insights',
    '/resources', '/learn', '/content', '/stories',
    '/updates', '/press', '/media', '/knowledge-base'
  ];

  for (const path of commonPaths) {
    const url = new URL(path, baseUrl).href;
    if (await urlExists(url)) {
      blogLinks.push(url);
      break; // Just get the first one
    }
  }

  // Find blog article links (limit to 3)
  $('a[href*="blog"], a[href*="article"], a[href*="post"], a[href*="news"], a[href*="resource"]').each((i, el) => {
    if (blogLinks.length >= 3) return false;
    const href = $(el).attr('href');
    if (href && !href.includes('#') && !blogLinks.includes(href)) {
      try {
        const fullUrl = new URL(href, baseUrl).href;
        // Avoid homepage, pricing, contact pages
        if (!fullUrl.match(/\/(pricing|contact|about|team|careers)$/)) {
          blogLinks.push(fullUrl);
        }
      } catch {
        // Invalid URL, skip
      }
    }
  });

  return blogLinks.slice(0, 3);
}

/**
 * Scrape blog post
 */
async function scrapeBlogPost(url: string): Promise<any> {
  try {
    const html = await fetchWithUserAgent(url);
    const $ = cheerio.load(html);

    // Remove nav, footer, sidebar
    $('nav, footer, aside, .sidebar, .header').remove();

    const title = $('h1').first().text().trim();
    const excerpt = $('meta[name="description"]').attr('content') || '';

    // Get main content
    const main = $('main, article, .content, .post-content, .entry-content').first();
    const content = main.text().replace(/\s+/g, ' ').trim().substring(0, 2000);

    return title ? { title, excerpt, content } : null;
  } catch (error) {
    console.error(`Failed to scrape blog post ${url}:`, error);
    return null;
  }
}

/**
 * Scrape pricing page (for SaaS businesses)
 */
async function scrapePricingPage(baseUrl: string): Promise<Array<{ name: string; price?: string; features: string[] }> | undefined> {
  const paths = ['/pricing', '/plans', '/price', '/buy', '/packages'];

  for (const path of paths) {
    const url = new URL(path, baseUrl).href;
    if (await urlExists(url)) {
      try {
        const html = await fetchWithUserAgent(url);
        const $ = cheerio.load(html);

        const tiers: Array<{ name: string; price?: string; features: string[] }> = [];

        // Look for pricing cards/sections
        $('.pricing-card, .plan, .tier, [class*="pricing"], [class*="plan"]').each((i, el) => {
          if (tiers.length >= 3) return false; // Limit to 3 tiers

          const $el = $(el);

          const name = (
            $el.find('h2, h3, .plan-name, .tier-name, [class*="name"]').first().text() ||
            $el.find('h4').first().text()
          ).trim();

          const price = (
            $el.find('[class*="price"], .cost, .amount').first().text() ||
            $el.text().match(/\$\d+/)?.[0]
          );

          const features: string[] = [];
          $el.find('li, [class*="feature"]').each((j, feat) => {
            if (features.length >= 5) return false; // Max 5 features per tier
            const text = $(feat).text().trim();
            if (text && text.length > 3) {
              features.push(text.substring(0, 100));
            }
          });

          if (name && (price || features.length > 0)) {
            tiers.push({ name, price, features });
          }
        });

        if (tiers.length > 0) {
          return tiers;
        }
      } catch (error) {
        console.error(`Failed to scrape pricing page ${url}:`, error);
      }
    }
  }

  return undefined;
}

/**
 * Find services offered (for agencies/service businesses)
 */
async function findServices(baseUrl: string, $: cheerio.CheerioAPI): Promise<string[] | undefined> {
  const services: string[] = [];

  // Look for services section on homepage
  $('[class*="service"], [class*="offering"], [class*="what-we-do"]').each((i, el) => {
    if (services.length >= 5) return false;
    const $el = $(el);
    const title = $el.find('h2, h3, h4, .title, [class*="title"]').first().text().trim();
    if (title && title.length > 3 && title.length < 100) {
      services.push(title);
    }
  });

  // Try services page if not found on homepage
  if (services.length === 0) {
    const servicePaths = ['/services', '/what-we-do', '/solutions', '/offerings'];
    for (const path of servicePaths) {
      const url = new URL(path, baseUrl).href;
      if (await urlExists(url)) {
        try {
          const html = await fetchWithUserAgent(url);
          const $ = cheerio.load(html);

          $('h2, h3, .service-name, [class*="service"] h3').each((i, el) => {
            if (services.length >= 5) return false;
            const text = $(el).text().trim();
            if (text && text.length > 3 && text.length < 100) {
              services.push(text);
            }
          });

          if (services.length > 0) break;
        } catch (error) {
          console.error(`Failed to scrape services ${url}:`, error);
        }
      }
    }
  }

  return services.length > 0 ? services : undefined;
}

/**
 * Scrape about page
 */
async function scrapeAboutPage(baseUrl: string): Promise<string | undefined> {
  const paths = ['/about', '/about-us', '/our-story', '/mission', '/company', '/who-we-are'];

  for (const path of paths) {
    const url = new URL(path, baseUrl).href;
    if (await urlExists(url)) {
      try {
        const html = await fetchWithUserAgent(url);
        const $ = cheerio.load(html);

        // Remove nav, footer, header
        $('nav, footer, header, .header, .navigation').remove();

        const main = $('main, article, .about, .content, [class*="about"]').first();
        const text = main.text().replace(/\s+/g, ' ').trim().substring(0, 2000);
        return text || undefined;
      } catch (error) {
        console.error(`Failed to scrape about page ${url}:`, error);
      }
    }
  }

  return undefined;
}

/**
 * Check if URL exists
 */
async function urlExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'FlowMintBot/1.0',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
