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
 * Extract hero image (main image on homepage)
 */
function extractHeroImage($: cheerio.CheerioAPI, baseUrl: string): string | undefined {
  try {
    // Try common hero image selectors
    const heroSelectors = [
      'img[class*="hero"]',
      '[class*="hero"] img',
      '[class*="banner"] img',
      'img[class*="banner"]',
      '[class*="splash"] img',
      'section:first-of-type img',
      'header img:not([class*="logo"])',
    ];

    for (const selector of heroSelectors) {
      const img = $(selector).first();
      const src = img.attr('src') || img.attr('data-src');
      if (src && !src.includes('logo') && !src.includes('icon')) {
        return new URL(src, baseUrl).href;
      }
    }

    // Fallback: first large image (skip tiny images like logos)
    const firstImg = $('img').first();
    const src = firstImg.attr('src') || firstImg.attr('data-src');
    if (src) {
      return new URL(src, baseUrl).href;
    }
  } catch (error) {
    // Invalid URL, skip
  }
  return undefined;
}

/**
 * Extract lifestyle/marketing images from homepage
 */
function extractLifestyleImages($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const images: string[] = [];

  try {
    // Look for images in common sections (skip header/footer/nav)
    $('main img, section img, article img').each((i, el) => {
      if (images.length >= 5) return false; // Limit to 5

      const $img = $(el);
      const src = $img.attr('src') || $img.attr('data-src');

      // Skip small images (likely icons/logos)
      const width = $img.attr('width');
      const height = $img.attr('height');
      if (width && height && (parseInt(width) < 200 || parseInt(height) < 200)) {
        return;
      }

      // Skip logo/icon images
      const alt = $img.attr('alt')?.toLowerCase() || '';
      const srcLower = src?.toLowerCase() || '';
      if (
        alt.includes('logo') ||
        alt.includes('icon') ||
        srcLower.includes('logo') ||
        srcLower.includes('icon') ||
        srcLower.includes('favicon')
      ) {
        return;
      }

      if (src && !images.includes(src)) {
        try {
          images.push(new URL(src, baseUrl).href);
        } catch {
          // Invalid URL, skip
        }
      }
    });
  } catch (error) {
    // Error parsing, return what we have
  }

  return images;
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
