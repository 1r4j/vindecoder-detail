import { useEffect, useRef, useState } from 'react';
import Tesseract from 'tesseract.js';
import jsQR from 'jsqr';
import Quagga from '@ericblade/quagga2';

export default function AdvancedVINScanner({ onScan, onClose }) {
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  const [status, setStatus] = useState('Initializing scanner...');

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
    if (!vin || typeof vin !== 'string') return false;

    const cleaned = vin.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (cleaned.length !== 17) return false;
    if (/[IOQ]/.test(cleaned)) return false;

    const yearCode = cleaned[9];
    const validYears = 'ABCDEFGHJKLMNPRSTVWXY';
    if (!validYears.includes(yearCode)) return false;

    if (!validateCheckDigit(cleaned)) return false;

    if (!/^[A-Z0-9]{3}/.test(cleaned)) return false;

    const descriptor = cleaned.substring(3, 8);
    if (!/^[A-Z0-9]{5}$/.test(descriptor)) return false;

    return true;
  };

  const validateCheckDigit = (vin) => {
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

      const char = vin[i];
      const value = translationTable[char];

      if (value === undefined) return false;

      sum += value * weights[i];
    }

    const checkDigit = sum % 11;
    const expectedCheckDigit = checkDigit === 10 ? 'X' : checkDigit.toString();
    const actualCheckDigit = vin[8];

    return actualCheckDigit === expectedCheckDigit;
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
      setStatus(`✅ VIN Detected: ${cleaned}`);
      scanningRef.current = false;

      setTimeout(() => {
        handleClose();
        setTimeout(() => {
          onScan(cleaned);
        }, 100);
      }, 800);
    } else {
      console.log(`❌ Invalid VIN rejected: '${cleaned}' via ${method}`);
    }
  };

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
          readers: ['code_128_reader', 'code_39_reader']
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
              handleVINDetected(code, 'Barcode');
            }
          }
        });

        Quagga.start();
        resolve(true);
      });
    });
  };

  const scanQRCode = (imageData) => {
    try {
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data && validateVIN(code.data)) {
        handleVINDetected(code.data, 'QR Code');
      }
    } catch (err) {
      // Silent fail
    }
  };

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

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      scanQRCode(imageData);

      const scanRegions = [
        { top: 0.35, height: 0.15, left: 0.08, width: 0.85, name: 'Center' },
        { top: 0.15, height: 0.15, left: 0.1, width: 0.8, name: 'Upper' },
        { top: 0.55, height: 0.15, left: 0.05, width: 0.9, name: 'Lower' },
        { top: 0.3, height: 0.2, left: 0.0, width: 0.35, name: 'Left' },
        { top: 0.3, height: 0.2, left: 0.65, width: 0.35, name: 'Right' }
      ];

      for (const region of scanRegions) {
        const cropTop = Math.floor(canvas.height * region.top);
        const cropHeight = Math.floor(canvas.height * region.height);
        const cropLeft = Math.floor(canvas.width * region.left);
        const cropWidth = Math.floor(canvas.width * region.width);

        try {
          const croppedImageData = ctx.getImageData(cropLeft, cropTop, cropWidth, cropHeight);
          enhanceImageForText(croppedImageData);

          const croppedCanvas = document.createElement('canvas');
          croppedCanvas.width = cropWidth;
          croppedCanvas.height = cropHeight;
          const croppedCtx = croppedCanvas.getContext('2d');
          croppedCtx.putImageData(croppedImageData, 0, 0);

          const result = await ocrWorkerRef.current.recognize(croppedCanvas);

          if (result.data.text && result.data.confidence > 0.5) {
            const text = result.data.text.replace(/\s+/g, '').toUpperCase();
            const potentialVINs = text.match(/[A-Z0-9]{17}/g) || [];

            for (const potentialVIN of potentialVINs) {
              if (validateVIN(potentialVIN)) {
                handleVINDetected(potentialVIN, `OCR (${region.name})`);
                return;
              }
            }
          }
        } catch (err) {
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

    const grayData = new Uint8ClampedArray(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      grayData[i / 4] = gray;
    }

    let mean = 0;
    for (let i = 0; i < grayData.length; i++) {
      mean += grayData[i];
    }
    mean /= grayData.length;

    const enhancedData = new Uint8ClampedArray(width * height);

    for (let i = 0; i < grayData.length; i++) {
      let value = grayData[i];

      if (mean < 100) {
        value = Math.min(255, value * 1.4);
      }

      if (mean > 180) {
        value = Math.min(255, value * 0.95);
      }

      const normalized = value / 255;
      value = Math.pow(normalized, 0.8) * 255;

      enhancedData[i] = Math.round(value);
    }

    const filteredData = bilateralFilter(enhancedData, width, height);
    const threshold = calculateOtsuThreshold(filteredData);
    const morphData = morphologicalOps(filteredData, width, height, threshold);
    const deglaredData = removeGlare(morphData, width, height);

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
    const eroded = new Uint8ClampedArray(data.length);
    const dilated = new Uint8ClampedArray(data.length);

    const kernel = 3;

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

    const initializeScanner = async () => {
      try {
        setStatus('Requesting camera...');

        if (screen.orientation) {
          try {
            await screen.orientation.lock('landscape-primary').catch(() => {
              return screen.orientation.lock('landscape');
            });
          } catch (err) {
            console.warn('Orientation lock failed:', err);
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

        setStatus('Initializing scanner...');

        const { createWorker } = Tesseract;
        const worker = await createWorker('eng', 1, {
          corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v4/tesseract-core.wasm.js'
        });
        ocrWorkerRef.current = worker;

        await initializeQuagga();
        setStatus('Ready to scan');

        setTimeout(() => {
          scanWithOCR();
        }, 1000);
      } catch (err) {
        console.error('Error:', err);
        if (err.name === 'NotAllowedError') {
          setStatus('Camera permission denied');
        } else if (err.name === 'NotFoundError') {
          setStatus('No camera found');
        } else {
          setStatus('Error: ' + err.message);
        }
      }
    };

    initializeScanner();

    return () => {
      scanningRef.current = false;
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
    };
  }, []);

  // Show portrait warning if not in landscape mode
  if (!isLandscape) {
    return (
      <div
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
          backgroundColor: '#000',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          textAlign: 'center'
        }}
      >
        <div style={{ fontSize: '72px', marginBottom: '20px' }}>📱</div>
        <h1 style={{ fontSize: '28px', marginBottom: '16px' }}>Rotate Your Phone</h1>
        <p style={{ fontSize: '18px', marginBottom: '32px', maxWidth: '80%', opacity: 0.8 }}>
          Please rotate your phone to landscape mode for scanning
        </p>
        <button
          onClick={handleClose}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: '#3B82F6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div
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
        backgroundColor: '#000',
        zIndex: 10000,
        overflow: 'hidden'
      }}
    >
      {/* Video Feed */}
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

      {/* Hidden Canvas for OCR */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          display: 'none'
        }}
      />

      {/* Yellow Centering Line */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '60%',
          height: '2px',
          backgroundColor: '#FFD700',
          zIndex: 2,
          boxShadow: '0 0 10px rgba(255, 215, 0, 0.6)'
        }}
      />

      {/* Close Button */}
      <button
        onClick={handleClose}
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: 'rgba(30, 30, 30, 0.9)',
          border: '2px solid rgba(255, 255, 255, 0.6)',
          color: '#fff',
          fontSize: '24px',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
          zIndex: 3,
          outline: 'none'
        }}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = 'rgba(30, 30, 30, 0.95)';
          e.target.style.borderColor = 'rgba(255, 255, 255, 0.9)';
          e.target.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = 'rgba(30, 30, 30, 0.9)';
          e.target.style.borderColor = 'rgba(255, 255, 255, 0.6)';
          e.target.style.transform = 'scale(1)';
        }}
      >
        ✕
      </button>

      {/* Status Text at Bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#fff',
          fontSize: '14px',
          fontWeight: '600',
          textAlign: 'center',
          zIndex: 2,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          padding: '8px 16px',
          borderRadius: '6px',
          maxWidth: '80%'
        }}
      >
        {status}
      </div>
    </div>
  );
}
