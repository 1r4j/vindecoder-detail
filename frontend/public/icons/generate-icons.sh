#!/bin/bash

# This script generates PWA icons from a base SVG
# For now, we'll create simple placeholder SVGs

# Create a simple icon SVG template
create_icon_svg() {
  local size=$1
  local file="icon-${size}x${size}.png"
  
  cat > "${file%.png}.svg" << 'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4F46E5;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#06B6D4;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="192" height="192" fill="url(#grad)"/>
  <text x="96" y="96" font-size="80" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle" font-family="Arial">🚗</text>
</svg>
SVG
}

# Create icons for common sizes
for size in 72 96 128 144 152 192 384 512; do
  create_icon_svg $size
done

echo "Icon templates created. Use a tool like ImageMagick or online converter to convert SVGs to PNGs"
