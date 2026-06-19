import { useEffect, useRef, useState } from 'react';
import Tesseract from 'tesseract.js';
import jsQR from 'jsqr';
import Quagga from '@ericblade/quagga2';

export default function AdvancedVINScanner({ onScan, onClose }) {
  const [error, setError] = useState('');
  const [detectedVIN, setDetectedVIN] = useState('');
  const [status, setStatus] = useState('🔍 Initializing multi-format scanner...');
  const [manualVIN, setManualVIN] = useState('');
  const [detectionMethod, setDetectionMethod] = useState('');
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanningRef = useRef(true);
  const onCloseRef = useRef(onClose);
  const ocrWorkerRef = useRef(null);
  const detectedVINsRef = useRef(new Set());
  const lastScanRef = useRef(0);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Handle orientation changes
  useEffect(() => {
    const handleOrientationChange = () => {
      const landscape = window.innerWidth > window.innerHeight;
      setIsLandscape(landscape);
      console.log(`Orientation changed: ${landscape ? 'landscape' : 'portrait'}`);
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, []);

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
        const unlockPromise = screen.orientation.unlock();
        if (unlockPromise?.catch) unlockPromise.catch(() => {});
      } catch (err) {
        console.warn('Unlock error:', err);
      }
    }

    if (document.fullscreenElement) {
      try {
        const exitPromise = document.exitFullscreen();
        if (exitPromise?.catch) exitPromise.catch(() => {});
      } catch (err) {
        console.warn('Exit fullscreen error:', err);
      }
    }

    document.body.style.overflow = 'auto';
    document.body.style.position = 'relative';
    document.body.style.width = 'auto';

    setTimeout(() => {
      onCloseRef.current();
    }, 100);
  };

  const validateVIN = (vin) => {
    if (!vin || typeof vin !== 'string') {
      console.log('VIN validation failed: not a string');
      return false;
    }

    const cleaned = vin.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Must be exactly 17 characters
    if (cleaned.length !== 17) {
      console.log(`VIN validation failed: length is ${cleaned.length}, expected 17`);
      return false;
    }

    // Must not contain I, O, Q
    if (/[IOQ]/.test(cleaned)) {
      console.log(`VIN validation failed: contains forbidden characters I, O, or Q`);
      return false;
    }

    // Position 10 (year code, 0-indexed position 9) must be valid
    const yearCode = cleaned[9];
    const validYears = 'ABCDEFGHJKLMNPRSTVWXY'; // Valid year codes (no I, O, U, Z)
    if (!validYears.includes(yearCode)) {
      console.log(`VIN validation failed: invalid year code '${yearCode}' at position 10`);
      return false;
    }

    // Position 9 (check digit, 0-indexed position 8) validation using VIN check digit algorithm
    if (!validateCheckDigit(cleaned)) {
      console.log(`VIN validation failed: check digit validation failed`);
      return false;
    }

    // First 3 characters should be manufacturer code (alphanumeric, no I/O/Q)
    if (!/^[A-Z0-9]{3}/.test(cleaned)) {
      console.log(`VIN validation failed: invalid manufacturer code '${cleaned.substring(0, 3)}'`);
      return false;
    }

    // Characters 4-8 (positions 3-7, 5 chars) should be vehicle descriptor section
    const descriptor = cleaned.substring(3, 8);
    if (!/^[A-Z0-9]{5}$/.test(descriptor)) {
      console.log(`VIN validation failed: invalid descriptor section '${descriptor}'`);
      return false;
    }

    return true;
  };

  const validateCheckDigit = (vin) => {
    // VIN check digit algorithm (position 8, 0-indexed)
    const translationTable = {
      'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8,
      'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'P': 7, 'R': 9,
      'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9,
      '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9
    };

    // Weights for each position (position 8 has weight 0 and is skipped)
    const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

    let sum = 0;
    for (let i = 0; i < 17; i++) {
      if (i === 8) continue; // Skip check digit position

      const char = vin[i];
      const value = translationTable[char];

      if (value === undefined) {
        console.log(`Invalid character at position ${i}: '${char}'`);
        return false;
      }

      sum += value * weights[i];
    }

    const checkDigit = sum % 11;
    const expectedCheckDigit = checkDigit === 10 ? 'X' : checkDigit.toString();
    const actualCheckDigit = vin[8];

    const isValid = actualCheckDigit === expectedCheckDigit;
    if (!isValid) {
      console.log(`Check digit mismatch: expected '${expectedCheckDigit}', got '${actualCheckDigit}' (sum=${sum}, mod=${checkDigit})`);
    }

    return isValid;
  };

  const handleVINDetected = (vin, method) => {
    const cleaned = vin.toUpperCase().replace(/[^A-Z0-9]/g, '');

    console.log(`🔍 Testing VIN: '${cleaned}' from ${method}`);

    if (validateVIN(cleaned)) {
      if (detectedVINsRef.current.has(cleaned)) {
        console.log(`⚠️ VIN already detected: ${cleaned}`);
        return;
      }

      detectedVINsRef.current.add(cleaned);
      console.log(`✅ Valid VIN confirmed: ${cleaned} via ${method}`);
      setDetectedVIN(cleaned);
      setDetectionMethod(method);
      setStatus(`✅ Valid VIN detected via ${method}!`);
      scanningRef.current = false;

      setTimeout(() => {
        handleClose();
        setTimeout(() => {
          onScan(cleaned);
        }, 100);
      }, 800);
    } else {
      console.log(`❌ Invalid VIN rejected: '${cleaned}' via ${method}`);
      setStatus(`⚠️ Invalid VIN format detected via ${method}. Please adjust position.`);
    }
  };

  // Initialize Quagga for barcode detection (Code 39, Code 128, etc.)
  const initializeQuagga = async () => {
    return new Promise((resolve) => {
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
          readers: ['code_128_reader', 'code_39_reader', 'ean_reader', 'upc_reader']
        },
        numOfWorkers: 2,
        frequency: 10
      }, (err) => {
        if (err) {
          console.warn('Quagga init failed:', err);
          resolve(false);
          return;
        }

        Quagga.onDetected((result) => {
          if (!scanningRef.current) return;

          if (result.codeResult && result.codeResult.code) {
            const code = result.codeResult.code;
            if (validateVIN(code)) {
              handleVINDetected(code, 'Barcode (Code 128/39)');
            }
          }
        });

        Quagga.start();
        resolve(true);
      });
    });
  };

  // QR Code detection
  const scanQRCode = (imageData) => {
    try {
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data) {
        if (validateVIN(code.data)) {
          handleVINDetected(code.data, 'QR Code');
        }
      }
    } catch (err) {
      // Silent fail - QR might not be present
    }
  };

  // OCR text detection with multi-region scanning
  const scanWithOCR = async () => {
    if (!scanningRef.current || !videoRef.current || !canvasRef.current) return;

    const now = Date.now();
    if (now - lastScanRef.current < 2000) {
      setTimeout(scanWithOCR, 500);
      return;
    }

    lastScanRef.current = now;

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      if (video.readyState !== 2) {
        setTimeout(scanWithOCR, 500);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Scan for QR codes first
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      scanQRCode(imageData);

      // Multi-region scanning strategy to handle obstructed visibility
      const scanRegions = [
        // Central region (primary - typical VIN location on dashboard)
        { top: 0.35, height: 0.15, left: 0.08, width: 0.85, name: 'Center' },
        // Upper region (windshield VIN label)
        { top: 0.15, height: 0.15, left: 0.1, width: 0.8, name: 'Upper' },
        // Lower region (door jamb area)
        { top: 0.55, height: 0.15, left: 0.05, width: 0.9, name: 'Lower' },
        // Left region (door sticker)
        { top: 0.3, height: 0.2, left: 0.0, width: 0.35, name: 'Left' },
        // Right region (opposite door sticker)
        { top: 0.3, height: 0.2, left: 0.65, width: 0.35, name: 'Right' }
      ];

      for (const region of scanRegions) {
        const cropTop = Math.floor(canvas.height * region.top);
        const cropHeight = Math.floor(canvas.height * region.height);
        const cropLeft = Math.floor(canvas.width * region.left);
        const cropWidth = Math.floor(canvas.width * region.width);

        try {
          const croppedImageData = ctx.getImageData(cropLeft, cropTop, cropWidth, cropHeight);

          // Apply advanced image enhancement
          enhanceImageForText(croppedImageData);

          const croppedCanvas = document.createElement('canvas');
          croppedCanvas.width = cropWidth;
          croppedCanvas.height = cropHeight;
          const croppedCtx = croppedCanvas.getContext('2d');
          croppedCtx.putImageData(croppedImageData, 0, 0);

          const result = await ocrWorkerRef.current.recognize(croppedCanvas);

          if (result.data.text && result.data.confidence > 0.5) {
            // Extract all potential 17-character sequences
            const text = result.data.text.replace(/\s+/g, '').toUpperCase();
            const potentialVINs = text.match(/[A-Z0-9]{17}/g) || [];

            for (const potentialVIN of potentialVINs) {
              if (validateVIN(potentialVIN)) {
                console.log(`✅ Valid VIN found in ${region.name}: ${potentialVIN} (confidence: ${(result.data.confidence * 100).toFixed(1)}%)`);
                handleVINDetected(potentialVIN, `OCR Text (${region.name})`);
                return; // Stop scanning other regions once valid VIN found
              } else {
                console.log(`❌ Invalid VIN rejected in ${region.name}: ${potentialVIN}`);
              }
            }

            // Also look for partial VINs that might be obstructed (12+ chars)
            const partialMatches = text.match(/[A-Z0-9]{12,16}/g) || [];
            for (const partial of partialMatches) {
              // Only log if it looks promising (has valid year position)
              if (partial.length >= 16 && result.data.confidence > 0.7) {
                console.log(`ℹ️ Partial VIN in ${region.name}: ${partial} (${partial.length} chars, confidence: ${(result.data.confidence * 100).toFixed(1)}%)`);
              }
            }
          }
        } catch (err) {
          console.log(`Region ${region.name} scan failed:`, err.message);
          continue;
        }
      }

      if (scanningRef.current) {
        setTimeout(scanWithOCR, 500);
      }
    } catch (err) {
      console.error('OCR scan error:', err);
      if (scanningRef.current) {
        setTimeout(scanWithOCR, 500);
      }
    }
  };

  const enhanceImageForText = (imageData) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Step 1: Convert to grayscale and normalize
    const grayData = new Uint8ClampedArray(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      grayData[i / 4] = gray;
    }

    // Step 2: Detect lighting conditions
    let mean = 0;
    for (let i = 0; i < grayData.length; i++) {
      mean += grayData[i];
    }
    mean /= grayData.length;

    // Step 3: Adaptive histogram equalization (CLAHE-like)
    const enhancedData = new Uint8ClampedArray(width * height);
    const clipLimit = 2.0;
    const bins = 256;

    for (let i = 0; i < grayData.length; i++) {
      let value = grayData[i];

      // Boost dark areas (low light compensation)
      if (mean < 100) {
        value = Math.min(255, value * 1.4);
      }

      // Reduce glare in bright areas
      if (mean > 180) {
        value = Math.min(255, value * 0.95);
      }

      // Increase contrast around mid-tones
      const normalized = value / 255;
      value = Math.pow(normalized, 0.8) * 255;

      enhancedData[i] = Math.round(value);
    }

    // Step 4: Apply bilateral filter to reduce noise while preserving edges
    const filteredData = bilateralFilter(enhancedData, width, height);

    // Step 5: Adaptive thresholding (Otsu's method)
    const threshold = calculateOtsuThreshold(filteredData);

    // Step 6: Morphological operations (erosion then dilation) to clean up
    const morphData = morphologicalOps(filteredData, width, height, threshold);

    // Step 7: Apply deglare filter for reflection removal
    const deglaredData = removeGlare(morphData, width, height);

    // Convert back to RGBA
    for (let i = 0; i < grayData.length; i++) {
      const value = deglaredData[i] > threshold ? 255 : 0;
      data[i * 4] = value;
      data[i * 4 + 1] = value;
      data[i * 4 + 2] = value;
    }
  };

  const bilateralFilter = (data, width, height) => {
    const filtered = new Uint8ClampedArray(data.length);
    const kernelSize = 5;
    const sigma = 50;
    const spatialSigma = 1.5;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let weightSum = 0;
        let valueSum = 0;
        const centerIdx = y * width + x;
        const centerValue = data[centerIdx];

        for (let ky = -kernelSize; ky <= kernelSize; ky++) {
          for (let kx = -kernelSize; kx <= kernelSize; kx++) {
            const ny = Math.min(Math.max(y + ky, 0), height - 1);
            const nx = Math.min(Math.max(x + kx, 0), width - 1);
            const idx = ny * width + nx;
            const value = data[idx];

            const spatialDistance = Math.sqrt(kx * kx + ky * ky);
            const intensityDistance = Math.abs(value - centerValue);

            const spatialWeight = Math.exp(-(spatialDistance * spatialDistance) / (2 * spatialSigma * spatialSigma));
            const intensityWeight = Math.exp(-(intensityDistance * intensityDistance) / (2 * sigma * sigma));
            const weight = spatialWeight * intensityWeight;

            weightSum += weight;
            valueSum += value * weight;
          }
        }

        filtered[centerIdx] = Math.round(valueSum / weightSum);
      }
    }

    return filtered;
  };

  const calculateOtsuThreshold = (data) => {
    const histogram = new Array(256).fill(0);
    const total = data.length;

    for (let i = 0; i < data.length; i++) {
      histogram[data[i]]++;
    }

    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += i * histogram[i];
    }

    let sumB = 0;
    let wB = 0;
    let maxVariance = 0;
    let threshold = 0;

    for (let i = 0; i < 256; i++) {
      wB += histogram[i];
      if (wB === 0) continue;

      const wF = total - wB;
      if (wF === 0) break;

      sumB += i * histogram[i];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;

      const variance = wB * wF * (mB - mF) * (mB - mF);
      if (variance > maxVariance) {
        maxVariance = variance;
        threshold = i;
      }
    }

    return threshold;
  };

  const morphologicalOps = (data, width, height, threshold) => {
    // Erosion followed by dilation
    const eroded = new Uint8ClampedArray(data.length);
    const dilated = new Uint8ClampedArray(data.length);

    const kernel = 3;

    // Erosion
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        let minVal = 255;

        for (let ky = -kernel; ky <= kernel; ky++) {
          for (let kx = -kernel; kx <= kernel; kx++) {
            const ny = Math.min(Math.max(y + ky, 0), height - 1);
            const nx = Math.min(Math.max(x + kx, 0), width - 1);
            const nidx = ny * width + nx;
            minVal = Math.min(minVal, data[nidx] > threshold ? 255 : 0);
          }
        }
        eroded[idx] = minVal;
      }
    }

    // Dilation
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        let maxVal = 0;

        for (let ky = -kernel; ky <= kernel; ky++) {
          for (let kx = -kernel; kx <= kernel; kx++) {
            const ny = Math.min(Math.max(y + ky, 0), height - 1);
            const nx = Math.min(Math.max(x + kx, 0), width - 1);
            const nidx = ny * width + nx;
            maxVal = Math.max(maxVal, eroded[nidx]);
          }
        }
        dilated[idx] = maxVal;
      }
    }

    return dilated;
  };

  const removeGlare = (data, width, height) => {
    const deglared = new Uint8ClampedArray(data);
    const glareThreshold = 240;
    const kernel = 7;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;

        if (data[idx] > glareThreshold) {
          let neighborSum = 0;
          let neighborCount = 0;

          for (let ky = -kernel; ky <= kernel; ky++) {
            for (let kx = -kernel; kx <= kernel; kx++) {
              if (kx === 0 && ky === 0) continue;

              const ny = Math.min(Math.max(y + ky, 0), height - 1);
              const nx = Math.min(Math.max(x + kx, 0), width - 1);
              const nidx = ny * width + nx;

              if (data[nidx] <= glareThreshold) {
                neighborSum += data[nidx];
                neighborCount++;
              }
            }
          }

          if (neighborCount > 0) {
            deglared[idx] = Math.round(neighborSum / neighborCount);
          }
        }
      }
    }

    return deglared;
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    const handleKeyPress = (e) => {
      if (e.key === 'Escape') handleClose();
    };

    document.addEventListener('keydown', handleKeyPress);

    const initializeScanner = async () => {
      try {
        setError('');

        // Check orientation
        if (!isLandscape) {
          setStatus('📱 Please rotate your phone to landscape mode');
          return;
        }

        setStatus('🔍 Initializing OCR engine...');

        const { createWorker } = Tesseract;
        const worker = await createWorker('eng', 1, {
          corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v4/tesseract-core.wasm.js'
        });
        ocrWorkerRef.current = worker;

        setStatus('📱 Requesting camera...');

        if (screen.orientation) {
          try {
            await screen.orientation.lock('landscape-primary').catch(() => {
              return screen.orientation.lock('landscape');
            });
          } catch (err) {
            console.warn('Orientation lock failed:', err);
          }
        }

        const scannerContainer = document.getElementById('scanner-fullscreen');
        if (scannerContainer?.requestFullscreen) {
          try {
            scannerContainer.requestFullscreen().catch(() => {});
          } catch (err) {
            console.warn('Fullscreen not supported:', err);
          }
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        });

        streamRef.current = stream;

        if (!videoRef.current) return;

        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('autoplay', 'true');
        videoRef.current.setAttribute('muted', 'true');

        setStatus('🔍 Initializing barcode scanner...');

        // Initialize Quagga for barcodes
        const quaggaReady = await initializeQuagga();

        if (quaggaReady) {
          setStatus('✨ Advanced scanner ready - All formats + AI enhancement');
        } else {
          setStatus('✨ Advanced scanner ready - QR & multi-region OCR');
        }

        setTimeout(() => {
          scanWithOCR();
        }, 1000);
      } catch (err) {
        console.error('Error:', err);
        if (err.name === 'NotAllowedError') {
          setError('❌ Camera permission denied');
        } else if (err.name === 'NotFoundError') {
          setError('❌ No camera found');
        } else {
          setError('❌ Error: ' + err.message);
        }
      }
    };

    initializeScanner();

    return () => {
      scanningRef.current = false;
      document.removeEventListener('keydown', handleKeyPress);
      document.body.style.overflow = 'auto';
      document.body.style.position = 'relative';
      document.body.style.width = 'auto';

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
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

      if (document.fullscreenElement) {
        try {
          const exitPromise = document.exitFullscreen();
          if (exitPromise?.catch) exitPromise.catch(() => {});
        } catch (err) {
          console.warn('Exit fullscreen error:', err);
        }
      }
    };
  }, []);

  const handleManualVINSubmit = () => {
    const cleaned = manualVIN.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (validateVIN(cleaned)) {
      handleVINDetected(cleaned, 'Manual Input');
    } else {
      setError('⚠️ VIN must be 17 characters (no I, O, Q)');
    }
  };

  // Show portrait warning if not in landscape mode
  if (!isLandscape) {
    return (
      <div
        id="scanner-fullscreen"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          margin: 0,
          padding: 0,
          border: 0,
          backgroundColor: '#000000',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}
      >
        {/* Portrait Mode Warning */}
        <div
          style={{
            textAlign: 'center',
            color: '#fff',
            zIndex: 10001
          }}
        >
          <div
            style={{
              fontSize: '72px',
              marginBottom: '24px',
              animation: 'pulse 2s ease-in-out infinite'
            }}
          >
            📱
          </div>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 'bold',
              marginBottom: '16px',
              textShadow: '0 2px 10px rgba(0, 0, 0, 0.9)'
            }}
          >
            Rotate Your Phone
          </h1>
          <p
            style={{
              fontSize: '18px',
              color: 'rgba(255, 255, 255, 0.8)',
              marginBottom: '32px',
              maxWidth: '80%',
              textShadow: '0 1px 5px rgba(0, 0, 0, 0.9)'
            }}
          >
            The VIN scanner only works in landscape mode. Please rotate your phone to landscape for the best scanning experience.
          </p>
          <button
            onClick={handleClose}
            style={{
              padding: '14px 28px',
              fontSize: '16px',
              fontWeight: 'bold',
              backgroundColor: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#2563EB';
              e.target.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#3B82F6';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            Close Scanner
          </button>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% {
              opacity: 0.6;
              transform: scale(1);
            }
            50% {
              opacity: 1;
              transform: scale(1.1);
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      id="scanner-fullscreen"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
        border: 0,
        backgroundColor: '#000000',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}
    >
      <video
        ref={videoRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 1
        }}
        autoPlay
        playsInline
        muted
      />

      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          display: 'none'
        }}
      />

      {/* Dark Vignette Overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(
              ellipse 80% 60% at 50% 50%,
              rgba(0, 0, 0, 0) 0%,
              rgba(0, 0, 0, 0.4) 40%,
              rgba(0, 0, 0, 0.8) 70%,
              rgba(0, 0, 0, 0.95) 100%
            )
          `,
          zIndex: 2,
          pointerEvents: 'none'
        }}
      />

      {/* Scanning Frame */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '88%',
          maxWidth: '600px',
          aspectRatio: '5/1.8',
          backgroundColor: 'rgba(240, 240, 240, 0.95)',
          border: '3px solid #333',
          borderRadius: '8px',
          boxShadow: '0 15px 50px rgba(0, 0, 0, 0.8), inset 0 1px 3px rgba(255, 255, 255, 0.5)',
          zIndex: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          padding: '20px'
        }}
      >
        <div
          style={{
            width: '90px',
            height: '90px',
            borderRadius: '50%',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            border: '3px solid #3B82F6',
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
            animation: 'pulse 2s ease-in-out infinite',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}
        >
          <div
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              backgroundColor: '#3B82F6',
              opacity: 0.6
            }}
          />
          {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((pos) => (
            <div
              key={pos}
              style={{
                position: 'absolute',
                ...(pos === 'top-left' && { top: '-15px', left: '-15px' }),
                ...(pos === 'top-right' && { top: '-15px', right: '-15px' }),
                ...(pos === 'bottom-left' && { bottom: '-15px', left: '-15px' }),
                ...(pos === 'bottom-right' && { bottom: '-15px', right: '-15px' }),
                width: '25px',
                height: '25px',
                border: '2px solid #666',
                ...(pos.includes('top') && { borderBottom: 'none' }),
                ...(pos.includes('bottom') && { borderTop: 'none' }),
                ...(pos.includes('left') && { borderRight: 'none' }),
                ...(pos.includes('right') && { borderLeft: 'none' })
              }}
            />
          ))}
        </div>
      </div>

      {/* Status Text */}
      <div
        style={{
          position: 'absolute',
          top: '30px',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          color: '#fff',
          fontSize: '16px',
          fontWeight: '600',
          textShadow: '0 2px 10px rgba(0, 0, 0, 0.9)',
          zIndex: 3,
          letterSpacing: '0.5px'
        }}
      >
        {status}
      </div>

      {/* Detected VIN Display */}
      {detectedVIN && (
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#fff',
            fontSize: '28px',
            fontWeight: '800',
            letterSpacing: '2px',
            whiteSpace: 'nowrap',
            textShadow: '0 3px 15px rgba(0, 0, 0, 0.95)',
            zIndex: 4,
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            padding: '12px 24px',
            borderRadius: '8px',
            border: '2px solid rgba(59, 130, 246, 0.5)',
            animation: 'glow 1.5s ease-in-out'
          }}
        >
          ✓ {detectedVIN}
        </div>
      )}

      {detectionMethod && (
        <div
          style={{
            position: 'absolute',
            top: '65px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#10B981',
            fontSize: '12px',
            fontWeight: '600',
            textShadow: '0 1px 5px rgba(0, 0, 0, 0.8)',
            zIndex: 4
          }}
        >
          Detected via: {detectionMethod}
        </div>
      )}

      {/* Manual VIN Input */}
      <div
        style={{
          position: 'absolute',
          bottom: '60px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(20, 20, 20, 0.92)',
          padding: '18px 24px',
          borderRadius: '10px',
          border: '2px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8)',
          zIndex: 3,
          width: '88%',
          maxWidth: '500px'
        }}
      >
        <label
          style={{
            display: 'block',
            color: '#fff',
            fontSize: '13px',
            fontWeight: '600',
            marginBottom: '10px',
            textAlign: 'center',
            letterSpacing: '0.5px'
          }}
        >
          📝 Can't detect? Type VIN manually
        </label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            placeholder="Enter 17-character VIN"
            value={manualVIN}
            onChange={(e) => {
              const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
              setManualVIN(val.slice(0, 17));
              setError('');
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && manualVIN.length === 17) {
                handleManualVINSubmit();
              }
            }}
            maxLength="17"
            style={{
              flex: 1,
              padding: '12px 14px',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              fontSize: '14px',
              fontFamily: 'monospace',
              fontWeight: '600',
              letterSpacing: '1px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              color: '#fff',
              transition: 'all 0.3s',
              outline: 'none'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
            }}
          />
          <button
            onClick={handleManualVINSubmit}
            disabled={manualVIN.length !== 17}
            style={{
              padding: '12px 18px',
              backgroundColor: manualVIN.length === 17 ? '#3B82F6' : 'rgba(59, 130, 246, 0.3)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '700',
              cursor: manualVIN.length === 17 ? 'pointer' : 'not-allowed',
              fontSize: '13px',
              whiteSpace: 'nowrap',
              transition: 'all 0.3s',
              boxShadow: manualVIN.length === 17 ? '0 4px 15px rgba(59, 130, 246, 0.4)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (manualVIN.length === 17) {
                e.target.style.backgroundColor = '#2563EB';
                e.target.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              if (manualVIN.length === 17) {
                e.target.style.backgroundColor = '#3B82F6';
                e.target.style.transform = 'translateY(0)';
              }
            }}
          >
            Submit
          </button>
        </div>
        <p
          style={{
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.6)',
            marginTop: '8px',
            marginBottom: 0,
            textAlign: 'center'
          }}
        >
          {manualVIN.length}/17 characters
        </p>
      </div>

      {/* Close Button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleClose();
        }}
        style={{
          position: 'absolute',
          top: '25px',
          right: '25px',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          backgroundColor: 'rgba(30, 30, 30, 0.8)',
          border: '2px solid rgba(255, 255, 255, 0.4)',
          color: 'white',
          fontSize: '26px',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          zIndex: 4,
          padding: 0,
          lineHeight: '1',
          outline: 'none',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.6)'
        }}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = 'rgba(30, 30, 30, 0.95)';
          e.target.style.borderColor = 'rgba(255, 255, 255, 0.8)';
          e.target.style.boxShadow = '0 6px 20px rgba(255, 255, 255, 0.2)';
          e.target.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = 'rgba(30, 30, 30, 0.8)';
          e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
          e.target.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.6)';
          e.target.style.transform = 'scale(1)';
        }}
      >
        ✕
      </button>

      {/* Error Message */}
      {error && (
        <div
          style={{
            position: 'absolute',
            top: '40px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(239, 68, 68, 0.95)',
            color: 'white',
            padding: '16px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            textAlign: 'center',
            zIndex: 4,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.8)',
            maxWidth: '80%'
          }}
        >
          {error}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.15);
          }
        }

        @keyframes glow {
          0% {
            opacity: 0;
            transform: translateX(-50%) scale(0.9);
          }
          50% {
            box-shadow: 0 0 30px rgba(59, 130, 246, 0.8);
          }
          100% {
            opacity: 1;
            transform: translateX(-50%) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
