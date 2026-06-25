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
          readers: ['code_128_reader', 'code_39_reader']
        },
        numOfWorkers: 2,
        frequency: 15,
        locator: {
          halfSample: true
        }
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

          const result = await ocrWorkerRef.current.recognize(regionCanvas);

          if (result.data.text && result.data.confidence > 0.45) {
            const text = result.data.text.replace(/[^A-Z0-9]/g, '').toUpperCase();
            const vins = text.match(/[A-Z0-9]{17}/g) || [];

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

  const optimizeForVINText = (imageData) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Convert to grayscale
    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      gray[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    // Adaptive thresholding (local contrast enhancement)
    const blockSize = 15;
    const halfBlock = Math.floor(blockSize / 2);
    const threshold = new Uint8ClampedArray(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;

        // Calculate local mean
        let sum = 0;
        let count = 0;

        for (let dy = -halfBlock; dy <= halfBlock; dy++) {
          for (let dx = -halfBlock; dx <= halfBlock; dx++) {
            const ny = Math.min(Math.max(y + dy, 0), height - 1);
            const nx = Math.min(Math.max(x + dx, 0), width - 1);
            sum += gray[ny * width + nx];
            count++;
          }
        }

        const localMean = sum / count;
        const localThreshold = localMean * 0.95; // Slightly lower threshold for dark text

        // Apply adaptive threshold
        threshold[idx] = gray[idx] < localThreshold ? 0 : 255;
      }
    }

    // Apply contrast stretching
    let minVal = 255, maxVal = 0;
    for (let i = 0; i < threshold.length; i++) {
      if (threshold[i] < minVal) minVal = threshold[i];
      if (threshold[i] > maxVal) maxVal = threshold[i];
    }

    // Write back to image data
    for (let i = 0; i < data.length; i += 4) {
      const idx = i / 4;
      const val = Math.round(((threshold[idx] - minVal) / (maxVal - minVal + 1)) * 255);
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

      setStatus('Ready - Scanning for Code 128 barcode...');

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

            {/* Centering Guide Line - Responsive to Phone Orientation */}
            {orientation === 'landscape' ? (
              // Landscape: Horizontal line (phone held wide)
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '70%',
                height: '3px',
                backgroundColor: '#FFD700',
                zIndex: 2,
                boxShadow: '0 0 15px rgba(255, 215, 0, 0.8)',
                transition: 'all 0.3s ease-in-out'
              }} />
            ) : (
              // Portrait: Vertical line (phone held tall)
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '3px',
                height: '60%',
                backgroundColor: '#FFD700',
                zIndex: 2,
                boxShadow: '0 0 15px rgba(255, 215, 0, 0.8)',
                transition: 'all 0.3s ease-in-out'
              }} />
            )}

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
