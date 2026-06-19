import { useEffect, useRef, useState } from 'react';
import Tesseract from 'tesseract.js';

export default function QRScanner({ onScan, onClose }) {
  const [error, setError] = useState('');
  const [detectedVIN, setDetectedVIN] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('📱 Initializing OCR...');
  const [manualVIN, setManualVIN] = useState('');
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

  const handleClose = () => {
    console.log('Closing scanner...');
    scanningRef.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }

    if (ocrWorkerRef.current) {
      ocrWorkerRef.current.terminate().catch(() => {});
    }

    if (screen.orientation) {
      try {
        const unlockPromise = screen.orientation.unlock();
        if (unlockPromise && typeof unlockPromise.catch === 'function') {
          unlockPromise.catch(() => {});
        }
      } catch (err) {
        console.warn('Unlock error:', err);
      }
    }

    if (document.fullscreenElement) {
      try {
        const exitPromise = document.exitFullscreen();
        if (exitPromise && typeof exitPromise.catch === 'function') {
          exitPromise.catch(() => {});
        }
      } catch (err) {
        console.warn('Exit fullscreen error:', err);
      }
    }

    document.body.style.overflow = 'auto';
    document.body.style.position = 'relative';
    document.body.style.width = 'auto';
    document.documentElement.style.overflow = 'auto';

    setTimeout(() => {
      onCloseRef.current();
    }, 100);
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.documentElement.style.overflow = 'hidden';

    const handleKeyPress = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyPress);

    const initializeScanner = async () => {
      try {
        setError('');
        setStatus('🔍 Initializing OCR engine...');

        // Initialize Tesseract
        const { createWorker } = Tesseract;
        const worker = await createWorker('eng', 1, {
          corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v4/tesseract-core.wasm.js'
        });
        ocrWorkerRef.current = worker;

        setStatus('📱 Requesting camera...');

        // Lock orientation
        if (screen.orientation) {
          try {
            await screen.orientation.lock('landscape-primary').catch(() => {
              return screen.orientation.lock('landscape');
            });
          } catch (err) {
            console.warn('Orientation lock failed:', err);
          }
        }

        // Request fullscreen
        const scannerContainer = document.getElementById('scanner-fullscreen');
        if (scannerContainer && scannerContainer.requestFullscreen) {
          try {
            scannerContainer.requestFullscreen().catch((err) => {
              console.warn('Fullscreen request failed:', err.message);
            });
          } catch (err) {
            console.warn('Fullscreen not supported:', err);
          }
        }

        // Request camera
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

        setStatus('🎯 Point at VIN text');

        // Start OCR scanning after video is ready
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
      document.documentElement.style.overflow = 'auto';

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      if (ocrWorkerRef.current) {
        ocrWorkerRef.current.terminate().catch(() => {});
      }

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
          if (exitPromise && typeof exitPromise.catch === 'function') {
            exitPromise.catch(() => {});
          }
        } catch (err) {
          console.warn('Exit fullscreen error:', err);
        }
      }
    };
  }, []);

  const scanWithOCR = async () => {
    if (!scanningRef.current || !videoRef.current || !canvasRef.current) return;

    const now = Date.now();
    // Scan every 2 seconds
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

      // Crop to VIN area (middle section where VIN text appears)
      const cropTop = Math.floor(canvas.height * 0.3);
      const cropHeight = Math.floor(canvas.height * 0.4);
      const cropLeft = Math.floor(canvas.width * 0.05);
      const cropWidth = Math.floor(canvas.width * 0.9);

      const croppedImageData = ctx.getImageData(cropLeft, cropTop, cropWidth, cropHeight);

      // Apply preprocessing
      enhanceImage(croppedImageData);

      // Create cropped canvas
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = cropWidth;
      croppedCanvas.height = cropHeight;
      const croppedCtx = croppedCanvas.getContext('2d');
      croppedCtx.putImageData(croppedImageData, 0, 0);

      // Run OCR
      croppedCanvas.toBlob(async (blob) => {
        if (!blob || !scanningRef.current || !ocrWorkerRef.current) return;

        try {
          setStatus('🔍 Reading text...');
          const result = await ocrWorkerRef.current.recognize(blob, 'eng');
          const text = result.data.text;

          console.log('📝 OCR Result:', text);

          if (text) {
            const vin = extractVIN(text);
            console.log('Extracted VIN:', vin);

            if (vin && !detectedVINsRef.current.has(vin)) {
              detectedVINsRef.current.add(vin);
              console.log('✅ Valid VIN found:', vin);
              handleVINDetected(vin);
              return;
            }
          }

          setStatus('🎯 Point at VIN text');
        } catch (err) {
          console.error('OCR error:', err);
          setStatus('🎯 Point at VIN text');
        }
      }, 'image/png', 1.0);

      setTimeout(scanWithOCR, 500);
    } catch (err) {
      console.error('Scan error:', err);
      setTimeout(scanWithOCR, 500);
    }
  };

  const enhanceImage = (imageData) => {
    const data = imageData.data;
    const len = data.length;

    // Grayscale + contrast enhancement
    for (let i = 0; i < len; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Convert to grayscale
      const gray = r * 0.299 + g * 0.587 + b * 0.114;

      // Increase contrast
      const contrast = 2.5;
      const enhanced = (gray - 128) * contrast + 128;
      const clamped = Math.max(0, Math.min(255, enhanced));

      data[i] = clamped;
      data[i + 1] = clamped;
      data[i + 2] = clamped;
    }
  };

  const extractVIN = (text) => {
    if (!text) return null;

    // Split by lines and check each line
    const lines = text.split('\n');
    console.log('Text lines:', lines);

    for (const line of lines) {
      // Clean line - remove spaces and special chars
      const cleaned = line.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

      // Look for exactly 17 character VIN
      if (cleaned.length >= 17) {
        for (let i = 0; i <= cleaned.length - 17; i++) {
          const candidate = cleaned.substring(i, i + 17);

          // Validate VIN structure
          if (isValidVIN(candidate)) {
            console.log('✅ Valid VIN detected:', candidate);
            return candidate;
          }
        }
      }
    }

    return null;
  };

  const isValidVIN = (vin) => {
    if (!vin || vin.length !== 17) return false;

    // Check all characters are valid VIN characters (no I, O, Q)
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
      console.log('❌ Invalid VIN chars:', vin);
      return false;
    }

    // Position 0: Build location (WMI - World Manufacturer Identifier) - 1 char (valid)
    const buildLocation = vin[0];
    console.log('Build location:', buildLocation, '✓');

    // Position 1-2: Manufacturer - 2 chars (valid)
    const manufacturer = vin.substring(1, 3);
    console.log('Manufacturer:', manufacturer, '✓');

    // Position 3-7: Brand, engine size, type - 5 chars (valid)
    const brandEngine = vin.substring(3, 8);
    console.log('Brand/Engine:', brandEngine, '✓');

    // Position 8: Check digit - must be alphanumeric but typically numeric or X
    const checkDigit = vin[8];
    if (!/[0-9X]/.test(checkDigit)) {
      console.log('⚠️ Check digit suspicious:', checkDigit, '(expected 0-9 or X)');
      // Don't reject, as some VINs may have letters
    }
    console.log('Check digit:', checkDigit, '✓');

    // Position 9: Vehicle year - must be valid year code
    const yearCode = vin[9];
    const validYears = 'ABCDEFGHJKLMNPRSTVWXY'; // Valid year codes (no I, O, U, Z)
    if (!validYears.includes(yearCode)) {
      console.log('❌ Invalid year code:', yearCode, '(expected A-Y except I,O,U,Z)');
      return false;
    }
    console.log('Vehicle year:', yearCode, '✓');

    // Position 10: Assembly plant - 1 char (valid)
    const assemblyPlant = vin[10];
    console.log('Assembly plant:', assemblyPlant, '✓');

    // Position 11-16: Vehicle serial number - 6 chars (valid)
    const serialNumber = vin.substring(11, 17);
    console.log('Serial number:', serialNumber, '✓');

    console.log('✅ VIN structure validated:', vin);
    return true;
  };

  const handleVINDetected = (vin) => {
    setDetectedVIN(vin);
    setIsProcessing(true);
    setStatus('✅ VIN detected!');
    scanningRef.current = false;

    setTimeout(() => {
      handleClose();
      setTimeout(() => {
        onScan(vin);
      }, 100);
    }, 800);
  };

  const handleManualVINSubmit = () => {
    const cleaned = manualVIN.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (cleaned.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/.test(cleaned)) {
      console.log('✅ Manual VIN submitted:', cleaned);
      handleVINDetected(cleaned);
    } else {
      setError('⚠️ VIN must be 17 characters (no I, O, Q)');
    }
  };

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
      {/* Video Stream */}
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

      {/* Hidden Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          display: 'none'
        }}
      />

      {/* Overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          zIndex: 2
        }}
      />

      {/* Scanning Frame */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '85%',
          aspectRatio: '4/1',
          border: '4px solid #FFD700',
          borderRadius: '12px',
          boxShadow: 'inset 0 0 30px rgba(255, 215, 0, 0.2), 0 0 30px rgba(255, 215, 0, 0.5)',
          zIndex: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none'
        }}
      >
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: isProcessing ? 'rgba(255, 107, 107, 0.9)' : 'rgba(255, 165, 0, 0.7)',
            boxShadow: `0 0 40px ${isProcessing ? '#FF6B6B' : '#FFB800'}`,
            animation: isProcessing ? 'pulse 0.8s ease-in-out' : 'pulse 2s ease-in-out infinite',
            border: '3px solid rgba(255, 215, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: isProcessing ? '#FF6B6B' : '#FFB800'
            }}
          />
        </div>
      </div>

      {/* VIN Display */}
      {detectedVIN && (
        <div
          style={{
            position: 'absolute',
            top: '15%',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#FFD700',
            fontSize: '24px',
            fontWeight: '700',
            letterSpacing: '3px',
            whiteSpace: 'nowrap',
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.9)',
            zIndex: 4
          }}
        >
          {detectedVIN}
        </div>
      )}

      {/* Status Text */}
      <div
        style={{
          position: 'absolute',
          bottom: '200px',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          color: 'white',
          fontSize: '16px',
          fontWeight: '500',
          textShadow: '0 2px 8px rgba(0, 0, 0, 0.8)',
          zIndex: 3
        }}
      >
        {status}
      </div>

      {/* Manual VIN Input */}
      <div
        style={{
          position: 'absolute',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          padding: '16px 20px',
          borderRadius: '12px',
          border: '2px solid #FFD700',
          zIndex: 3,
          width: '80%',
          maxWidth: '450px'
        }}
      >
        <label
          style={{
            display: 'block',
            color: '#FFD700',
            fontSize: '12px',
            fontWeight: '700',
            marginBottom: '8px',
            textAlign: 'center'
          }}
        >
          📝 Type VIN (No OCR match?)
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Enter VIN"
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
              padding: '10px 12px',
              border: '2px solid #FFD700',
              borderRadius: '6px',
              fontSize: '14px',
              fontFamily: 'monospace',
              fontWeight: '600',
              letterSpacing: '1px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: 'white'
            }}
          />
          <button
            onClick={handleManualVINSubmit}
            disabled={manualVIN.length !== 17}
            style={{
              padding: '10px 14px',
              backgroundColor: manualVIN.length === 17 ? '#FFD700' : 'rgba(255, 215, 0, 0.3)',
              color: manualVIN.length === 17 ? '#000' : '#666',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '700',
              cursor: manualVIN.length === 17 ? 'pointer' : 'not-allowed',
              fontSize: '12px',
              whiteSpace: 'nowrap'
            }}
          >
            Go
          </button>
        </div>
        <p
          style={{
            fontSize: '11px',
            color: '#FFD700',
            marginTop: '6px',
            marginBottom: 0,
            textAlign: 'center'
          }}
        >
          {manualVIN.length}/17
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
          top: '30px',
          right: '30px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          border: '2px solid rgba(255, 255, 255, 0.6)',
          color: 'white',
          fontSize: '28px',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          zIndex: 4,
          padding: 0,
          lineHeight: '1',
          outline: 'none'
        }}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
          e.target.style.borderColor = 'rgba(255, 255, 255, 0.9)';
          e.target.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
          e.target.style.borderColor = 'rgba(255, 255, 255, 0.6)';
          e.target.style.boxShadow = 'none';
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
      `}</style>
    </div>
  );
}
