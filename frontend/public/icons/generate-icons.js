#!/usr/bin/env node

/**
 * Simple icon generator for PWA
 * Creates PNG icons from a base SVG template
 *
 * Usage: node generate-icons.js
 * Requires: npm install sharp
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create a simple SVG template
const baseSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="512" height="512" fill="#4F46E5"/>

  <!-- Rounded corners effect with circle background -->
  <circle cx="256" cy="256" r="240" fill="#4F46E5"/>

  <!-- Car icon (simple representation) -->
  <g transform="translate(256, 256)">
    <!-- Car body -->
    <rect x="-80" y="-20" width="160" height="60" rx="10" fill="white" opacity="0.9"/>

    <!-- Car top -->
    <rect x="-50" y="-45" width="100" height="30" rx="8" fill="white" opacity="0.9"/>

    <!-- Left wheel -->
    <circle cx="-60" cy="50" r="20" fill="white" opacity="0.9"/>
    <circle cx="-60" cy="50" r="12" fill="#4F46E5"/>

    <!-- Right wheel -->
    <circle cx="60" cy="50" r="20" fill="white" opacity="0.9"/>
    <circle cx="60" cy="50" r="12" fill="#4F46E5"/>

    <!-- Windows -->
    <rect x="-40" y="-40" width="30" height="25" rx="4" fill="#E0E7FF" opacity="0.7"/>
    <rect x="10" y="-40" width="30" height="25" rx="4" fill="#E0E7FF" opacity="0.7"/>
  </g>

  <!-- Branding text -->
  <text x="256" y="470" font-family="Arial, sans-serif" font-size="24" font-weight="bold"
        text-anchor="middle" fill="white" opacity="0.8">VIN</text>
</svg>`;

// Sizes needed from manifest.json
const sizes = [72, 96, 128, 144, 192, 384, 512];

console.log('📦 Generating PWA icons...\n');

const svgBuffer = Buffer.from(baseSvg);

// Generate regular icons
for (const size of sizes) {
  const filename = `icon-${size}x${size}.png`;
  const filepath = path.join(__dirname, filename);

  try {
    await sharp(svgBuffer)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 79, g: 70, b: 229, alpha: 1 }
      })
      .png()
      .toFile(filepath);
    console.log(`✅ Created ${filename}`);
  } catch (err) {
    console.error(`❌ Failed to create ${filename}:`, err.message);
  }
}

// Generate maskable versions
console.log('\n📱 Creating maskable versions...\n');

for (const size of [192, 512]) {
  const filename = `icon-${size}x${size}-maskable.png`;
  const filepath = path.join(__dirname, filename);

  try {
    await sharp(svgBuffer)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 79, g: 70, b: 229, alpha: 1 }
      })
      .png()
      .toFile(filepath);
    console.log(`✅ Created ${filename}`);
  } catch (err) {
    console.error(`❌ Failed to create ${filename}:`, err.message);
  }
}

console.log('\n✨ Icon generation complete!\n');
