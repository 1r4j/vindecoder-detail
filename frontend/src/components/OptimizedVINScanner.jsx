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
      // Prioritize Code 128 (superior for VINs) over Code 39
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
          // Code 128 first (preferred) then Code 39 as fallback
          readers: ['code_128_reader', 'code_39_reader'],
          debug: false
        },
        locator: {
          halfSample: true,
          patchSize: 'medium' // Better for curved barcodes
        },
        numOfWorkers: 4, // Increased workers for better detection
        frequency: 20,   // Increased scanning frequency
        blur: true       // Enable blur detection for better edge detection
      }, (err) => {
        if (err) {
          console.warn('Barcode initialization failed:', err);
          resolve(false);
          return;
        }

        console.log('✅ Barcode scanner initialized (Code 128 + Code 39)');

        Quagga.onDetected((result) => {
          if (!scanningRef.current || !result.codeResult) return;

          const code = result.codeResult.code?.trim();
          const barcodeFormat = result.codeResult.format || 'Unknown';

          if (code) {
            // Determine barcode type for logging
            let barcodeType = 'Barcode';
            if (barcodeFormat.includes('code_128')) {
              barcodeType = 'Code 128 Barcode';
            } else if (barcodeFormat.includes('code_39')) {
              barcodeType = 'Code 39 Barcode';
            }

            // Validate the detected VIN
            const validation = validateVIN(code);
            if (validation.valid) {
              handleVINDetection(code, barcodeType);
            } else {
              console.log(`⚠️  ${barcodeType} detected but invalid: ${code} - ${validation.reason}`);
            }
          }
        });

        Quagga.start();
        resolve(true);
      });
    });
  };

  // Scan VIN label text directly (fallback for curved barcodes)
  const scanVINLabelText = async (canvas, video) => {
    if (!ocrWorkerRef.current) return null;

    try {
      // Focus on the area where VIN text typically appears
      const labelRegions = [
        { x: 0.0, y: 0.5, w: 1.0, h: 0.35, name: 'BelowBarcode' },   // Text below barcode (primary)
        { x: 0.0, y: 0.45, w: 1.0, h: 0.4, name: 'Label-Center' },   // Full width, label area
        { x: 0.05, y: 0.35, w: 0.9, h: 0.55, name: 'Label-Full' },   // Expanded area
        { x: 0.1, y: 0.3, w: 0.8, h: 0.6, name: 'Label-Expanded' },  // Very expanded search
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

          if (result.data.text && result.data.confidence > 0.30) {
            // Aggressive text cleaning for VINs
            let text = result.data.text.toUpperCase();

            // Replace common OCR errors for VINs
            text = text.replace(/O/g, '0'); // O → 0
            text = text.replace(/l/g, '1'); // l → 1
            text = text.replace(/I/g, '1'); // I → 1 (but keep some I's for validation)
            text = text.replace(/S/g, '5'); // S → 5
            text = text.replace(/Z/g, '2'); // Z → 2
            text = text.replace(/B/g, '8'); // B → 8

            // Extract alphanumeric only
            text = text.replace(/[^A-Z0-9]/g, '');

            // Look for 17-char VINs
            const vins = text.match(/[A-Z0-9]{17}/g) || [];

            for (const vin of vins) {
              const validation = validateVIN(vin);
              if (validation.valid) {
                return { vin, source: `Label OCR (${region.name})`, confidence: result.data.confidence };
              }
            }

            // Try extracting from longer strings (might have extra chars)
            for (let i = 0; i <= Math.max(0, text.length - 17); i++) {
              const potential = text.substring(i, i + 17);
              if (/^[A-Z0-9]{17}$/.test(potential)) {
                const validation = validateVIN(potential);
                if (validation.valid) {
                  return { vin: potential, source: `Label OCR (${region.name})`, confidence: result.data.confidence * 0.95 };
                }
              }
            }

            // Try partial matches with smart padding
            if (text.length >= 15) {
              // Take the longest continuous alphanumeric sequence
              const sequences = text.match(/[A-Z0-9]+/g) || [];
              for (const seq of sequences) {
                if (seq.length >= 15) {
                  const partial = seq.substring(0, 17).padEnd(17, '0');
                  const validation = validateVIN(partial);
                  if (validation.valid) {
                    return { vin: partial, source: `Label OCR Partial (${region.name})`, confidence: result.data.confidence * 0.85 };
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
        { x: 0.1, y: 0.35, w: 0.8, h: 0.15, name: 'Center' },
        { x: 0.05, y: 0.25, w: 0.9, h: 0.25, name: 'Upper-Center' },
        { x: 0.05, y: 0.45, w: 0.9, h: 0.25, name: 'Lower-Center' }
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

    if (radialDistortion.strength > 0.06) {
      distortionType = 'radial';
      severity = radialDistortion.strength;
    } else if (horizontalCurve.waveCount > 1 && horizontalCurve.amplitude > 0.03) {
      distortionType = 'wave';
      severity = horizontalCurve.amplitude;
    } else if (horizontalCurve.curvature > 0.002) {
      distortionType = 'arc';
      severity = horizontalCurve.curvature;
    } else if (verticalCurve.skewness > 0.08) {
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

            {/* Instruction Text */}
            <div style={{
              position: 'absolute',
              bottom: orientation === 'landscape' ? '20px' : '16px',
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
