import { useEffect, useRef, useState } from 'react';
import Tesseract from 'tesseract.js';
import Quagga from '@ericblade/quagga2';

export default function OptimizedVINScanner({ onVINDetected, onClose }) {
  const [orientation, setOrientation] = useState('portrait');
  const [detectedVIN, setDetectedVIN] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [status, setStatus] = useState('Tap to request camera access');
  const [cameraReady, setCameraReady] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanningRef = useRef(true);
  const onCloseRef = useRef(onClose);
  const ocrWorkerRef = useRef(null);
  const lastDetectionRef = useRef(0);
  const detectionCacheRef = useRef(new Map());
  const scannerContainerRef = useRef(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Detect device orientation
  useEffect(() => {
    const handleOrientationChange = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      setOrientation(isLandscape ? 'landscape' : 'portrait');
    };

    // Set initial orientation
    handleOrientationChange();

    // Listen for orientation changes
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
    screen.orientation?.addEventListener('change', handleOrientationChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
      screen.orientation?.removeEventListener('change', handleOrientationChange);
    };
  }, []);

  const validateVIN = (vin) => {
    if (!vin || typeof vin !== 'string') return false;

    const cleaned = vin.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (cleaned.length !== 17) return false;
    if (/[IOQ]/.test(cleaned)) return false;

    const yearCode = cleaned[9];
    const validYears = 'ABCDEFGHJKLMNPRSTVWXY';
    if (!validYears.includes(yearCode)) return false;

    return verifyCheckDigit(cleaned);
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
          readers: ['code_128_reader', 'code_39_reader']
        },
        numOfWorkers: 2,
        frequency: 15
      }, (err) => {
        if (err) {
          console.warn('Barcode init failed:', err);
          resolve(false);
          return;
        }

        Quagga.onDetected((result) => {
          if (!scanningRef.current || !result.codeResult) return;

          const code = result.codeResult.code?.trim();
          if (code && validateVIN(code)) {
            handleVINDetection(code, 'Barcode');
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

    if (detectionCacheRef.current.has(cacheKey)) {
      const lastDetection = detectionCacheRef.current.get(cacheKey);
      if (now - lastDetection < 500) return;
    }

    detectionCacheRef.current.set(cacheKey, now);
    lastDetectionRef.current = now;

    console.log(`✅ VIN Detected: ${vin} via ${source}`);
    setDetectedVIN(vin);
    setShowConfirmation(true);
    scanningRef.current = false;
  };

  const optimizeForVINText = (imageData) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      gray[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    const threshold = calculateThreshold(gray);

    for (let i = 0; i < gray.length; i++) {
      const binaryValue = gray[i] > threshold ? 255 : 0;
      data[i * 4] = binaryValue;
      data[i * 4 + 1] = binaryValue;
      data[i * 4 + 2] = binaryValue;
    }
  };

  const calculateThreshold = (data) => {
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i++) {
      histogram[data[i]]++;
    }

    const total = data.length;
    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += i * histogram[i];
    }

    let sumB = 0, wB = 0, maxVariance = 0, threshold = 0;

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

      setStatus('Ready - Point camera at VIN');

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
            {/* Scanning Guide - Responsive */}
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
              zIndex: 2
            }}>
              {status}
            </div>

            {/* Centering Guide Line - Responsive */}
            {orientation === 'landscape' ? (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '50%',
                height: '3px',
                backgroundColor: '#FFD700',
                zIndex: 2,
                boxShadow: '0 0 15px rgba(255, 215, 0, 0.8)'
              }} />
            ) : (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '3px',
                height: '40%',
                backgroundColor: '#FFD700',
                zIndex: 2,
                boxShadow: '0 0 15px rgba(255, 215, 0, 0.8)'
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
