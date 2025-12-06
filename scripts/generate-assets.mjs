import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const logoPath = path.join(publicDir, 'logo-icon.png');

async function generateFavicons() {
  console.log('Generating favicons...');

  // favicon-32x32.png
  await sharp(logoPath)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon-32x32.png'));
  console.log('  Created favicon-32x32.png');

  // favicon-16x16.png
  await sharp(logoPath)
    .resize(16, 16)
    .png()
    .toFile(path.join(publicDir, 'favicon-16x16.png'));
  console.log('  Created favicon-16x16.png');

  // apple-touch-icon.png (180x180)
  await sharp(logoPath)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('  Created apple-touch-icon.png');

  // favicon.ico (32x32 as PNG, browsers handle it fine)
  await sharp(logoPath)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));
  console.log('  Created favicon.ico');
}

async function generateOGImage() {
  console.log('Generating OG image...');

  // Create a 1200x630 image with FlowMint branding
  const width = 1200;
  const height = 630;

  // FlowMint brand colors
  const mintFresh = '#10B981';
  const slate900 = '#0F172A';
  const slate800 = '#1E293B';

  // Resize logo to fit nicely in the OG image
  const logoSize = 150;
  const resizedLogo = await sharp(logoPath)
    .resize(logoSize, logoSize)
    .png()
    .toBuffer();

  // Create the OG image with gradient background and logo
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${slate900}"/>
          <stop offset="100%" style="stop-color:${slate800}"/>
        </linearGradient>
        <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:${mintFresh}"/>
          <stop offset="100%" style="stop-color:#059669"/>
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="100%" height="100%" fill="url(#bg)"/>

      <!-- Accent line at top -->
      <rect x="0" y="0" width="100%" height="6" fill="url(#accent)"/>

      <!-- Text: FlowMint -->
      <text x="600" y="320" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="72" font-weight="700" fill="white" text-anchor="middle">FlowMint</text>

      <!-- Tagline -->
      <text x="600" y="400" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="32" fill="#94A3B8" text-anchor="middle">AI-Powered Email Flows for Shopify</text>

      <!-- Decorative circles -->
      <circle cx="100" cy="530" r="80" fill="${mintFresh}" opacity="0.1"/>
      <circle cx="1100" cy="100" r="120" fill="${mintFresh}" opacity="0.1"/>

      <!-- Bottom URL -->
      <text x="600" y="580" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="24" fill="${mintFresh}" text-anchor="middle">flowmint.me</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(publicDir, 'og-image.png'));
  console.log('  Created og-image.png');
}

async function main() {
  try {
    await generateFavicons();
    await generateOGImage();
    console.log('\nAll assets generated successfully!');
  } catch (error) {
    console.error('Error generating assets:', error);
    process.exit(1);
  }
}

main();
