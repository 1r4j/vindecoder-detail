/**
 * Font Detection & OCR Optimization
 * Detects automotive label fonts and applies manufacturer-specific corrections
 *
 * This improves OCR accuracy by recognizing specific fonts used by manufacturers
 * and applying tailored preprocessing and error correction strategies.
 */

// Manufacturer font database
export const MANUFACTURER_FONTS = {
  // German manufacturers (W prefix codes)
  'Mercedes-Benz': {
    fonts: ['OCR-A', 'Courier New'],
    characteristics: { monospaced: true, contrast: 'high', country: 'DE' },
    commonConfusions: { '0': 'O', '1': 'I', '5': 'S', 'B': '8' },
    errorCorrection: { 'O': '0', 'I': '1', 'l': '1', 'S': '5', 'Z': '2', 'B': '8' },
    vinPattern: /^WD[DB][A-Z0-9]{14}$/,
    wmiCodes: ['WDB', 'WDD']
  },
  'BMW': {
    fonts: ['Helvetica', 'OCR-B'],
    characteristics: { monospaced: false, contrast: 'high', country: 'DE' },
    commonConfusions: { '0': 'O', '1': 'I', 'L': '1' },
    errorCorrection: { 'O': '0', 'I': '1', 'l': '1' },
    vinPattern: /^WBS?[A-Z0-9]{14}$/,
    wmiCodes: ['WBA', 'WBS']
  },
  'Audi': {
    fonts: ['Courier New', 'OCR-A'],
    characteristics: { monospaced: true, contrast: 'high', country: 'DE' },
    commonConfusions: { '0': 'O', '5': 'S', 'E': 'F' },
    errorCorrection: { 'O': '0', 'I': '1', 'l': '1', 'S': '5' },
    vinPattern: /^WAU[A-Z0-9]{14}$/,
    wmiCodes: ['WAU']
  },
  'Porsche': {
    fonts: ['Courier', 'Consolas'],
    characteristics: { monospaced: true, contrast: 'very_high', country: 'DE', stamped: true },
    commonConfusions: { '0': 'O', 'I': '1', 'l': '1' },
    errorCorrection: { 'O': '0', 'I': '1', 'l': '1' },
    vinPattern: /^WP0[A-Z0-9]{14}$/,
    wmiCodes: ['WP0']
  },
  'Volkswagen': {
    fonts: ['Courier New', 'Courier'],
    characteristics: { monospaced: true, contrast: 'high', country: 'DE' },
    commonConfusions: { '0': 'O', 'D': 'O', 'P': 'R' },
    errorCorrection: { 'O': '0', 'I': '1', 'l': '1' },
    vinPattern: /^(3VW|WVW)[A-Z0-9]{14}$/,
    wmiCodes: ['3VW', 'WVW']
  },
  'Opel': {
    fonts: ['Courier New', 'Courier'],
    characteristics: { monospaced: true, contrast: 'high', country: 'DE' },
    commonConfusions: { '0': 'O', 'I': '1', 'l': '1' },
    errorCorrection: { 'O': '0', 'I': '1', 'l': '1' },
    vinPattern: /^W0L[A-Z0-9]{14}$/,
    wmiCodes: ['W0L']
  },

  // Japanese manufacturers
  'Toyota': {
    fonts: ['Courier New', 'Dot Matrix'],
    characteristics: { monospaced: true, contrast: 'very_high', country: 'JP', style: 'printed' },
    commonConfusions: { 'K': 'X', 'B': '8', '0': 'O' },
    errorCorrection: { 'O': '0', 'I': '1', 'l': '1', 'S': '5', 'Z': '2', 'B': '8' },
    vinPattern: /^JTD[A-Z0-9]{14}$/
  },
  'Nissan': {
    fonts: ['Courier New', 'Courier'],
    characteristics: { monospaced: true, contrast: 'medium_high', country: 'JP' },
    commonConfusions: { '0': 'O', 'J': 'I', 'M': 'W' },
    errorCorrection: { 'O': '0', 'I': '1', 'l': '1', 'S': '5' },
    vinPattern: /^JN1[A-Z0-9]{14}$/
  },
  'Honda': {
    fonts: ['Courier New', 'Helvetica'],
    characteristics: { monospaced: true, contrast: 'high', country: 'JP' },
    commonConfusions: { 'H': 'N', '5': 'S', 'M': 'W' },
    errorCorrection: { 'O': '0', 'I': '1', 'l': '1', 'S': '5' },
    vinPattern: /^JHM[A-Z0-9]{14}$/
  },
  'Mazda': {
    fonts: ['Courier New'],
    characteristics: { monospaced: true, contrast: 'medium', country: 'JP', material: 'aluminum' },
    commonConfusions: { 'J': 'I', '1': '7', 'M': 'W' },
    errorCorrection: { 'O': '0', 'I': '1', 'l': '1', 'S': '5', 'Z': '2' },
    vinPattern: /^JM1[A-Z0-9]{14}$/
  },
  'Subaru': {
    fonts: ['Courier', 'OCR-A'],
    characteristics: { monospaced: true, contrast: 'high', country: 'JP', stamped: true },
    commonConfusions: { 'G': '0', '4': 'A', 'S': '5' },
    errorCorrection: { 'O': '0', 'I': '1', 'l': '1', 'S': '5', 'Z': '2' },
    vinPattern: /^JF1[A-Z0-9]{14}$/
  },
  'Mitsubishi': {
    fonts: ['Courier New'],
    characteristics: { monospaced: true, contrast: 'medium_high', country: 'JP' },
    commonConfusions: { 'E': 'F', 'L': '1', 'M': 'W' },
    errorCorrection: { 'O': '0', 'I': '1', 'l': '1', 'S': '5' },
    vinPattern: /^MME[A-Z0-9]{14}$/
  },
  'Suzuki': {
    fonts: ['Courier New', 'Courier'],
    characteristics: { monospaced: true, contrast: 'high', country: 'JP' },
    commonConfusions: { '2': 'Z', 'S': '5', 'C': 'G' },
    errorCorrection: { 'O': '0', 'I': '1', 'l': '1', 'S': '5', 'Z': '2' },
    vinPattern: /^ZC3[A-Z0-9]{14}$/
  },

  // American manufacturers
  'Ford': {
    fonts: ['Courier New', 'Courier'],
    characteristics: { monospaced: true, contrast: 'very_high', country: 'US' },
    commonConfusions: { 'F': 'E', 'M': 'W', '5': 'S', 'K': 'X' },
    errorCorrection: { 'O': '0', 'I': '1', 'l': '1', 'S': '5', 'Z': '2', 'B': '8' },
    vinPattern: /^1FM[A-Z0-9]{14}$/
  },
  'Chevrolet': {
    fonts: ['Courier New'],
    characteristics: { monospaced: true, contrast: 'high', country: 'US' },
    commonConfusions: { 'K': 'X', 'P': 'R', 'G': '0' },
    errorCorrection: { 'O': '0', 'I': '1', 'l': '1', 'S': '5', 'Z': '2' },
    vinPattern: /^1GKK[A-Z0-9]{13}$/
  },
  'Chrysler': {
    fonts: ['Courier New', 'Courier'],
    characteristics: { monospaced: true, contrast: 'high', country: 'US' },
    commonConfusions: { 'C': 'G', 'H': 'N', 'X': 'K', 'J': 'I' },
    errorCorrection: { 'O': '0', 'I': '1', 'l': '1', 'S': '5', 'Z': '2' },
    vinPattern: /^1C4H[A-Z0-9]{13}$/
  },
  'Tesla': {
    fonts: ['Courier New'],
    characteristics: { monospaced: true, contrast: 'very_high', country: 'US', modern: true },
    commonConfusions: { '5': 'S', '1': 'I', 'Y': 'V' },
    errorCorrection: { 'O': '0', 'I': '1', 'l': '1', 'S': '5', 'Z': '2' },
    vinPattern: /^5YJ[A-Z0-9]{14}$/
  },

  // European manufacturers
  'Volvo': {
    fonts: ['Courier', 'OCR-A'],
    characteristics: { monospaced: true, contrast: 'high', country: 'SE' },
    commonConfusions: { 'V': 'Y', '5': 'S', '8': 'B' },
    errorCorrection: { 'O': '0', 'I': '1', 'l': '1', 'S': '5', 'Z': '2' },
    vinPattern: /^YV1[A-Z0-9]{14}$/
  },
  'Fiat': {
    fonts: ['Courier', 'Arial'],
    characteristics: { monospaced: true, contrast: 'medium_high', country: 'IT' },
    commonConfusions: { 'Z': '2', 'A': '4', 'S': '5' },
    errorCorrection: { 'O': '0', 'I': '1', 'l': '1', 'S': '5', 'Z': '2' },
    vinPattern: /^ZAR[A-Z0-9]{14}$/
  }
};

/**
 * Detect which manufacturer based on VIN pattern
 */
export const detectManufacturerByVIN = (vin) => {
  if (!vin || vin.length !== 17) return null;

  for (const [manufacturer, data] of Object.entries(MANUFACTURER_FONTS)) {
    if (data.vinPattern.test(vin)) {
      return { manufacturer, data };
    }
  }

  return null;
};

/**
 * Analyze image characteristics to detect font type
 */
export const analyzeImageCharacteristics = (imageData) => {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  // Calculate characteristics
  let darkPixels = 0, lightPixels = 0;
  let verticalLineCount = 0, horizontalLineCount = 0;
  let strokeVariance = 0;

  // Analyze pixel distribution
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (gray < 100) darkPixels++;
    if (gray > 200) lightPixels++;
  }

  // Detect monospaced by looking for uniform character spacing
  const isMonospaced = detectMonospacing(imageData);

  // Detect material type
  const material = detectMaterial(imageData);

  // Calculate contrast
  const contrastRatio = lightPixels / (darkPixels + 1);

  return {
    monospaced: isMonospaced,
    contrast: contrastRatio > 3 ? 'very_high' : contrastRatio > 1.5 ? 'high' : 'medium',
    material: material,
    darkRatio: darkPixels / (data.length / 4),
    lightRatio: lightPixels / (data.length / 4)
  };
};

/**
 * Detect if text is monospaced by analyzing character widths
 */
const detectMonospacing = (imageData) => {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  // Simple heuristic: in monospaced text, characters have consistent column patterns
  // Count dark pixel columns
  let columnDarkness = new Array(width).fill(0);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      if (gray < 150) columnDarkness[x]++;
    }
  }

  // In monospaced text, there should be regular patterns of dark/light columns
  let darkColumns = 0;
  for (let i = 1; i < width - 1; i++) {
    if (columnDarkness[i] > height * 0.3 && columnDarkness[i] > columnDarkness[i - 1] * 0.9 && columnDarkness[i] > columnDarkness[i + 1] * 0.9) {
      darkColumns++;
    }
  }

  const expectedPattern = width / 25; // Rough estimate
  const isRegular = Math.abs(darkColumns - expectedPattern) < expectedPattern * 0.5;

  return isRegular;
};

/**
 * Detect material type (printed, stamped, embedded)
 */
const detectMaterial = (imageData) => {
  const data = imageData.data;

  // Analyze edge sharpness and shadow patterns
  let edgePixels = 0;
  for (let i = 0; i < data.length - 4; i += 4) {
    const gray1 = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const gray2 = 0.299 * data[i + 4] + 0.587 * data[i + 5] + 0.114 * data[i + 6];
    if (Math.abs(gray1 - gray2) > 100) edgePixels++;
  }

  const edgeRatio = edgePixels / (data.length / 4);

  if (edgeRatio > 0.3) return 'stamped'; // Sharp edges typical of stamped metal
  if (edgeRatio > 0.15) return 'printed'; // Medium edges for printed labels
  return 'embedded'; // Low edges for embossed/embedded

};

/**
 * Apply font-specific OCR preprocessing
 */
export const applyFontSpecificPreprocessing = (imageData, manufacturer) => {
  if (!manufacturer) return imageData;

  const fontData = MANUFACTURER_FONTS[manufacturer];
  if (!fontData) return imageData;

  const data = imageData.data;

  // Apply preprocessing based on characteristics
  if (fontData.characteristics.stamped) {
    // Metal stamped: enhance edges, remove shadows
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      // Binary conversion for sharp edges
      const binary = gray > 128 ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = binary;
    }
  } else if (fontData.characteristics.material === 'aluminum') {
    // Aluminum labels: handle reflections
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      // Boost contrast for low-contrast aluminum
      const boosted = Math.max(0, Math.min(255, (gray - 100) * 2));
      data[i] = data[i + 1] = data[i + 2] = boosted;
    }
  } else {
    // Printed labels: maximize contrast
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      // Binary threshold
      const binary = gray > 130 ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = binary;
    }
  }

  return imageData;
};

/**
 * Apply font-specific error correction
 */
export const applyFontSpecificCorrections = (text, manufacturer) => {
  if (!manufacturer) return text;

  const fontData = MANUFACTURER_FONTS[manufacturer];
  if (!fontData || !fontData.errorCorrection) return text;

  let corrected = text.toUpperCase();

  // Apply manufacturer-specific corrections
  for (const [wrong, correct] of Object.entries(fontData.errorCorrection)) {
    corrected = corrected.replace(new RegExp(wrong, 'g'), correct);
  }

  // Additional context-specific corrections
  if (manufacturer === 'Ford') {
    // Ford uses distinctive "FM" pattern
    corrected = corrected.replace(/FN/g, 'FM');
    corrected = corrected.replace(/FH/g, 'FM');
  } else if (manufacturer === 'Chevrolet') {
    // Chevy uses "GKK" pattern - ensure double K
    corrected = corrected.replace(/GK(?!K)/g, 'GKK');
  } else if (manufacturer === 'Chrysler') {
    // Chrysler uses "C4H" pattern
    corrected = corrected.replace(/CAH/g, 'C4H');
  }

  return corrected;
};

/**
 * Comprehensive font detection and optimization
 */
export const detectAndOptimizeForFont = async (imageData, detectedVIN) => {
  // First, try to detect manufacturer from VIN
  let manufacturer = null;
  if (detectedVIN) {
    const result = detectManufacturerByVIN(detectedVIN);
    if (result) manufacturer = result.manufacturer;
  }

  // If not found, analyze image characteristics
  if (!manufacturer) {
    const characteristics = analyzeImageCharacteristics(imageData);
    // Could add image-based manufacturer detection here
  }

  if (!manufacturer) {
    return { original: imageData, manufacturer: null };
  }

  console.log(`🏭 Detected manufacturer: ${manufacturer}`);
  console.log(`📝 Font: ${MANUFACTURER_FONTS[manufacturer].fonts.join(', ')}`);

  // Apply font-specific preprocessing
  const optimized = applyFontSpecificPreprocessing(imageData, manufacturer);

  return {
    original: imageData,
    optimized: optimized,
    manufacturer: manufacturer,
    fontData: MANUFACTURER_FONTS[manufacturer]
  };
};

export default {
  MANUFACTURER_FONTS,
  detectManufacturerByVIN,
  analyzeImageCharacteristics,
  applyFontSpecificPreprocessing,
  applyFontSpecificCorrections,
  detectAndOptimizeForFont
};
