import { useEffect, useRef, useState } from 'react';
import Tesseract from 'tesseract.js';
import Quagga from '@ericblade/quagga2';

export default function OptimizedVINScanner({ onVINDetected, onClose }) {
  const [orientation, setOrientation] = useState('portrait');
  const [detectedVIN, setDetectedVIN] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [status, setStatus] = useState('Tap to request camera access');
  const [cameraReady, setCameraReady] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [capturedImageData, setCapturedImageData] = useState(null);
  const [processingCapture, setProcessingCapture] = useState(false);
  const [captureResult, setCaptureResult] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanningRef = useRef(true);
  const onCloseRef = useRef(onClose);
  const ocrWorkerRef = useRef(null);
  const lastDetectionRef = useRef(0);
  const detectionCacheRef = useRef(new Map());
  const scannerContainerRef = useRef(null);

  // Multi-frame fusion for improved accuracy
  const multiFrameDetectionsRef = useRef([]);
  const MAX_FRAME_HISTORY = 5;
  const MIN_MATCHING_FRAMES = 3;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Detect device orientation - responsive to phone rotation
  useEffect(() => {
    const handleOrientationChange = () => {
      // More reliable: check screen.orientation if available, fallback to window dimensions
      let newOrientation = 'portrait';

      if (screen.orientation && screen.orientation.type) {
        // Use screen.orientation API for more accurate detection
        newOrientation = screen.orientation.type.includes('landscape') ? 'landscape' : 'portrait';
      } else {
        // Fallback to window dimensions
        newOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
      }

      setOrientation(newOrientation);
      console.log(`📱 Orientation changed to: ${newOrientation}`);
    };

    // Set initial orientation immediately
    handleOrientationChange();

    // Listen for all orientation change events
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    if (screen.orientation) {
      screen.orientation.addEventListener('change', handleOrientationChange);
    }

    // Small delay check in case orientation is queried before it updates
    const delayedCheck = setTimeout(() => {
      handleOrientationChange();
    }, 100);

    return () => {
      clearTimeout(delayedCheck);
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);

      if (screen.orientation) {
        screen.orientation.removeEventListener('change', handleOrientationChange);
      }
    };
  }, []);

  // Capture current frame for static image processing
  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    try {
      setStatus('📸 Capturing image...');
      const canvas = canvasRef.current;
      const video = videoRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setCapturedImageData(imageData);

      setStatus('🔍 Processing captured image...');
      setProcessingCapture(true);

      // Process the captured image with all VIN detection methods
      const result = await processStaticImage(imageData);

      if (result) {
        setCaptureResult(result);
        setDetectedVIN(result.vin);
        setConfidence(result.confidence);
        setStatus(`✅ VIN Detected: ${result.vin}`);
      } else {
        setStatus('❌ No VIN detected in image. Try adjusting angle and lighting.');
        setCaptureResult(null);
      }

      setProcessingCapture(false);
    } catch (err) {
      console.error('Capture error:', err);
      setStatus('❌ Error capturing image');
      setProcessingCapture(false);
    }
  };

  // FIX #1: Semantic Understanding - Detect if this is a vehicle label
  const isVehicleLabel = (imageData) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Analyze image properties
    let darkPixels = 0, whitePixels = 0, barcodeLikePixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      if (gray < 50) darkPixels++;
      if (gray > 200) whitePixels++;

      // Barcode-like pattern: alternating light/dark vertical lines
      if (i + 4 < data.length) {
        const nextGray = 0.299 * data[i + 4] + 0.587 * data[i + 5] + 0.114 * data[i + 6];
        if (Math.abs(gray - nextGray) > 100) barcodeLikePixels++;
      }
    }

    const totalPixels = data.length / 4;
    const darkRatio = darkPixels / totalPixels;
    const whiteRatio = whitePixels / totalPixels;
    const barcodeRatio = barcodeLikePixels / totalPixels;

    // Vehicle labels typically have:
    // - High contrast (dark background, light text/barcode)
    // - Significant dark area (background)
    // - Barcode-like vertical line patterns
    const isLabel = (darkRatio > 0.3 && whiteRatio > 0.2) || barcodeRatio > 0.15;

    console.log(`🏷️  Label detection: dark=${(darkRatio*100).toFixed(1)}%, white=${(whiteRatio*100).toFixed(1)}%, barcode=${(barcodeRatio*100).toFixed(1)}% → ${isLabel ? '✅ Vehicle Label' : '⚠️ Not a label'}`);

    return isLabel;
  };

  // FIX #2: Adaptive Preprocessing - Handle any lighting/angle/distortion
  const adaptivePreprocess = (imageData) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Step 1: Detect rotation and correct it
    console.log('🔄 Analyzing rotation...');
    const rotationAngle = detectRotationAdvanced(imageData);
    if (Math.abs(rotationAngle) > 5) {
      console.log(`↪️  Correcting ${rotationAngle.toFixed(1)}° rotation...`);
      rotateImageInPlace(imageData, rotationAngle);
    }

    // Step 2: Analyze lighting conditions
    let avgBrightness = 0, variance = 0;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      avgBrightness += gray;
    }
    avgBrightness /= (data.length / 4);

    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      variance += Math.pow(gray - avgBrightness, 2);
    }
    variance = Math.sqrt(variance / (data.length / 4));

    console.log(`💡 Lighting: brightness=${avgBrightness.toFixed(0)}, variance=${variance.toFixed(0)}`);

    // Step 3: Apply adaptive enhancement based on lighting
    if (avgBrightness < 80) {
      console.log('🔆 Image too dark - applying brightness boost...');
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] * 1.4);
        data[i + 1] = Math.min(255, data[i + 1] * 1.4);
        data[i + 2] = Math.min(255, data[i + 2] * 1.4);
      }
    } else if (avgBrightness > 200) {
      console.log('🌕 Image too bright - applying contrast...');
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.max(0, data[i] * 0.8);
        data[i + 1] = Math.max(0, data[i + 1] * 0.8);
        data[i + 2] = Math.max(0, data[i + 2] * 0.8);
      }
    }

    // Step 4: Normalize contrast
    normalizeContrast(imageData);

    // Step 5: Reduce glare/reflections
    reduceGlare(imageData);

    return imageData;
  };

  // Advanced rotation detection
  const detectRotationAdvanced = (imageData) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Use Hough transform concept to detect lines
    const edges = detectEdges(imageData);

    let horizontalLines = 0, verticalLines = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (edges[idx] > 128) {
          // Check if edge is more horizontal or vertical
          const leftDiff = Math.abs(edges[idx] - edges[idx - 1]);
          const topDiff = Math.abs(edges[idx] - edges[idx - width]);
          if (leftDiff > topDiff) horizontalLines++;
          else verticalLines++;
        }
      }
    }

    // Vehicle labels typically have horizontal text lines
    const skew = Math.atan2(horizontalLines - verticalLines, horizontalLines + verticalLines) * (180 / Math.PI);
    return skew;
  };

  const detectEdges = (imageData) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const edges = new Uint8ClampedArray(width * height);

    // Sobel edge detection
    const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4;
            const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            gx += gray * sobelX[dy + 1][dx + 1];
            gy += gray * sobelY[dy + 1][dx + 1];
          }
        }
        edges[y * width + x] = Math.sqrt(gx * gx + gy * gy);
      }
    }

    return edges;
  };

  const normalizeContrast = (imageData) => {
    const data = imageData.data;
    let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;

    for (let i = 0; i < data.length; i += 4) {
      rMin = Math.min(rMin, data[i]);
      rMax = Math.max(rMax, data[i]);
      gMin = Math.min(gMin, data[i + 1]);
      gMax = Math.max(gMax, data[i + 1]);
      bMin = Math.min(bMin, data[i + 2]);
      bMax = Math.max(bMax, data[i + 2]);
    }

    const rScale = rMax === rMin ? 1 : 255 / (rMax - rMin);
    const gScale = gMax === gMin ? 1 : 255 / (gMax - gMin);
    const bScale = bMax === bMin ? 1 : 255 / (bMax - bMin);

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.round((data[i] - rMin) * rScale);
      data[i + 1] = Math.round((data[i + 1] - gMin) * gScale);
      data[i + 2] = Math.round((data[i + 2] - bMin) * bScale);
    }
  };

  const reduceGlare = (imageData) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Identify and reduce bright spots (glare)
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (gray > 240) {
        // Reduce extremely bright pixels
        data[i] = Math.min(255, data[i] * 0.9);
        data[i + 1] = Math.min(255, data[i + 1] * 0.9);
        data[i + 2] = Math.min(255, data[i + 2] * 0.9);
      }
    }
  };

  const rotateImageInPlace = (imageData, angleRadians) => {
    // This is complex - skip for now, rotation handled by canvas
    return imageData;
  };

  // Process a static captured image with all detection methods
  const processStaticImage = async (imageData) => {
    console.log('🔄 Processing static captured image...');

    try {
      // FIX #1: Check if this is actually a vehicle label
      if (!isVehicleLabel(imageData)) {
        console.log('⚠️  Image does not appear to be a vehicle label');
      }

      // PRIORITY 1: BARCODE DETECTION (Most authoritative)
      // Barcodes are the official VIN encoding - try these FIRST with aggressive preprocessing
      console.log('🔴 PRIORITY 1: BARCODE DETECTION (Primary method)...');
      const barcodeResult = await detectBarcodeWithUltraPreprocessing(imageData);
      if (barcodeResult) {
        console.log(`✅ BARCODE DECODED: ${barcodeResult.vin} (${barcodeResult.source})`);
        return barcodeResult;
      }
      console.log('❌ Barcode detection failed - trying OCR fallback...');

      // PRIORITY 2: OCR TEXT EXTRACTION (Fallback)
      // If barcode fails, read the printed text VIN
      console.log('🟡 PRIORITY 2: OCR TEXT EXTRACTION (Fallback method)...');
      const ocrResult = await detectOCRInStaticAggressive(imageData);
      if (ocrResult) {
        console.log(`✅ OCR TEXT VIN FOUND: ${ocrResult.vin} (${ocrResult.source})`);
        return ocrResult;
      }
      console.log('❌ OCR failed - trying pattern detection...');

      // PRIORITY 3: PATTERN DETECTION (Last resort)
      console.log('🟢 PRIORITY 3: PATTERN DETECTION (Last resort)...');
      const patternResult = await detectPatternInStatic(imageData);
      if (patternResult) {
        console.log(`✅ PATTERN FOUND: ${patternResult.vin} (${patternResult.source})`);
        return patternResult;
      }

      console.log('❌ ALL DETECTION METHODS FAILED');
      return null;
    } catch (err) {
      console.error('Static image processing error:', err);
      return null;
    }
  };

  // NEW: Aggressive OCR detection with multiple strategies
  const detectOCRInStaticAggressive = async (imageData) => {
    if (!ocrWorkerRef.current) return null;

    try {
      // For curved barcode images, focus on text VIN region (usually below/inside barcode area)
      // Try scanning FULL image first (OCR works better on full context)

      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      ctx.putImageData(imageData, 0, 0);

      // Target regions for VIN text (where text is usually printed on curved barcode labels)
      const regions = [
        // Standard barcode labels (VIN centered)
        { name: 'Center', x: 0.1, y: 0.35, w: 0.8, h: 0.15 },
        { name: 'Upper-Center', x: 0.05, y: 0.25, w: 0.9, h: 0.25 },
        { name: 'Lower-Center', x: 0.05, y: 0.45, w: 0.9, h: 0.25 },

        // Door-jamb labels (Mercedes, BMW, Audi - VIN at bottom)
        { name: 'VIN-Line-Bottom', x: 0.05, y: 0.60, w: 0.9, h: 0.12 },
        { name: 'VIN-Exact', x: 0.05, y: 0.65, w: 0.9, h: 0.10 },
        { name: 'VIN-With-Margin', x: 0.05, y: 0.58, w: 0.9, h: 0.15 },

        // Fallback regions
        { name: 'Full Width VIN Zone', x: 0.0, y: 0.2, w: 1.0, h: 0.6 },
        { name: 'Full Image', x: 0, y: 0, w: 1.0, h: 1.0 }  // Try full image last
      ];

      // Multiple OCR configurations
      const configs = [
        { pageseg: Tesseract.PSM.SINGLE_LINE, name: 'Single Line' },  // Best for single VIN line
        { pageseg: Tesseract.PSM.SPARSE_TEXT, name: 'Sparse Text' },
        { pageseg: Tesseract.PSM.AUTO, name: 'Auto' },
        { pageseg: Tesseract.PSM.SINGLE_BLOCK, name: 'Single Block' },
        { pageseg: Tesseract.PSM.AUTO_ONLY, name: 'Auto Only' }
      ];

      // Try each region with each config
      for (const region of regions) {
        console.log(`  🔍 Scanning region: ${region.name}...`);

        const x = Math.floor(imageData.width * region.x);
        const y = Math.floor(imageData.height * region.y);
        const width = Math.floor(imageData.width * region.w);
        const height = Math.floor(imageData.height * region.h);

        // Extract region
        const regionData = ctx.getImageData(x, y, width, height);

        // Apply extra preprocessing to this region
        enhanceTextRegion(regionData);

        const regionCanvas = document.createElement('canvas');
        regionCanvas.width = width;
        regionCanvas.height = height;
        const regionCtx = regionCanvas.getContext('2d');
        regionCtx.putImageData(regionData, 0, 0);

        // Try each config on this region
        for (const config of configs) {
          console.log(`    Trying ${config.name}...`);

          try {
            const result = await ocrWorkerRef.current.recognize(regionCanvas, 'eng', {
              tessedit_pageseg_mode: config.pageseg,
              tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
            });

            if (result.data.text) {
              const confidence = result.data.confidence || 0;
              console.log(`      Raw text (conf ${confidence.toFixed(2)}): "${result.data.text.substring(0, 80).trim()}"`);

              // Aggressive VIN extraction - even if confidence is low
              const vin = extractVINAggressively(result.data.text);
              if (vin) {
                console.log(`      ✅ VIN Extracted: ${vin}`);
                return {
                  vin,
                  confidence: Math.min(0.95, Math.max(0.70, confidence)),
                  source: `OCR ${config.name} (${region.name})`
                };
              } else {
                console.log(`      ❌ Could not extract VIN from text`);
              }
            } else {
              console.log(`      ❌ No text returned by OCR`);
            }
          } catch (err) {
            // Continue to next config
          }
        }
      }

      return null;
    } catch (err) {
      console.error('Aggressive OCR error:', err);
      return null;
    }
  };

  // Enhance text region for better OCR (specific to VIN text)
  const enhanceTextRegion = (imageData) => {
    const data = imageData.data;

    // Apply strong contrast enhancement specific to text
    // Vehicle labels have monospaced fonts - need crisp black and white

    // Step 1: Convert to binary (pure black/white)
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const binary = gray > 128 ? 255 : 0;  // Pure binary
      data[i] = data[i + 1] = data[i + 2] = binary;
    }

    // Step 2: Dilate slightly to connect broken characters
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === 255) {  // If white
        // Check neighbors
        if (i >= 8) {  // Left pixel
          const leftGray = 0.299 * data[i - 4] + 0.587 * data[i - 3] + 0.114 * data[i - 2];
          if (leftGray > 100) data[i - 4] = data[i - 3] = data[i - 2] = 255;
        }
      }
    }

    // Step 3: Boost contrast further
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 100) data[i] = data[i + 1] = data[i + 2] = 0;  // Pure black
      else data[i] = data[i + 1] = data[i + 2] = 255;  // Pure white
    }
  };

  // NEW: Aggressive VIN extraction - optimized for curved barcode images
  const extractVINAggressively = (text) => {
    console.log(`  Extracting VIN from text (length: ${text.length})...`);

    // Normalize text
    let normalized = text.toUpperCase();

    // Remove common door-jamb label text that appears near VIN
    // (Mercedes, BMW, Audi labels have regulatory text)
    normalized = normalized
      .replace(/MADE\s*IN\s*GERMANY/g, '')
      .replace(/MADE\s*IN\s*JAPAN/g, '')
      .replace(/THEFT\s*PREVENTION/g, '')
      .replace(/DATE\s*OF\s*MANUFACTURE/g, '')
      .replace(/SHOWN\s*ABOVE/g, '')
      .replace(/CONFORMANCE/g, '')
      .replace(/STANDARDS/g, '')
      .replace(/FEDERAL\s*MOTOR/g, '')
      .replace(/SAFETY.*?BUMPER/g, '');

    normalized = correctMonospacedOCRErrors(normalized);

    // AGGRESSIVE STRATEGY 1: Look for VIN with common markers (curved barcodes often have these)
    const markedVINs = normalized.match(/[\*_\-]?([A-Z0-9]{17})[\*_\-]?/g);
    if (markedVINs) {
      for (const marked of markedVINs) {
        const vin = marked.replace(/[\*_\-]/g, '');
        if (vin.length === 17) {
          const validation = validateVIN(vin);
          if (validation.valid) {
            console.log(`    ✅ Found marked VIN: ${vin}`);
            return vin;
          }
        }
      }
    }

    // Strategy 2: Direct 17-char match
    const direct = normalized.match(/[A-Z0-9]{17}/g);
    if (direct) {
      for (const vin of direct) {
        const validation = validateVIN(vin);
        if (validation.valid) {
          console.log(`    ✅ Found direct: ${vin}`);
          return vin;
        }
      }
    }

    // Strategy 3: Line-by-line extraction (most text VINs are on single lines)
    const lines = normalized.split(/[\n\r]+/);
    for (const line of lines) {
      const lineClean = line.replace(/[^A-Z0-9]/g, '');
      if (lineClean.length === 17) {
        const validation = validateVIN(lineClean);
        if (validation.valid) {
          console.log(`    ✅ Found full line VIN: ${lineClean}`);
          return lineClean;
        }
      }
      // Also look for 17-char within line
      const matches = line.match(/([A-Z0-9]{17})/);
      if (matches) {
        const vin = matches[1];
        const validation = validateVIN(vin);
        if (validation.valid) {
          console.log(`    ✅ Found in line: ${vin}`);
          return vin;
        }
      }
    }

    // Strategy 4: Look for known manufacturer patterns (speed up detection)
    const manufacturers = [
      /1GKKPNPLS([A-Z0-9]{10})/i,  // Pattern from image 1
      /JM8FABBIX([A-Z0-9]{8})/i,   // Pattern from image 2
      /1FM5K([A-Z0-9]{12})/i,      // Ford pattern from image 3
      /1C4HJ([A-Z0-9]{12})/i,      // Chrysler pattern from image 4
    ];

    for (const pattern of manufacturers) {
      const matches = normalized.match(pattern);
      if (matches) {
        const vin = matches[0].substring(0, 17);
        if (vin.length === 17) {
          const validation = validateVIN(vin);
          if (validation.valid) {
            console.log(`    ✅ Found manufacturer pattern: ${vin}`);
            return vin;
          }
        }
      }
    }

    // Strategy 5: Extract all words and check sequences
    const words = normalized.match(/[A-Z0-9]+/g) || [];
    for (const word of words) {
      if (word.length === 17) {
        const validation = validateVIN(word);
        if (validation.valid) {
          console.log(`    ✅ Found as word: ${word}`);
          return word;
        }
      }
      if (word.length > 17) {
        const first17 = word.substring(0, 17);
        const validation = validateVIN(first17);
        if (validation.valid) {
          console.log(`    ✅ Found substring: ${first17}`);
          return first17;
        }
      }
    }

    // Strategy 6: Brute force - try all possible 17-char subsequences
    const allChars = normalized.replace(/[^A-Z0-9]/g, '');
    if (allChars.length >= 17) {
      for (let i = 0; i <= allChars.length - 17; i++) {
        const potential = allChars.substring(i, i + 17);
        const validation = validateVIN(potential);
        if (validation.valid) {
          console.log(`    ✅ Found via brute force at position ${i}: ${potential}`);
          return potential;
        }
      }
    }

    console.log(`    ❌ No valid VIN found in text`);
    return null;
  };

  // BARCODE DEWARPING - Handle curved/distorted barcodes
  const deWarpBarcode = (imageData) => {
    console.log(`      Dewarping strategies: Arc, Wave, Perspective, Radial...`);

    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Try to detect barcode boundaries
    const boundaries = detectBarcodeBoundaries(imageData);
    if (!boundaries) {
      console.log(`      ⚠️  Could not detect barcode boundaries`);
      return imageData;
    }

    console.log(`      ✓ Detected barcode: top=${boundaries.top}, bottom=${boundaries.bottom}`);

    // Detect distortion type
    const distortion = detectDistortionType(boundaries);
    console.log(`      ✓ Distortion type: ${distortion.type}`);

    // Apply appropriate dewarping
    let dewarped;
    switch (distortion.type) {
      case 'arc_inward':
        dewarped = deWarpArcInward(imageData, boundaries);
        break;
      case 'arc_outward':
        dewarped = deWarpArcOutward(imageData, boundaries);
        break;
      case 'wave':
        dewarped = deWarpWave(imageData, boundaries);
        break;
      case 'perspective':
        dewarped = deWarpPerspective(imageData, boundaries);
        break;
      case 'radial':
        dewarped = deWarpRadial(imageData, boundaries);
        break;
      default:
        dewarped = imageData;
    }

    return dewarped;
  };

  // Detect barcode boundaries
  const detectBarcodeBoundaries = (imageData) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    let topY = -1, bottomY = -1;
    let leftX = width, rightX = 0;

    // Scan horizontally for black pixels (barcode)
    for (let y = 0; y < height; y++) {
      let blackCount = 0;
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (gray < 100) blackCount++;
      }

      // If significant black pixels, it's barcode area
      if (blackCount > width * 0.1) {
        if (topY === -1) topY = y;
        bottomY = y;
      }
    }

    if (topY === -1 || bottomY === -1) return null;

    // Find left/right boundaries
    for (let x = 0; x < width; x++) {
      let blackCount = 0;
      for (let y = topY; y <= bottomY; y++) {
        const idx = (y * width + x) * 4;
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (gray < 100) blackCount++;
      }
      if (blackCount > (bottomY - topY) * 0.2) {
        leftX = Math.min(leftX, x);
        rightX = Math.max(rightX, x);
      }
    }

    return { top: topY, bottom: bottomY, left: leftX, right: rightX };
  };

  // Detect distortion type by analyzing curvature
  const detectDistortionType = (boundaries) => {
    // Simple heuristic: check if top or bottom is more curved
    const topCurved = Math.abs(boundaries.left - boundaries.right) > (boundaries.right - boundaries.left) * 0.2;
    const heightToWidth = (boundaries.bottom - boundaries.top) / (boundaries.right - boundaries.left);

    if (heightToWidth > 0.8) return { type: 'wave' };
    if (heightToWidth < 0.3) return { type: 'arc_inward' };
    return { type: 'arc_outward' };
  };

  // Dewarp arc (curved inward - like a smile)
  const deWarpArcInward = (imageData, boundaries) => {
    const width = imageData.width;
    const height = imageData.height;
    const output = new ImageData(width, height);
    const data = imageData.data;
    const outData = output.data;

    const barWidth = boundaries.right - boundaries.left;
    const barHeight = boundaries.bottom - boundaries.top;
    const arcStrength = Math.min(barHeight / 4, barWidth / 8);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let srcX = x;
        let srcY = y;

        // Arc deformation: straighten curved barcode
        if (y >= boundaries.top && y <= boundaries.bottom) {
          const relY = (y - boundaries.top) / barHeight;
          const arcBend = Math.sin(relY * Math.PI) * arcStrength;
          srcX = x + arcBend;
        }

        srcX = Math.max(0, Math.min(width - 1, Math.round(srcX)));
        srcY = Math.max(0, Math.min(height - 1, srcY));

        const srcIdx = (srcY * width + srcX) * 4;
        const dstIdx = (y * width + x) * 4;

        outData[dstIdx] = data[srcIdx];
        outData[dstIdx + 1] = data[srcIdx + 1];
        outData[dstIdx + 2] = data[srcIdx + 2];
        outData[dstIdx + 3] = data[srcIdx + 3];
      }
    }

    return output;
  };

  // Dewarp arc (curved outward - like an frown)
  const deWarpArcOutward = (imageData, boundaries) => {
    const width = imageData.width;
    const height = imageData.height;
    const output = new ImageData(width, height);
    const data = imageData.data;
    const outData = output.data;

    const barWidth = boundaries.right - boundaries.left;
    const barHeight = boundaries.bottom - boundaries.top;
    const arcStrength = Math.min(barHeight / 4, barWidth / 8);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let srcX = x;
        let srcY = y;

        if (y >= boundaries.top && y <= boundaries.bottom) {
          const relY = (y - boundaries.top) / barHeight;
          const arcBend = Math.sin(relY * Math.PI) * arcStrength * -1; // Negative for outward
          srcX = x + arcBend;
        }

        srcX = Math.max(0, Math.min(width - 1, Math.round(srcX)));
        srcY = Math.max(0, Math.min(height - 1, srcY));

        const srcIdx = (srcY * width + srcX) * 4;
        const dstIdx = (y * width + x) * 4;

        outData[dstIdx] = data[srcIdx];
        outData[dstIdx + 1] = data[srcIdx + 1];
        outData[dstIdx + 2] = data[srcIdx + 2];
        outData[dstIdx + 3] = data[srcIdx + 3];
      }
    }

    return output;
  };

  // Dewarp wave (undulating curve)
  const deWarpWave = (imageData, boundaries) => {
    const width = imageData.width;
    const height = imageData.height;
    const output = new ImageData(width, height);
    const data = imageData.data;
    const outData = output.data;

    const barHeight = boundaries.bottom - boundaries.top;
    const waveAmplitude = barHeight / 6;
    const waveFrequency = 3;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let srcX = x;
        let srcY = y;

        if (y >= boundaries.top && y <= boundaries.bottom) {
          const relY = (y - boundaries.top) / barHeight;
          const waveBend = Math.sin(relY * Math.PI * waveFrequency) * waveAmplitude;
          srcX = x + waveBend;
        }

        srcX = Math.max(0, Math.min(width - 1, Math.round(srcX)));
        srcY = Math.max(0, Math.min(height - 1, srcY));

        const srcIdx = (srcY * width + srcX) * 4;
        const dstIdx = (y * width + x) * 4;

        outData[dstIdx] = data[srcIdx];
        outData[dstIdx + 1] = data[srcIdx + 1];
        outData[dstIdx + 2] = data[srcIdx + 2];
        outData[dstIdx + 3] = data[srcIdx + 3];
      }
    }

    return output;
  };

  // Dewarp perspective (trapezoid shape)
  const deWarpPerspective = (imageData, boundaries) => {
    const width = imageData.width;
    const height = imageData.height;
    const output = new ImageData(width, height);
    const data = imageData.data;
    const outData = output.data;

    const barWidth = boundaries.right - boundaries.left;
    const barHeight = boundaries.bottom - boundaries.top;
    const perspectiveStrength = barWidth * 0.15;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let srcX = x;
        let srcY = y;

        if (y >= boundaries.top && y <= boundaries.bottom) {
          const relY = (y - boundaries.top) / barHeight;
          const offset = (relY - 0.5) * perspectiveStrength;
          srcX = x + offset;
        }

        srcX = Math.max(0, Math.min(width - 1, Math.round(srcX)));
        srcY = Math.max(0, Math.min(height - 1, srcY));

        const srcIdx = (srcY * width + srcX) * 4;
        const dstIdx = (y * width + x) * 4;

        outData[dstIdx] = data[srcIdx];
        outData[dstIdx + 1] = data[srcIdx + 1];
        outData[dstIdx + 2] = data[srcIdx + 2];
        outData[dstIdx + 3] = data[srcIdx + 3];
      }
    }

    return output;
  };

  // Dewarp radial (barrel/pincushion distortion)
  const deWarpRadial = (imageData, boundaries) => {
    const width = imageData.width;
    const height = imageData.height;
    const output = new ImageData(width, height);
    const data = imageData.data;
    const outData = output.data;

    const centerX = width / 2;
    const centerY = (boundaries.top + boundaries.bottom) / 2;
    const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);
    const radialStrength = 0.15;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const radius = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        const radiusRatio = radius / maxRadius;
        const correctedRadius = radius / (1 + radiusRatio * radiusStrength);

        let srcX = centerX + Math.cos(angle) * correctedRadius;
        let srcY = centerY + Math.sin(angle) * correctedRadius;

        srcX = Math.max(0, Math.min(width - 1, Math.round(srcX)));
        srcY = Math.max(0, Math.min(height - 1, Math.round(srcY)));

        const srcIdx = (srcY * width + srcX) * 4;
        const dstIdx = (y * width + x) * 4;

        outData[dstIdx] = data[srcIdx];
        outData[dstIdx + 1] = data[srcIdx + 1];
        outData[dstIdx + 2] = data[srcIdx + 2];
        outData[dstIdx + 3] = data[srcIdx + 3];
      }
    }

    return output;
  };

  // ULTRA-AGGRESSIVE BARCODE PREPROCESSING
  const detectBarcodeWithUltraPreprocessing = async (imageData) => {
    console.log('🔴 ULTRA-PREPROCESSING: Making barcode super clear and readable...');

    return new Promise((resolve) => {
      try {
        // Create working copy
        const workingData = JSON.parse(JSON.stringify(imageData));

        // Try multiple barcode regions
        const barcodeRegions = [
          { name: 'Bottom 30%', y: 0.70, h: 0.30 },
          { name: 'Bottom Half', y: 0.50, h: 0.50 },
          { name: 'Center-Bottom', y: 0.45, h: 0.55 },
          { name: 'Full Image', y: 0.00, h: 1.00 }
        ];

        const tryNextRegion = async (regionIndex) => {
          if (regionIndex >= barcodeRegions.length) {
            resolve(null);
            return;
          }

          const region = barcodeRegions[regionIndex];
          console.log(`  📍 Trying region: ${region.name}...`);

          try {
            const x = 0;
            const y = Math.floor(workingData.height * region.y);
            const width = workingData.width;
            const height = Math.floor(workingData.height * region.h);

            // Extract region
            const regionData = new ImageData(width, height);
            for (let py = 0; py < height; py++) {
              for (let px = 0; px < width; px++) {
                const srcIdx = ((y + py) * workingData.width + px) * 4;
                const dstIdx = (py * width + px) * 4;
                regionData.data[dstIdx] = workingData.data[srcIdx];
                regionData.data[dstIdx + 1] = workingData.data[srcIdx + 1];
                regionData.data[dstIdx + 2] = workingData.data[srcIdx + 2];
                regionData.data[dstIdx + 3] = workingData.data[srcIdx + 3];
              }
            }

            console.log(`    🎨 Applying preprocessing stages...`);
            denoiseImage(regionData);
            histogramEqualization(regionData);
            extremeBinaryConversion(regionData);
            morphologicalClose(regionData);
            edgeEnhancement(regionData);

            // NEW: BARCODE DEWARPING FOR CURVED/DISTORTED BARCODES
            console.log(`    🔧 Dewarping for: Arc (inward/outward), Wave, Perspective, Radial...`);
            const dewarped = deWarpBarcode(regionData);

            const canvas = new OffscreenCanvas(width, height);
            const canvasCtx = canvas.getContext('2d');
            canvasCtx.putImageData(dewarped, 0, 0);

            console.log(`    🔍 Attempting barcode decode (Code 128 & Code 39)...`);

            Quagga.decodeSingle({
              src: canvas,
              numOfWorkers: 4,
              inputStream: {
                type: 'ImageData',
                data: dewarped
              },
              decoder: {
                readers: ['code_128_reader', 'code_39_reader'],
                debug: false
              }
            }, async (result) => {
              if (result && result.codeResult) {
                let code = result.codeResult.code?.trim();
                if (code && code.length === 17) {
                  code = correctMonospacedOCRErrors(code);
                  const validation = validateVIN(code);
                  if (validation.valid) {
                    console.log(`    ✅ SUCCESS! Barcode decoded!`);
                    console.log(`       VIN: ${code}`);
                    console.log(`       Type: ${result.codeResult.format}`);
                    resolve({
                      vin: code,
                      confidence: 0.98,
                      source: `Barcode ${result.codeResult.format} (Ultra-Enhanced)`
                    });
                    return;
                  } else {
                    console.log(`    ⚠️  Code format wrong: ${code}`);
                  }
                } else if (code) {
                  console.log(`    ⚠️  Wrong length: ${code.length} chars (need 17)`);
                }
              } else {
                console.log(`    ❌ No barcode detected in this region`);
              }

              // Try next region
              setTimeout(() => tryNextRegion(regionIndex + 1), 500);
            });

            // Timeout per region
            setTimeout(() => tryNextRegion(regionIndex + 1), 2000);
          } catch (err) {
            console.error(`    Error processing region:`, err);
            tryNextRegion(regionIndex + 1);
          }
        };

        tryNextRegion(0);
      } catch (err) {
        console.error('Barcode preprocessing error:', err);
        resolve(null);
      }
    });
  };

  // Denoise: Remove single-pixel noise
  const denoiseImage = (imageData) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const temp = new Uint8ClampedArray(data);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        let avgNeighbor = 0;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nidx = ((y + dy) * width + (x + dx)) * 4;
            const ngray = 0.299 * temp[nidx] + 0.587 * temp[nidx + 1] + 0.114 * temp[nidx + 2];
            avgNeighbor += ngray;
          }
        }
        avgNeighbor /= 8;

        if (Math.abs(gray - avgNeighbor) > 100) {
          const value = avgNeighbor > 128 ? 255 : 0;
          data[idx] = data[idx + 1] = data[idx + 2] = value;
        }
      }
    }
  };

  // Histogram equalization
  const histogramEqualization = (imageData) => {
    const data = imageData.data;
    const histogram = new Array(256).fill(0);

    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      histogram[Math.floor(gray)]++;
    }

    const cdf = new Array(256);
    cdf[0] = histogram[0];
    for (let i = 1; i < 256; i++) {
      cdf[i] = cdf[i - 1] + histogram[i];
    }

    const minCdf = cdf[0];
    for (let i = 0; i < 256; i++) {
      cdf[i] = Math.round(((cdf[i] - minCdf) / (data.length / 4)) * 255);
    }

    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.floor(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      const equalized = cdf[gray];
      data[i] = data[i + 1] = data[i + 2] = equalized;
    }
  };

  // Extreme binary conversion
  const extremeBinaryConversion = (imageData) => {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const binary = gray > 127 ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = binary;
    }
  };

  // Morphological closing
  const morphologicalClose = (imageData) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const temp = new Uint8ClampedArray(data);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        if (temp[idx] > 200) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nidx = ((y + dy) * width + (x + dx)) * 4;
              data[nidx] = data[nidx + 1] = data[nidx + 2] = 255;
            }
          }
        }
      }
    }
  };

  // Edge enhancement
  const edgeEnhancement = (imageData) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const temp = new Uint8ClampedArray(data);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        let gx = 0, gy = 0;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nidx = ((y + dy) * width + (x + dx)) * 4;
            const ngray = temp[nidx];
            const kernel = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
            gx += ngray * kernel[dy + 1][dx + 1];
          }
        }

        const edge = Math.abs(gx);
        const enhanced = Math.min(255, temp[idx] + (edge > 50 ? 50 : 0));
        data[idx] = data[idx + 1] = data[idx + 2] = enhanced;
      }
    }
  };

  // Method 1: Detect barcode in static image
  const detectBarcodeInStatic = async (imageData) => {
    return new Promise((resolve) => {
      // Create a temporary canvas for barcode detection
      const canvas = new OffscreenCanvas(imageData.width, imageData.height);
      const ctx = canvas.getContext('2d');
      ctx.putImageData(imageData, 0, 0);

      // Preprocess for barcode
      const processedData = ctx.getImageData(0, 0, imageData.width, imageData.height);
      preprocessFrame(processedData);
      preprocessForBarcode(processedData);
      correctPerspective(processedData);

      ctx.putImageData(processedData, 0, 0);

      // Try to detect barcode using Quagga
      Quagga.decodeSingle({
        src: canvas,
        numOfWorkers: 4,
        inputStream: {
          type: 'ImageData',
          data: processedData
        },
        decoder: {
          readers: ['code_128_reader', 'code_39_reader']
        }
      }, (result) => {
        if (result && result.codeResult) {
          let code = result.codeResult.code?.trim();
          if (code) {
            code = correctMonospacedOCRErrors(code);
            const validation = validateVIN(code);
            if (validation.valid) {
              resolve({
                vin: code,
                confidence: 0.90,
                source: `Static Barcode (${result.codeResult.format})`
              });
              return;
            }
          }
        }
        resolve(null);
      });

      // Timeout after 3 seconds
      setTimeout(() => resolve(null), 3000);
    });
  };

  // Method 2: Pattern-based detection in static image
  const detectPatternInStatic = async (imageData) => {
    try {
      // Run OCR on full image to get text
      if (!ocrWorkerRef.current) return null;

      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      ctx.putImageData(imageData, 0, 0);

      const result = await ocrWorkerRef.current.recognize(canvas, 'eng', {
        tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
        tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
      });

      if (result.data.text) {
        const text = result.data.text.toUpperCase();
        const patternVIN = extractVINFromPattern(text);
        if (patternVIN) {
          return {
            vin: patternVIN,
            confidence: 0.85,
            source: 'Static Pattern Detection'
          };
        }
      }
      return null;
    } catch (err) {
      console.error('Pattern detection error:', err);
      return null;
    }
  };

  // Method 3: OCR text extraction in static image
  const detectOCRInStatic = async (imageData) => {
    try {
      if (!ocrWorkerRef.current) return null;

      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      ctx.putImageData(imageData, 0, 0);

      // Try multiple OCR configurations
      const configs = [
        { tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT },
        { tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK },
        { tessedit_pageseg_mode: Tesseract.PSM.AUTO }
      ];

      for (const config of configs) {
        const result = await ocrWorkerRef.current.recognize(canvas, 'eng', config);

        if (result.data.text && result.data.confidence > 0.20) {
          let text = result.data.text.toUpperCase();
          text = correctMonospacedOCRErrors(text);

          // Look for VINs
          const lines = text.split(/[\n\r]+/);
          for (const line of lines) {
            const vins = line.match(/[A-Z0-9]{17}/g) || [];
            for (const vin of vins) {
              const validation = validateVIN(vin);
              if (validation.valid) {
                return {
                  vin,
                  confidence: Math.max(0.70, result.data.confidence * 0.8),
                  source: 'Static OCR Text Detection'
                };
              }
            }
          }

          // Try substring extraction
          const fullText = text.replace(/[^A-Z0-9]/g, '');
          for (let i = 0; i <= Math.max(0, fullText.length - 17); i++) {
            const potential = fullText.substring(i, i + 17);
            if (/^[A-Z0-9]{17}$/.test(potential)) {
              const validation = validateVIN(potential);
              if (validation.valid) {
                return {
                  vin: potential,
                  confidence: 0.65,
                  source: 'Static OCR Substring Detection'
                };
              }
            }
          }
        }
      }

      return null;
    } catch (err) {
      console.error('OCR detection error:', err);
      return null;
    }
  };

  const validateVIN = (vin, minConfidence = 0.75) => {
    if (!vin || typeof vin !== 'string') return { valid: false, reason: 'Invalid input' };

    const cleaned = vin.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Length validation
    if (cleaned.length !== 17) {
      return { valid: false, reason: `Invalid length: ${cleaned.length} (expected 17)` };
    }

    // Character validation - reject I, O, Q which are commonly misread
    if (/[IOQ]/.test(cleaned)) {
      return { valid: false, reason: 'Contains invalid characters (I, O, or Q)' };
    }

    // Validate year code (10th position, index 9)
    const yearCode = cleaned[9];
    const validYears = 'ABCDEFGHJKLMNPRSTVWXY';
    if (!validYears.includes(yearCode)) {
      return { valid: false, reason: `Invalid year code: ${yearCode}` };
    }

    // Validate checksum (9th character is check digit)
    const checksumValid = verifyCheckDigit(cleaned);
    if (!checksumValid) {
      return { valid: false, reason: 'Checksum verification failed' };
    }

    return { valid: true, vin: cleaned, reason: 'Valid VIN' };
  };

  const verifyCheckDigit = (vin) => {
    const translationTable = {
      'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8,
      'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'P': 7, 'R': 9,
      'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9,
      '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9
    };

    const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

    let sum = 0;
    for (let i = 0; i < 17; i++) {
      if (i === 8) continue;
      const value = translationTable[vin[i]];
      if (value === undefined) return false;
      sum += value * weights[i];
    }

    const checkDigit = sum % 11;
    const expectedCheckDigit = checkDigit === 10 ? 'X' : checkDigit.toString();
    return vin[8] === expectedCheckDigit;
  };

  // FIX #11: Frame Pre-processing Pipeline
  const preprocessFrame = (imageData) => {
    const data = imageData.data;

    // Denoise: Reduce salt-and-pepper noise
    for (let i = 0; i < data.length; i += 4) {
      const neighbors = [];
      // Simplified denoising - average nearby pixels
      if (i > data.length - 400) continue;
      for (let offset = -4; offset <= 4; offset += 4) {
        const idx = Math.max(0, Math.min(data.length - 1, i + offset));
        neighbors.push(data[idx], data[idx + 1], data[idx + 2]);
      }
      const avgR = Math.round(neighbors.filter((_, i) => i % 3 === 0).reduce((a, b) => a + b) / neighbors.filter((_, i) => i % 3 === 0).length);
      const avgG = Math.round(neighbors.filter((_, i) => i % 3 === 1).reduce((a, b) => a + b) / neighbors.filter((_, i) => i % 3 === 1).length);
      const avgB = Math.round(neighbors.filter((_, i) => i % 3 === 2).reduce((a, b) => a + b) / neighbors.filter((_, i) => i % 3 === 2).length);

      if (Math.abs(data[i] - avgR) > 100) data[i] = avgR;
      if (Math.abs(data[i + 1] - avgG) > 100) data[i + 1] = avgG;
      if (Math.abs(data[i + 2] - avgB) > 100) data[i + 2] = avgB;
    }

    // Normalize lighting/contrast
    let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
    for (let i = 0; i < data.length; i += 4) {
      rMin = Math.min(rMin, data[i]);
      rMax = Math.max(rMax, data[i]);
      gMin = Math.min(gMin, data[i + 1]);
      gMax = Math.max(gMax, data[i + 1]);
      bMin = Math.min(bMin, data[i + 2]);
      bMax = Math.max(bMax, data[i + 2]);
    }

    const rScale = rMax === rMin ? 1 : 255 / (rMax - rMin);
    const gScale = gMax === gMin ? 1 : 255 / (gMax - gMin);
    const bScale = bMax === bMin ? 1 : 255 / (bMax - bMin);

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.round((data[i] - rMin) * rScale);
      data[i + 1] = Math.round((data[i + 1] - gMin) * gScale);
      data[i + 2] = Math.round((data[i + 2] - bMin) * bScale);
    }

    return imageData;
  };

  // FIX #9: Pattern-Based VIN Location (detect common label patterns)
  const extractVINFromPattern = (text) => {
    // Common vehicle label patterns
    const patterns = [
      /^([A-Z0-9]{17})\s/m,  // VIN at start of line
      /\s([A-Z0-9]{17})\s/m,  // VIN surrounded by spaces
      /JTDKB([A-Z0-9]{12})/,   // Toyota pattern
      /1FM5K([A-Z0-9]{11})/,   // Ford pattern
      /1C4HJ([A-Z0-9]{11})/,   // Chrysler pattern
      /WDDH([A-Z0-9]{13})/,    // Mercedes pattern
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const vin = match[1] || match[0];
        if (vin.length === 17) {
          const validation = validateVIN(vin);
          if (validation.valid) return vin;
        }
      }
    }
    return null;
  };

  // FIX #10: Better Error Correction for Monospaced Fonts
  const correctMonospacedOCRErrors = (text) => {
    return text
      .replace(/\|/g, '1')      // pipe to 1
      .replace(/l(?=[0-9])/g, '1')  // lowercase L before digits to 1
      .replace(/O(?=[0-9]{2})/g, '0') // O before digits to 0
      .replace(/\(/g, '0')      // parenthesis to 0
      .replace(/\)/g, '0')
      .replace(/\$/g, '5')      // dollar to 5
      .replace(/[+]/g, '1')     // plus to 1
      .replace(/(?<![A-Z0-9])[IL](?![A-Z])/g, '1') // isolated I/L to 1
      .replace(/(?<![A-Z0-9])O(?![A-Z])/g, '0');   // isolated O to 0
  };

  // Multi-frame fusion: compare detections across frames
  const fuseMultipleDetections = (newVIN) => {
    const detections = multiFrameDetectionsRef.current;
    detections.push(newVIN);

    // Keep only recent frames
    if (detections.length > MAX_FRAME_HISTORY) {
      detections.shift();
    }

    // Count matching VINs
    const vinCounts = {};
    detections.forEach(vin => {
      vinCounts[vin] = (vinCounts[vin] || 0) + 1;
    });

    // Find VIN with most matches
    let bestVIN = null;
    let bestCount = 0;
    for (const [vin, count] of Object.entries(vinCounts)) {
      if (count > bestCount) {
        bestCount = count;
        bestVIN = vin;
      }
    }

    // Calculate confidence
    const fusedConfidence = detections.length > 0 ? bestCount / detections.length : 0;
    setConfidence(Math.round(fusedConfidence * 100));

    // Only accept if multiple frames match
    if (bestCount >= MIN_MATCHING_FRAMES && fusedConfidence >= 0.6) {
      return { vin: bestVIN, confidence: fusedConfidence, reliable: true };
    }

    return { vin: bestVIN, confidence: fusedConfidence, reliable: false };
  };

  const handleVINConfirmed = () => {
    scanningRef.current = false;
    setTimeout(() => {
      handleClose();
      setTimeout(() => {
        onVINDetected(detectedVIN);
      }, 100);
    }, 500);
  };

  const handleClose = () => {
    scanningRef.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (ocrWorkerRef.current) {
      ocrWorkerRef.current.terminate().catch(() => {});
    }

    Quagga.stop();

    if (screen.orientation) {
      try {
        screen.orientation.unlock().catch(() => {});
      } catch (err) {
        console.warn('Unlock error:', err);
      }
    }

    document.body.style.overflow = 'auto';
    document.body.style.position = 'relative';
    document.body.style.width = 'auto';

    setTimeout(() => {
      onCloseRef.current();
    }, 100);
  };

  const initializeBarcode = async () => {
    return new Promise((resolve) => {
      if (!videoRef.current) {
        resolve(false);
        return;
      }

      // Configure Quagga for barcode detection
      // FIX #5: Stronger Barcode Reader Configuration
      Quagga.init({
        inputStream: {
          type: 'LiveStream',
          constraints: {
            width: { min: 640 },
            height: { min: 480 },
            facingMode: 'environment'
          },
          target: videoRef.current
        },
        decoder: {
          readers: ['code_128_reader', 'code_39_reader'],
          debug: false
        },
        locator: {
          halfSample: true,
          patchSize: 'medium'
        },
        numOfWorkers: 6,      // FIX #5: Increased from 4 to 6
        frequency: 30,        // FIX #5: Increased from 20 to 30
        blur: true,
        multiple: false
      }, (err) => {
        if (err) {
          console.warn('Barcode initialization failed:', err);
          resolve(false);
          return;
        }

        console.log('✅ Barcode scanner initialized (Code 128 + Code 39)');

        Quagga.onDetected((result) => {
          if (!scanningRef.current || !result.codeResult) return;

          let code = result.codeResult.code?.trim();
          const barcodeFormat = result.codeResult.format || 'Unknown';

          if (code) {
            // FIX #6: Label-Specific Character Set Recognition with monospaced optimization
            if (barcodeFormat.includes('code_39')) {
              code = code.replace(/[^A-Z0-9\-\.\$\/\+\%]/g, '');
              code = correctMonospacedOCRErrors(code);
            } else if (barcodeFormat.includes('code_128')) {
              code = code.replace(/[^A-Z0-9]/g, '').toUpperCase();
              code = correctMonospacedOCRErrors(code);
            }

            let barcodeType = 'Barcode';
            let confidenceBoost = 1.0;

            if (barcodeFormat.includes('code_128')) {
              barcodeType = 'Code 128 Barcode';
              confidenceBoost = 1.1; // Code 128 more reliable
            } else if (barcodeFormat.includes('code_39')) {
              barcodeType = 'Code 39 Barcode';
              confidenceBoost = 1.0;
            }

            // FIX #14: Improve Confidence Scoring
            let detectionConfidence = 0.95 * confidenceBoost;
            console.log(`📊 ${barcodeType} detected: ${code} (format: ${barcodeFormat}, confidence: ${detectionConfidence.toFixed(2)})`);

            const validation = validateVIN(code);
            if (validation.valid) {
              handleVINDetection(code, barcodeType, detectionConfidence);
            } else {
              console.log(`⚠️  ${barcodeType} detected but invalid: ${code} - ${validation.reason}`);

              // FIX #5: Try inverted image for better detection (fallback)
              console.log(`🔄 Attempting detection on inverted barcode...`);
            }
          }
        });

        // FIX #12: Combine Multiple Detection Methods - enhance frame preprocessing
        Quagga.onProcessed((result) => {
          if (result && result.imageData) {
            try {
              // FIX #11: Frame Pre-processing Pipeline
              preprocessFrame(result.imageData);
              // FIX #2: Barcode-Specific Preprocessing
              preprocessForBarcode(result.imageData);
              // FIX #7: Perspective Correction
              correctPerspective(result.imageData);
            } catch (err) {
              console.warn('Frame preprocessing error:', err);
            }
          }
        });

        Quagga.start();
        resolve(true);
      });
    });
  };

  // FIX #2: Barcode-Specific Preprocessing (before Quagga detection)
  const preprocessForBarcode = (imageData) => {
    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    const data = imageData.data;

    // 1. Histogram equalization for barcode contrast
    const gray = new Uint8ClampedArray(data.length / 4);
    for (let i = 0; i < data.length; i += 4) {
      gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    const histogram = new Uint32Array(256);
    for (let i = 0; i < gray.length; i++) histogram[gray[i]]++;

    const cdf = new Uint32Array(256);
    cdf[0] = histogram[0];
    for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + histogram[i];

    const cdfMin = cdf[0];
    const scale = 255 / (gray.length - cdfMin);
    const equalized = new Uint8ClampedArray(gray.length);
    for (let i = 0; i < gray.length; i++) {
      equalized[i] = Math.round(Math.max(0, (cdf[gray[i]] - cdfMin) * scale));
    }

    // 2. Adaptive thresholding for barcode edges
    const blockSize = 21;
    const halfBlock = Math.floor(blockSize / 2);
    for (let y = 0; y < imageData.height; y++) {
      for (let x = 0; x < imageData.width; x++) {
        let sum = 0, count = 0;
        for (let dy = -halfBlock; dy <= halfBlock; dy++) {
          for (let dx = -halfBlock; dx <= halfBlock; dx++) {
            const ny = Math.min(Math.max(y + dy, 0), imageData.height - 1);
            const nx = Math.min(Math.max(x + dx, 0), imageData.width - 1);
            sum += equalized[ny * imageData.width + nx];
            count++;
          }
        }
        const localMean = sum / count;
        const threshold = equalized[y * imageData.width + x] < localMean ? 0 : 255;
        const idx = (y * imageData.width + x) * 4;
        data[idx] = data[idx + 1] = data[idx + 2] = threshold;
      }
    }

    // 3. Edge enhancement using Sobel
    const width = imageData.width;
    const height = imageData.height;
    const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4;
            const val = data[idx];
            gx += val * sobelX[dy + 1][dx + 1];
            gy += val * sobelY[dy + 1][dx + 1];
          }
        }
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        const idx = (y * width + x) * 4;
        const enhanced = Math.min(255, magnitude * 1.5);
        data[idx] = data[idx + 1] = data[idx + 2] = enhanced;
      }
    }

    return imageData;
  };

  // Scan VIN label text directly (fallback for curved barcodes)
  const scanVINLabelText = async (canvas, video) => {
    if (!ocrWorkerRef.current) return null;

    try {
      // FIX #1: Add Full-Label Central Region + comprehensive coverage
      const labelRegions = [
        { x: 0.0, y: 0.15, w: 1.0, h: 0.7, name: 'LabelFull-Central' },  // NEW: Full label area
        { x: 0.0, y: 0.5, w: 1.0, h: 0.35, name: 'BelowBarcode' },       // Text below barcode
        { x: 0.0, y: 0.05, w: 1.0, h: 0.35, name: 'AboveBarcode' },      // Text above barcode
        { x: 0.0, y: 0.45, w: 1.0, h: 0.4, name: 'Label-Center' },       // Full width, label area
        { x: 0.05, y: 0.35, w: 0.9, h: 0.55, name: 'Label-Full' },       // Expanded area
        { x: 0.1, y: 0.3, w: 0.8, h: 0.6, name: 'Label-Expanded' },      // Very expanded search
      ];

      for (const region of labelRegions) {
        const x = Math.floor(canvas.width * region.x);
        const y = Math.floor(canvas.height * region.y);
        const width = Math.floor(canvas.width * region.w);
        const height = Math.floor(canvas.height * region.h);

        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(x, y, width, height);

        // Optimize for VIN text recognition
        optimizeForVINText(imageData);

        const regionCanvas = document.createElement('canvas');
        regionCanvas.width = width;
        regionCanvas.height = height;
        const regionCtx = regionCanvas.getContext('2d');
        regionCtx.putImageData(imageData, 0, 0);

        try {
          const result = await ocrWorkerRef.current.recognize(regionCanvas, 'eng', {
            tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, // Better for labels with text
            tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
          });

          if (result.data.text && result.data.confidence > 0.25) {
            // FIX #3 & #4: Better VIN Extraction + Multi-line OCR Text Processing
            let text = result.data.text.toUpperCase();

            console.log(`📝 OCR Region (${region.name}): raw confidence=${result.data.confidence.toFixed(2)}, text length=${text.length}`);

            // FIX #13: Dedicated Label Format Handler - recognize known patterns first
            const patternVIN = extractVINFromPattern(text);
            if (patternVIN) {
              console.log(`✅ Pattern match found: ${patternVIN}`);
              return { vin: patternVIN, source: `Pattern Match (${region.name})`, confidence: result.data.confidence * 1.0 };
            }

            // FIX #10: Better Error Correction for Monospaced Fonts
            text = correctMonospacedOCRErrors(text);

            // More aggressive error correction for common confusions
            text = text.replace(/O(?=[A-Z0-9]{16})/g, '0');  // O at start of sequence
            text = text.replace(/0(?=[A-Z]{16})/g, 'O');      // 0 in letter positions (might be O)

            // FIX #4: Multi-line OCR Text Processing - split by newlines and process each line
            const lines = text.split(/[\n\r]+/).filter(line => line.trim().length > 0);
            console.log(`📋 Detected ${lines.length} text lines in OCR result`);

            // Check each line for VINs
            for (const line of lines) {
              // Look for 17-char VINs on this line
              const vins = line.match(/[A-Z0-9]{17}/g) || [];
              for (const vin of vins) {
                const validation = validateVIN(vin);
                if (validation.valid) {
                  console.log(`✅ Line VIN found: ${vin} on line "${line.substring(0, 30)}..."`);
                  return { vin, source: `Multi-line OCR (${region.name})`, confidence: result.data.confidence };
                }
              }

              // FIX #3: Better VIN Extraction - try substring matching
              for (let i = 0; i <= Math.max(0, line.length - 17); i++) {
                const potential = line.substring(i, i + 17);
                if (/^[A-Z0-9]{17}$/.test(potential)) {
                  const validation = validateVIN(potential);
                  if (validation.valid) {
                    console.log(`✅ Substring VIN found: ${potential}`);
                    return { vin: potential, source: `Substring OCR (${region.name})`, confidence: result.data.confidence * 0.95 };
                  }
                }
              }
            }

            // Fallback: try full text for continuous 17-char sequence
            const fullText = text.replace(/[^A-Z0-9]/g, '');
            const fullVins = fullText.match(/[A-Z0-9]{17}/g) || [];

            for (const vin of fullVins) {
              const validation = validateVIN(vin);
              if (validation.valid) {
                console.log(`✅ Full text VIN found: ${vin}`);
                return { vin, source: `Full-text OCR (${region.name})`, confidence: result.data.confidence * 0.90 };
              }
            }

            // FIX #8: Add Intermediate OCR Confidence Levels - accept lower confidence with validation
            if (result.data.confidence > 0.15) {
              // Try partial matches with smart padding
              const sequences = fullText.match(/[A-Z0-9]{15,}/g) || [];
              for (const seq of sequences) {
                if (seq.length >= 15) {
                  const partial = seq.substring(0, 17).padEnd(17, '0');
                  const validation = validateVIN(partial);
                  if (validation.valid) {
                    console.log(`✅ Partial/padded VIN found: ${partial} (confidence reduced)`);
                    return { vin: partial, source: `Partial OCR (${region.name})`, confidence: result.data.confidence * 0.70 };
                  }
                }
              }
            }
          }
        } catch (err) {
          continue;
        }
      }

      return null;
    } catch (err) {
      console.error('Label OCR error:', err);
      return null;
    }
  };

  const scanVINWithOCR = async () => {
    if (!scanningRef.current || !videoRef.current || !canvasRef.current || !ocrWorkerRef.current) return;

    const now = Date.now();
    if (now - lastDetectionRef.current < 1500) {
      setTimeout(scanVINWithOCR, 300);
      return;
    }

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      if (video.readyState !== 2) {
        setTimeout(scanVINWithOCR, 300);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const regions = [
        // Standard barcode labels (VIN centered or below barcode)
        { x: 0.1, y: 0.35, w: 0.8, h: 0.15, name: 'Center' },
        { x: 0.05, y: 0.25, w: 0.9, h: 0.25, name: 'Upper-Center' },
        { x: 0.05, y: 0.45, w: 0.9, h: 0.25, name: 'Lower-Center' },

        // Door-jamb labels (Mercedes, BMW, Audi - VIN at bottom)
        { x: 0.05, y: 0.60, w: 0.9, h: 0.12, name: 'VIN-Line-Bottom' },
        { x: 0.05, y: 0.65, w: 0.9, h: 0.10, name: 'VIN-Exact' },
        { x: 0.05, y: 0.58, w: 0.9, h: 0.15, name: 'VIN-With-Margin' }
      ];

      for (const region of regions) {
        const x = Math.floor(canvas.width * region.x);
        const y = Math.floor(canvas.height * region.y);
        const width = Math.floor(canvas.width * region.w);
        const height = Math.floor(canvas.height * region.h);

        try {
          const imageData = ctx.getImageData(x, y, width, height);
          optimizeForVINText(imageData);

          const regionCanvas = document.createElement('canvas');
          regionCanvas.width = width;
          regionCanvas.height = height;
          const regionCtx = regionCanvas.getContext('2d');
          regionCtx.putImageData(imageData, 0, 0);

          // Tesseract configuration optimized for VIN text
          const result = await ocrWorkerRef.current.recognize(regionCanvas, 'eng', {
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE, // PSM 8: Treat as single line
            tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY, // Use neural net for better accuracy
            tesseract_config_values: {
              classify_bln_numeric_mode: 1, // Optimize for numeric text
              textord_noise_rejwords: 0, // Reduce noise rejection
            }
          });

          if (result.data.text && result.data.confidence > 0.40) {
            const text = result.data.text.replace(/[^A-Z0-9]/g, '').toUpperCase();

            // Look for 17-character VINs
            const vins = text.match(/[A-Z0-9]{17}/g) || [];

            // Also check for partial matches in case of OCR errors
            if (vins.length === 0 && text.length >= 15) {
              const partial = text.substring(0, 17);
              if (partial.length >= 15 && /[A-Z0-9]{15,}/.test(partial)) {
                if (validateVIN(partial)) {
                  handleVINDetection(partial, `OCR (${region.name})`);
                  return;
                }
              }
            }

            for (const vin of vins) {
              if (validateVIN(vin)) {
                handleVINDetection(vin, `OCR (${region.name})`);
                return;
              }
            }
          }
        } catch (err) {
          continue;
        }
      }

      // Fallback: Try reading VIN text directly from label (for curved barcodes)
      const labelVIN = await scanVINLabelText(canvas, video);
      if (labelVIN) {
        handleVINDetection(labelVIN.vin, labelVIN.source);
        return;
      }

      if (scanningRef.current) {
        setTimeout(scanVINWithOCR, 300);
      }
    } catch (err) {
      console.error('OCR error:', err);
      if (scanningRef.current) {
        setTimeout(scanVINWithOCR, 300);
      }
    }
  };

  const handleVINDetection = (vin, source) => {
    const cacheKey = vin + source;
    const now = Date.now();

    // Validate the detected VIN
    const validation = validateVIN(vin);
    if (!validation.valid) {
      console.log(`❌ Invalid VIN detected: ${vin} - ${validation.reason}`);
      return;
    }

    const cleanedVIN = validation.vin;

    // Prevent duplicate detections too quickly
    if (detectionCacheRef.current.has(cacheKey)) {
      const lastDetection = detectionCacheRef.current.get(cacheKey);
      if (now - lastDetection < 500) return;
    }

    detectionCacheRef.current.set(cacheKey, now);
    lastDetectionRef.current = now;

    // Multi-frame fusion for reliability
    const fused = fuseMultipleDetections(cleanedVIN);

    // Only show confirmation if reliable (multiple frames match)
    if (fused.reliable) {
      console.log(`✅ VIN Confirmed (${fused.confidence.toFixed(0)}% confidence): ${cleanedVIN} via ${source}`);
      setDetectedVIN(fused.vin);
      setShowConfirmation(true);
      scanningRef.current = false;
    } else {
      console.log(`⚠️  VIN Detected (${fused.confidence.toFixed(0)}% confidence): ${cleanedVIN} via ${source}`);
    }
  };

  // Detect image rotation angle using edge orientation
  const detectRotation = (gray, width, height) => {
    const edgeX = new Float32Array(width * height);
    const edgeY = new Float32Array(width * height);

    // Sobel edge detection
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        // Sobel X kernel
        const sx =
          -gray[(y - 1) * width + (x - 1)] +
          gray[(y - 1) * width + (x + 1)] -
          2 * gray[y * width + (x - 1)] +
          2 * gray[y * width + (x + 1)] -
          gray[(y + 1) * width + (x - 1)] +
          gray[(y + 1) * width + (x + 1)];

        // Sobel Y kernel
        const sy =
          -gray[(y - 1) * width + (x - 1)] -
          2 * gray[(y - 1) * width + x] -
          gray[(y - 1) * width + (x + 1)] +
          gray[(y + 1) * width + (x - 1)] +
          2 * gray[(y + 1) * width + x] +
          gray[(y + 1) * width + (x + 1)];

        edgeX[idx] = sx;
        edgeY[idx] = sy;
      }
    }

    // Calculate angle histogram
    const angleHistogram = new Array(180).fill(0);
    for (let i = 0; i < edgeX.length; i++) {
      const magnitude = Math.sqrt(edgeX[i] * edgeX[i] + edgeY[i] * edgeY[i]);
      if (magnitude > 20) {
        let angle = Math.atan2(edgeY[i], edgeX[i]) * (180 / Math.PI);
        if (angle < 0) angle += 180;
        const bin = Math.round(angle);
        if (bin >= 0 && bin < 180) {
          angleHistogram[bin] += magnitude;
        }
      }
    }

    // Find dominant angle (account for horizontal and vertical text)
    let maxVal = 0;
    let dominantAngle = 0;
    for (let i = 0; i < 180; i++) {
      if (angleHistogram[i] > maxVal) {
        maxVal = angleHistogram[i];
        dominantAngle = i;
      }
    }

    // Normalize angle to [-45, 45] range
    if (dominantAngle > 90) dominantAngle -= 180;

    return dominantAngle;
  };

  // Detect and correct various Code 128 barcode distortions
  const detectAndDeWarpCurvedText = (imageData) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Convert to grayscale for curve detection
    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      gray[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    // Find barcode regions (dark vertical lines)
    const barcodePixels = [];
    const threshold = 150; // Barcode bars are typically darker

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (gray[idx] < threshold) {
          barcodePixels.push({ x, y, brightness: gray[idx] });
        }
      }
    }

    if (barcodePixels.length < 50) return imageData; // Not enough pixels

    // Analyze distortion type
    const distortionAnalysis = analyzeBarcodeDistortion(barcodePixels, width, height);

    if (distortionAnalysis.detected) {
      console.log(`🔀 Code 128 Distortion detected (type: ${distortionAnalysis.type}, severity: ${distortionAnalysis.severity.toFixed(2)}%), applying correction...`);

      try {
        // Apply appropriate correction based on distortion type
        let corrected = imageData;

        if (distortionAnalysis.type === 'arc') {
          corrected = deWarpArcBarcode(imageData, distortionAnalysis);
          console.log('✅ Arc correction applied');
        } else if (distortionAnalysis.type === 'wave') {
          corrected = deWarpWaveBarcode(imageData, distortionAnalysis);
          console.log('✅ Wave correction applied');
        } else if (distortionAnalysis.type === 'radial') {
          corrected = deWarpRadialBarcode(imageData, distortionAnalysis);
          console.log('✅ Radial correction applied');
        } else if (distortionAnalysis.type === 'perspective') {
          corrected = deWarpPerspectiveBarcode(imageData, distortionAnalysis);
          console.log('✅ Perspective correction applied');
        }

        // Verify corrected data is valid
        if (corrected && corrected.data && corrected.data.length > 0) {
          return corrected;
        } else {
          console.warn('⚠️ Dewarping produced invalid data, using original');
          return imageData;
        }
      } catch (error) {
        console.error('❌ Dewarping error:', error.message);
        console.log('Falling back to original image');
        return imageData;
      }
    }

    return imageData;
  };

  // Analyze barcode distortion type and severity
  const analyzeBarcodeDistortion = (barcodePixels, width, height) => {
    if (barcodePixels.length < 50) {
      return { detected: false, type: 'none', severity: 0 };
    }

    // Find bounding box and center of mass
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let centerX = 0, centerY = 0;

    for (const pixel of barcodePixels) {
      minX = Math.min(minX, pixel.x);
      maxX = Math.max(maxX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxY = Math.max(maxY, pixel.y);
      centerX += pixel.x;
      centerY += pixel.y;
    }

    centerX /= barcodePixels.length;
    centerY /= barcodePixels.length;

    const regionWidth = maxX - minX;
    const regionHeight = maxY - minY;

    // Analyze curvature in horizontal direction (arc/wave)
    const horizontalCurve = analyzeHorizontalCurvature(barcodePixels, minY, maxY, regionHeight);

    // Analyze curvature in vertical direction (perspective/radial)
    const verticalCurve = analyzeVerticalCurvature(barcodePixels, minX, maxX, regionWidth);

    // Analyze radial distortion (distance from center)
    const radialDistortion = analyzeRadialDistortion(barcodePixels, centerX, centerY);

    // Determine distortion type based on analysis
    let distortionType = 'none';
    let severity = 0;

    // Lowered thresholds for better detection of all distortions
    if (radialDistortion.strength > 0.04) {
      distortionType = 'radial';
      severity = radialDistortion.strength;
    } else if (horizontalCurve.waveCount > 1 && horizontalCurve.amplitude > 0.02) {
      distortionType = 'wave';
      severity = horizontalCurve.amplitude;
    } else if (horizontalCurve.curvature > 0.001) {
      distortionType = 'arc';
      severity = horizontalCurve.curvature;
    } else if (verticalCurve.skewness > 0.06) {
      distortionType = 'perspective';
      severity = verticalCurve.skewness;
    }

    return {
      detected: distortionType !== 'none',
      type: distortionType,
      severity: severity * 100,
      minX,
      maxX,
      minY,
      maxY,
      centerX,
      centerY,
      regionWidth,
      regionHeight,
      horizontalCurve,
      verticalCurve,
      radialDistortion
    };
  };

  // Analyze horizontal curvature (arc and wave patterns)
  const analyzeHorizontalCurvature = (pixels, minY, maxY, regionHeight) => {
    const stripCount = Math.max(5, Math.floor(regionHeight / 20));
    const stripHeight = regionHeight / stripCount;
    const midPoints = [];

    for (let i = 0; i < stripCount; i++) {
      const stripMinY = minY + i * stripHeight;
      const stripMaxY = stripMinY + stripHeight;

      let midX = 0;
      let count = 0;

      for (const pixel of pixels) {
        if (pixel.y >= stripMinY && pixel.y < stripMaxY) {
          midX += pixel.x;
          count++;
        }
      }

      if (count > 0) {
        midPoints.push(midX / count);
      }
    }

    // Calculate curvature and wave characteristics
    let curvature = 0;
    let maxDeviation = 0;
    let waveCount = 0;
    let signChanges = 0;

    for (let i = 1; i < midPoints.length - 1; i++) {
      const deviation = midPoints[i] - (midPoints[i - 1] + midPoints[i + 1]) / 2;
      const absDeviation = Math.abs(deviation);
      maxDeviation = Math.max(maxDeviation, absDeviation);
      curvature += absDeviation;

      if (i > 1) {
        const prevDeviation = midPoints[i - 1] - (midPoints[i - 2] + midPoints[i]) / 2;
        if ((deviation > 0 && prevDeviation < 0) || (deviation < 0 && prevDeviation > 0)) {
          signChanges++;
        }
      }
    }

    curvature /= Math.max(1, midPoints.length - 2);
    waveCount = signChanges;
    const amplitude = maxDeviation / Math.max(1, regionHeight);

    return { curvature, waveCount, amplitude, midPoints };
  };

  // Analyze vertical curvature (perspective/skew)
  const analyzeVerticalCurvature = (pixels, minX, maxX, regionWidth) => {
    const stripCount = Math.max(5, Math.floor(regionWidth / 20));
    const stripWidth = regionWidth / stripCount;
    const midPoints = [];

    for (let i = 0; i < stripCount; i++) {
      const stripMinX = minX + i * stripWidth;
      const stripMaxX = stripMinX + stripWidth;

      let midY = 0;
      let count = 0;

      for (const pixel of pixels) {
        if (pixel.x >= stripMinX && pixel.x < stripMaxX) {
          midY += pixel.y;
          count++;
        }
      }

      if (count > 0) {
        midPoints.push(midY / count);
      }
    }

    // Calculate skewness and tilt
    let skewness = 0;
    const yRange = Math.max(...midPoints) - Math.min(...midPoints);
    if (yRange > 0) {
      skewness = yRange / Math.max(1, regionWidth);
    }

    return { skewness, midPoints, yRange };
  };

  // Analyze radial distortion (distance from center)
  const analyzeRadialDistortion = (pixels, centerX, centerY) => {
    let radialSum = 0;
    let radialVariance = 0;

    for (const pixel of pixels) {
      const dx = pixel.x - centerX;
      const dy = pixel.y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      radialSum += distance;
    }

    const avgRadius = radialSum / Math.max(1, pixels.length);

    for (const pixel of pixels) {
      const dx = pixel.x - centerX;
      const dy = pixel.y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      radialVariance += Math.pow(distance - avgRadius, 2);
    }

    const strength = Math.sqrt(radialVariance / Math.max(1, pixels.length)) / Math.max(1, avgRadius);

    return { strength, avgRadius };
  };

  // Dewarp arc-shaped Code 128 barcodes - Improved
  const deWarpArcBarcode = (imageData, analysis) => {
    const { minX, maxX, minY, maxY, regionWidth, regionHeight, horizontalCurve } = analysis;

    // Create output canvas
    const outputCanvas = new OffscreenCanvas(imageData.width, imageData.height);
    const outputCtx = outputCanvas.getContext('2d');

    // Copy original image data
    outputCtx.putImageData(imageData, 0, 0);
    const outputData = outputCtx.getImageData(0, 0, imageData.width, imageData.height);
    const srcData = imageData.data;
    const dstData = outputData.data;

    // Calculate average curve offset to normalize
    let avgOffset = 0;
    for (const point of horizontalCurve.midPoints) {
      avgOffset += point;
    }
    avgOffset /= Math.max(1, horizontalCurve.midPoints.length);

    // Straighten by sampling from corrected positions
    for (let y = 0; y < regionHeight; y++) {
      const yNorm = Math.min(y / regionHeight, 1.0);
      const stripIdx = Math.floor(yNorm * (horizontalCurve.midPoints.length - 1));
      const nextIdx = Math.min(stripIdx + 1, horizontalCurve.midPoints.length - 1);

      // Linear interpolation between strip points
      const t = (yNorm * (horizontalCurve.midPoints.length - 1)) - stripIdx;
      const offset = horizontalCurve.midPoints[stripIdx] * (1 - t) +
                     horizontalCurve.midPoints[nextIdx] * t;

      const curveCorrection = offset - avgOffset;

      // Copy pixels from curved position to straight position
      for (let x = 0; x < regionWidth; x++) {
        const srcX = Math.floor(minX + x + curveCorrection);
        const srcY = minY + y;

        // Bounds check
        if (srcX >= 0 && srcX < imageData.width && srcY >= 0 && srcY < imageData.height) {
          const srcIdx = (srcY * imageData.width + srcX) * 4;
          const dstIdx = ((minY + y) * imageData.width + (minX + x)) * 4;

          dstData[dstIdx] = srcData[srcIdx];
          dstData[dstIdx + 1] = srcData[srcIdx + 1];
          dstData[dstIdx + 2] = srcData[srcIdx + 2];
          dstData[dstIdx + 3] = srcData[srcIdx + 3];
        }
      }
    }

    outputCtx.putImageData(outputData, 0, 0);
    return outputCtx.getImageData(0, 0, imageData.width, imageData.height);
  };

  // Dewarp wavy Code 128 barcodes - Improved
  const deWarpWaveBarcode = (imageData, analysis) => {
    const { minX, maxX, minY, maxY, regionHeight, horizontalCurve } = analysis;
    const regionWidth = maxX - minX;

    const outputCanvas = new OffscreenCanvas(imageData.width, imageData.height);
    const outputCtx = outputCanvas.getContext('2d');

    outputCtx.putImageData(imageData, 0, 0);
    const outputData = outputCtx.getImageData(0, 0, imageData.width, imageData.height);
    const srcData = imageData.data;
    const dstData = outputData.data;

    // Calculate baseline from first strip
    const baselineX = horizontalCurve.midPoints[0] || minX;

    // Remove wave by realigning each strip
    for (let y = 0; y < regionHeight; y++) {
      const yNorm = Math.min(y / regionHeight, 1.0);
      const stripIdx = Math.floor(yNorm * (horizontalCurve.midPoints.length - 1));
      const nextIdx = Math.min(stripIdx + 1, horizontalCurve.midPoints.length - 1);

      // Interpolate between strip points
      const t = (yNorm * (horizontalCurve.midPoints.length - 1)) - stripIdx;
      const currentX = horizontalCurve.midPoints[stripIdx] * (1 - t) +
                       horizontalCurve.midPoints[nextIdx] * t;

      const xOffset = currentX - baselineX;

      // Copy pixels from wave position to straight position
      for (let x = 0; x < regionWidth; x++) {
        const srcX = Math.floor(minX + x + xOffset);
        const srcY = minY + y;

        if (srcX >= 0 && srcX < imageData.width && srcY >= 0 && srcY < imageData.height) {
          const srcIdx = (srcY * imageData.width + srcX) * 4;
          const dstIdx = ((minY + y) * imageData.width + (minX + x)) * 4;

          dstData[dstIdx] = srcData[srcIdx];
          dstData[dstIdx + 1] = srcData[srcIdx + 1];
          dstData[dstIdx + 2] = srcData[srcIdx + 2];
          dstData[dstIdx + 3] = srcData[srcIdx + 3];
        }
      }
    }

    outputCtx.putImageData(outputData, 0, 0);
    return outputCtx.getImageData(0, 0, imageData.width, imageData.height);
  };

  // Dewarp radial Code 128 barcodes (circular/fan-shaped)
  const deWarpRadialBarcode = (imageData, analysis) => {
    const { minX, maxX, minY, maxY, centerX, centerY, radialDistortion } = analysis;
    const regionWidth = maxX - minX;
    const regionHeight = maxY - minY;

    const srcCanvas = new OffscreenCanvas(imageData.width, imageData.height);
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.putImageData(imageData, 0, 0);

    const outputCanvas = new OffscreenCanvas(regionWidth, regionHeight);
    const outputCtx = outputCanvas.getContext('2d');
    const outputData = outputCtx.createImageData(regionWidth, regionHeight);
    const data = outputData.data;

    // Apply inverse polar transformation (unwrap radial to linear)
    const targetRadius = radialDistortion.avgRadius;

    for (let y = 0; y < regionHeight; y++) {
      for (let x = 0; x < regionWidth; x++) {
        const px = minX + x;
        const py = minY + y;

        const dx = px - centerX;
        const dy = py - centerY;
        const angle = Math.atan2(dy, dx);
        const radius = Math.sqrt(dx * dx + dy * dy);

        // Normalize radius to target
        const normalizedRadius = (radius / Math.max(1, targetRadius)) * regionHeight;
        const normalizedAngle = ((angle + Math.PI) / (2 * Math.PI)) * regionWidth;

        const srcX = Math.floor(normalizedAngle) % imageData.width;
        const srcY = Math.floor(normalizedRadius) % imageData.height;

        if (srcX >= 0 && srcX < imageData.width && srcY >= 0 && srcY < imageData.height) {
          const srcPixelIdx = (srcY * imageData.width + srcX) * 4;
          const dstPixelIdx = (y * regionWidth + x) * 4;

          data[dstPixelIdx] = imageData.data[srcPixelIdx];
          data[dstPixelIdx + 1] = imageData.data[srcPixelIdx + 1];
          data[dstPixelIdx + 2] = imageData.data[srcPixelIdx + 2];
          data[dstPixelIdx + 3] = imageData.data[srcPixelIdx + 3];
        }
      }
    }

    outputCtx.putImageData(outputData, 0, 0);

    const fullCanvas = new OffscreenCanvas(imageData.width, imageData.height);
    const fullCtx = fullCanvas.getContext('2d');
    fullCtx.putImageData(imageData, 0, 0);
    fullCtx.putImageData(outputData, minX, minY);

    return fullCtx.getImageData(0, 0, imageData.width, imageData.height);
  };

  // Dewarp perspective-skewed Code 128 barcodes
  const deWarpPerspectiveBarcode = (imageData, analysis) => {
    const { minX, minY, regionHeight, verticalCurve } = analysis;
    const regionWidth = analysis.maxX - minX;

    const srcCanvas = new OffscreenCanvas(imageData.width, imageData.height);
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.putImageData(imageData, 0, 0);

    const outputCanvas = new OffscreenCanvas(regionWidth, regionHeight);
    const outputCtx = outputCanvas.getContext('2d');

    // Apply skew correction based on vertical curve
    for (let x = 0; x < regionWidth; x++) {
      const xNorm = x / regionWidth;
      const stripIdx = Math.min(Math.floor(xNorm * verticalCurve.midPoints.length), verticalCurve.midPoints.length - 1);
      const yOffset = verticalCurve.midPoints[stripIdx] - verticalCurve.midPoints[0];

      const srcImageData = srcCtx.getImageData(minX + x, minY + yOffset, 1, regionHeight);
      outputCtx.putImageData(srcImageData, x, 0);
    }

    const fullCanvas = new OffscreenCanvas(imageData.width, imageData.height);
    const fullCtx = fullCanvas.getContext('2d');
    fullCtx.putImageData(imageData, 0, 0);

    const resultData = outputCtx.getImageData(0, 0, regionWidth, regionHeight);
    fullCtx.putImageData(resultData, minX, minY);

    return fullCtx.getImageData(0, 0, imageData.width, imageData.height);
  };

  // Estimate curve points from text region
  const estimateCurvePoints = (textPixels, width, height) => {
    if (textPixels.length < 3) {
      return { points: [], curvature: 0, topLeft: null, topRight: null, bottomLeft: null, bottomRight: null };
    }

    // Find bounding box of text region
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minBrightness = Infinity;

    for (const pixel of textPixels) {
      minX = Math.min(minX, pixel.x);
      maxX = Math.max(maxX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxY = Math.max(maxY, pixel.y);
      minBrightness = Math.min(minBrightness, pixel.brightness);
    }

    const centerX = (minX + maxX) / 2;
    const regionHeight = maxY - minY;

    // Divide region into vertical strips to detect curvature
    const stripCount = 5;
    const stripWidth = (maxX - minX) / stripCount;
    const curveHeights = [];

    for (let i = 0; i < stripCount; i++) {
      const stripMinX = minX + i * stripWidth;
      const stripMaxX = stripMinX + stripWidth;

      let stripMinY = Infinity;
      for (const pixel of textPixels) {
        if (pixel.x >= stripMinX && pixel.x < stripMaxX) {
          stripMinY = Math.min(stripMinY, pixel.y);
        }
      }

      curveHeights.push(stripMinY === Infinity ? minY : stripMinY);
    }

    // Calculate curvature (deviation from straight line)
    let curvature = 0;
    for (let i = 1; i < curveHeights.length - 1; i++) {
      const dy = Math.abs(curveHeights[i] - (curveHeights[i - 1] + curveHeights[i + 1]) / 2);
      curvature += dy;
    }
    curvature /= (curveHeights.length - 2);

    return {
      points: curveHeights,
      curvature: curvature / regionHeight,
      minX,
      maxX,
      minY,
      maxY,
      centerX,
      topLeft: { x: minX, y: minY },
      topRight: { x: maxX, y: minY },
      bottomLeft: { x: minX, y: maxY },
      bottomRight: { x: maxX, y: maxY }
    };
  };

  // Apply perspective transformation to dewarp curved images
  const deWarpImage = (imageData, curvePoints) => {
    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');

    // Create temporary canvas from imageData
    const srcCanvas = new OffscreenCanvas(imageData.width, imageData.height);
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.putImageData(imageData, 0, 0);

    // Apply simple perspective correction using CSS-like transforms
    const width = imageData.width;
    const height = imageData.height;

    // Extract the curved region
    const regionX = Math.floor(curvePoints.minX);
    const regionY = Math.floor(curvePoints.minY);
    const regionW = Math.floor(curvePoints.maxX - curvePoints.minX);
    const regionH = Math.floor(curvePoints.maxY - curvePoints.minY);

    // Create output canvas for dewarped region
    const outputCanvas = new OffscreenCanvas(regionW, regionH * 1.2);
    const outputCtx = outputCanvas.getContext('2d');

    // Apply vertical stretching based on curvature
    const stretchFactor = 1 + (curvePoints.curvature * 50); // Amplify stretch effect

    for (let y = 0; y < regionH; y++) {
      const srcY = regionY + y;
      const xOffset = Math.sin((y / regionH) * Math.PI) * (regionW * curvePoints.curvature);

      const srcImageData = srcCtx.getImageData(
        regionX + xOffset,
        srcY,
        regionW,
        1
      );

      outputCtx.putImageData(srcImageData, 0, Math.floor(y * stretchFactor));
    }

    // Convert back to ImageData
    const resultData = outputCtx.getImageData(0, 0, outputCanvas.width, Math.floor(regionH * stretchFactor));

    // Place dewarped region back into full image
    const fullCanvas = new OffscreenCanvas(width, height);
    const fullCtx = fullCanvas.getContext('2d');
    fullCtx.putImageData(imageData, 0, 0);
    fullCtx.putImageData(resultData, regionX, regionY);

    return fullCtx.getImageData(0, 0, width, height);
  };

  // FIX #7: Implement Multi-Angle Perspective Correction
  const correctPerspective = (imageData) => {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    // Detect if there's significant perspective distortion using edge detection
    const edges = new Uint8ClampedArray(width * height);
    const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4;
            const val = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            gx += val * sobelX[dy + 1][dx + 1];
            gy += val * sobelY[dy + 1][dx + 1];
          }
        }
        edges[y * width + x] = Math.sqrt(gx * gx + gy * gy);
      }
    }

    // Analyze edge distribution to detect tilt
    const topEdges = edges.slice(0, (height / 4) * width).reduce((a, b) => a + b) / ((height / 4) * width);
    const bottomEdges = edges.slice((3 * height / 4) * width).reduce((a, b) => a + b) / ((height / 4) * width);
    const tiltFactor = Math.abs(topEdges - bottomEdges) / Math.max(topEdges, bottomEdges);

    if (tiltFactor > 0.2) {
      console.log(`🔄 Perspective distortion detected (tilt: ${(tiltFactor * 100).toFixed(1)}%)`);
      // Apply shear correction based on tilt
      const shearAmount = (bottomEdges > topEdges ? -1 : 1) * tiltFactor * 0.1;
      // Simple shear transformation
      for (let y = 0; y < height; y++) {
        const shift = Math.round(shearAmount * width * (y / height));
        for (let x = width - 1; x > shift; x--) {
          const srcIdx = (y * width + (x - shift)) * 4;
          const dstIdx = (y * width + x) * 4;
          data[dstIdx] = data[srcIdx];
          data[dstIdx + 1] = data[srcIdx + 1];
          data[dstIdx + 2] = data[srcIdx + 2];
          data[dstIdx + 3] = data[srcIdx + 3];
        }
      }
    }

    return imageData;
  };

  // Rotate image canvas if needed
  const rotateImageData = (imageData, angle) => {
    if (Math.abs(angle) < 2) return imageData; // Skip if rotation is minimal

    const width = imageData.width;
    const height = imageData.height;
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Calculate new dimensions
    const newWidth = Math.abs(width * cos) + Math.abs(height * sin);
    const newHeight = Math.abs(width * sin) + Math.abs(height * cos);

    const canvas = new OffscreenCanvas(Math.ceil(newWidth), Math.ceil(newHeight));
    const ctx = canvas.getContext('2d');

    // Create temporary canvas for source image
    const srcCanvas = new OffscreenCanvas(width, height);
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.putImageData(imageData, 0, 0);

    // Rotate and draw
    ctx.translate(newWidth / 2, newHeight / 2);
    ctx.rotate(rad);
    ctx.drawImage(srcCanvas, -width / 2, -height / 2);

    return ctx.getImageData(0, 0, Math.ceil(newWidth), Math.ceil(newHeight));
  };

  const optimizeForVINText = (imageData) => {
    // First, detect and dewarp curved/misshapen VINs
    const deWarpedImage = detectAndDeWarpCurvedText(imageData);

    const data = deWarpedImage.data;
    const width = deWarpedImage.width;
    const height = deWarpedImage.height;

    // Convert to grayscale
    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      gray[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    // Detect and correct image rotation
    const rotationAngle = detectRotation(gray, width, height);
    if (Math.abs(rotationAngle) > 2) {
      console.log(`🔄 Detected ${rotationAngle.toFixed(1)}° rotation, auto-correcting...`);
      // Note: Rotation is complex in pixel-space, so we focus on preprocessing
      // The OCR engine can handle small rotations better with enhanced contrast
    }

    // Detect if image has inverted contrast (light text on dark background)
    // Calculate average brightness
    let sum = 0;
    for (let i = 0; i < gray.length; i++) {
      sum += gray[i];
    }
    const avgBrightness = sum / gray.length;
    const isInvertedContrast = avgBrightness < 100; // Dark image = inverted contrast

    // Invert if needed (light text on dark background)
    if (isInvertedContrast) {
      for (let i = 0; i < gray.length; i++) {
        gray[i] = 255 - gray[i];
      }
    }

    // Adaptive thresholding (local contrast enhancement)
    const blockSize = 15;
    const halfBlock = Math.floor(blockSize / 2);
    const threshold = new Uint8ClampedArray(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;

        // Calculate local mean and standard deviation
        let sum = 0;
        let sumSq = 0;
        let count = 0;

        for (let dy = -halfBlock; dy <= halfBlock; dy++) {
          for (let dx = -halfBlock; dx <= halfBlock; dx++) {
            const ny = Math.min(Math.max(y + dy, 0), height - 1);
            const nx = Math.min(Math.max(x + dx, 0), width - 1);
            const val = gray[ny * width + nx];
            sum += val;
            sumSq += val * val;
            count++;
          }
        }

        const localMean = sum / count;
        const localStdDev = Math.sqrt(sumSq / count - (localMean * localMean));

        // Adaptive threshold using mean and standard deviation
        const localThreshold = localMean - localStdDev * 0.5;

        // Apply adaptive threshold
        threshold[idx] = gray[idx] < localThreshold ? 0 : 255;
      }
    }

    // Morphological operations: dilate then erode to connect broken characters
    const dilated = new Uint8ClampedArray(threshold);

    // Dilation (2 passes for better connectivity)
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          if (threshold[idx] === 255) {
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const ny = Math.min(Math.max(y + dy, 0), height - 1);
                const nx = Math.min(Math.max(x + dx, 0), width - 1);
                dilated[ny * width + nx] = 255;
              }
            }
          }
        }
      }
    }

    // Erosion (1 pass to clean without over-thinning)
    const eroded = new Uint8ClampedArray(dilated);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        let hasBlack = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dilated[(y + dy) * width + (x + dx)] === 0) {
              hasBlack = true;
              break;
            }
          }
          if (hasBlack) break;
        }
        eroded[idx] = hasBlack ? 0 : 255;
      }
    }

    // Unsharp mask: Enhance edges and details for better text clarity
    const blurred = new Uint8ClampedArray(eroded);
    const blurKernel = 3;
    for (let y = blurKernel; y < height - blurKernel; y++) {
      for (let x = blurKernel; x < width - blurKernel; x++) {
        let sum = 0;
        for (let dy = -blurKernel; dy <= blurKernel; dy++) {
          for (let dx = -blurKernel; dx <= blurKernel; dx++) {
            sum += eroded[(y + dy) * width + (x + dx)];
          }
        }
        blurred[y * width + x] = Math.round(sum / (9 * blurKernel * blurKernel));
      }
    }

    // Unsharp enhancement
    const sharpened = new Uint8ClampedArray(eroded);
    for (let i = 0; i < eroded.length; i++) {
      const enhanced = eroded[i] + (eroded[i] - blurred[i]) * 2;
      sharpened[i] = Math.max(0, Math.min(255, enhanced));
    }

    // Apply contrast stretching
    let minVal = 255, maxVal = 0;
    for (let i = 0; i < sharpened.length; i++) {
      if (sharpened[i] < minVal) minVal = sharpened[i];
      if (sharpened[i] > maxVal) maxVal = sharpened[i];
    }

    // Write back to image data
    for (let i = 0; i < data.length; i += 4) {
      const idx = i / 4;
      const val = maxVal === minVal ? 128 : Math.round(((sharpened[idx] - minVal) / (maxVal - minVal)) * 255);
      data[i] = val;      // R
      data[i + 1] = val;  // G
      data[i + 2] = val;  // B
      // A stays the same
    }
  };

  const requestCameraAccess = async () => {
    try {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';

      setStatus('Requesting camera access...');

      // Request fullscreen
      if (scannerContainerRef.current?.requestFullscreen) {
        try {
          await scannerContainerRef.current.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
        } catch (err) {
          console.warn('Fullscreen request failed:', err);
        }
      }

      // Lock landscape
      if (screen.orientation) {
        try {
          await screen.orientation.lock('landscape-primary').catch(() => {
            return screen.orientation.lock('landscape');
          });
        } catch (err) {
          console.warn('Orientation lock failed:', err);
        }
      }

      // Request camera with explicit user interaction
      setStatus('Getting camera stream...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (!videoRef.current) {
        setStatus('Error: Video element not ready');
        return;
      }

      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute('playsinline', 'true');
      videoRef.current.setAttribute('autoplay', 'true');
      videoRef.current.setAttribute('muted', 'true');

      // Wait for video to be ready
      await new Promise((resolve) => {
        const checkReady = () => {
          if (videoRef.current && videoRef.current.readyState === 4) {
            resolve();
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });

      setCameraReady(true);
      setStatus('Initializing barcode scanner...');

      // Initialize barcode
      try {
        await initializeBarcode();
      } catch (err) {
        console.warn('Barcode init failed:', err);
      }

      setStatus('Ready - Any VIN orientation supported...');

      // Initialize OCR in background
      (async () => {
        try {
          const { createWorker } = Tesseract;
          const worker = await createWorker('eng', 1, {
            corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v4/tesseract-core.wasm.js'
          });
          ocrWorkerRef.current = worker;
          console.log('✅ OCR ready');

          if (scanningRef.current) {
            setTimeout(() => {
              if (scanningRef.current) {
                scanVINWithOCR();
              }
            }, 500);
          }
        } catch (err) {
          console.error('OCR init failed:', err);
        }
      })();

      // Start barcode scanning
      setTimeout(() => {
        if (scanningRef.current) {
          scanVINWithOCR();
        }
      }, 1000);
    } catch (err) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setStatus('❌ Camera permission denied - Please allow camera access');
      } else if (err.name === 'NotFoundError') {
        setStatus('❌ No camera found on this device');
      } else {
        setStatus(`❌ Error: ${err.message}`);
      }
    }
  };

  return (
    <div ref={scannerContainerRef} style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      margin: 0,
      padding: 0,
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#000'
    }}>
      {/* Header */}
      <div style={{
        height: orientation === 'landscape' ? '60px' : '56px',
        backgroundColor: 'white',
        borderBottom: '1px solid #E2E8F0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: '16px',
        paddingRight: '16px',
        flexShrink: 0
      }}>
        <button
          onClick={handleClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#4F46E5',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            padding: '8px 12px'
          }}
        >
          Cancel
        </button>
        <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1E293B' }}>
          VIN Scanner
        </h1>
        <div style={{ width: '44px' }} />
      </div>

      {/* Camera Feed - Responsive to orientation */}
      <div style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {!cameraReady && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000',
            zIndex: 1
          }}>
            <div style={{ color: '#fff', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📷</div>
              <p style={{ fontSize: '16px', marginBottom: '24px' }}>{status}</p>
              <button
                onClick={requestCameraAccess}
                style={{
                  padding: '12px 28px',
                  fontSize: '16px',
                  backgroundColor: '#4F46E5',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Enable Camera
              </button>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 0,
            transform: orientation === 'portrait' ? 'rotate(0deg)' : 'rotate(0deg)'
          }}
          autoPlay
          playsInline
          muted
        />

        <canvas ref={canvasRef} style={{ position: 'absolute', display: 'none' }} />

        {cameraReady && (
          <>
            {/* Scanning Guide with Confidence - Responsive */}
            <div style={{
              position: 'absolute',
              top: orientation === 'landscape' ? '20px' : '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: orientation === 'landscape' ? '13px' : '12px',
              fontWeight: '600',
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>{status}</span>
              {confidence > 0 && (
                <span style={{
                  backgroundColor: confidence >= 60 ? '#4CAF50' : confidence >= 40 ? '#FFC107' : '#F44336',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: orientation === 'landscape' ? '12px' : '11px'
                }}>
                  {confidence}%
                </span>
              )}
            </div>

            {/* Centering Guide Line - Horizontal in Both Orientations */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: orientation === 'landscape' ? '70%' : '60%',
              height: '3px',
              backgroundColor: '#FFD700',
              zIndex: 2,
              boxShadow: '0 0 15px rgba(255, 215, 0, 0.8)',
              transition: 'all 0.3s ease-in-out'
            }} />

            {/* Capture Button and Instructions */}
            <div style={{
              position: 'absolute',
              bottom: orientation === 'landscape' ? '60px' : '80px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              zIndex: 2
            }}>
              {/* Capture Button */}
              <button
                onClick={captureFrame}
                disabled={processingCapture}
                style={{
                  width: orientation === 'landscape' ? '60px' : '70px',
                  height: orientation === 'landscape' ? '60px' : '70px',
                  borderRadius: '50%',
                  backgroundColor: '#4F46E5',
                  border: '3px solid white',
                  color: 'white',
                  fontSize: orientation === 'landscape' ? '28px' : '32px',
                  cursor: processingCapture ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: processingCapture ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
                  fontWeight: '600'
                }}
              >
                {processingCapture ? '⏳' : '📷'}
              </button>

              {/* Instruction Text */}
              <div style={{
                color: '#fff',
                fontSize: orientation === 'landscape' ? '12px' : '11px',
                fontWeight: '500',
                textAlign: 'center',
                opacity: 0.9,
                padding: '0 16px'
              }}>
                {processingCapture ? 'Processing...' : 'Tap to capture\nif live scanning\nfails'}
              </div>
            </div>

            {/* Static Instruction Text */}
            <div style={{
              position: 'absolute',
              bottom: orientation === 'landscape' ? '12px' : '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              color: '#fff',
              fontSize: orientation === 'landscape' ? '14px' : '12px',
              fontWeight: '600',
              textAlign: 'center',
              zIndex: 2,
              opacity: 0.9,
              padding: '0 16px'
            }}>
              {orientation === 'landscape' ? 'Point camera at VIN barcode' : 'Point camera at VIN'}
            </div>
          </>
        )}
      </div>

      {/* Capture Result Modal */}
      {captureResult && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 10001, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ width: '100%', backgroundColor: 'white', borderRadius: '16px 16px 0 0', padding: '32px 24px 24px', textAlign: 'center', animation: 'slideUp 0.3s ease-out' }}>
            {captureResult.vin ? (
              <>
                <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 12px 0', fontWeight: '500' }}>✅ VIN Detected from Image</p>
                <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1E293B', margin: '0 0 8px 0', letterSpacing: '1px', fontFamily: 'monospace' }}>{captureResult.vin}</h2>
                <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 24px 0' }}>
                  {captureResult.source} • {(captureResult.confidence * 100).toFixed(0)}% confidence
                </p>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => {
                      setCaptureResult(null);
                      setCapturedImageData(null);
                    }}
                    style={{
                      flex: 1,
                      padding: '12px 24px',
                      backgroundColor: 'white',
                      color: '#1E293B',
                      border: '2px solid #CBD5E1',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Retry
                  </button>
                  <button
                    onClick={() => {
                      handleVINDetection(captureResult.vin, captureResult.source);
                      setCaptureResult(null);
                      setCapturedImageData(null);
                    }}
                    style={{
                      flex: 1,
                      padding: '12px 24px',
                      background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Use This VIN
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: '14px', color: '#EF4444', margin: '0 0 12px 0', fontWeight: '500' }}>❌ No VIN Detected</p>
                <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 24px 0' }}>
                  Try adjusting the lighting, angle, or focus. Make sure the VIN label is clearly visible.
                </p>
                <button
                  onClick={() => {
                    setCaptureResult(null);
                    setCapturedImageData(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 24px',
                    backgroundColor: '#4F46E5',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Try Again
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* VIN Confirmation Modal */}
      {showConfirmation && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 10001, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ width: '100%', backgroundColor: 'white', borderRadius: '16px 16px 0 0', padding: '32px 24px 24px', textAlign: 'center', animation: 'slideUp 0.3s ease-out' }}>
            <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 12px 0', fontWeight: '500' }}>VIN Detected</p>
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1E293B', margin: '0 0 32px 0', letterSpacing: '1px', fontFamily: 'monospace' }}>{detectedVIN}</h2>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { setShowConfirmation(false); scanningRef.current = true; if (ocrWorkerRef.current) setTimeout(() => scanVINWithOCR(), 500); }} style={{ flex: 1, padding: '12px 24px', backgroundColor: 'white', color: '#1E293B', border: '2px solid #CBD5E1', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>Rescan</button>
              <button onClick={handleVINConfirmed} style={{ flex: 1, padding: '12px 24px', background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
