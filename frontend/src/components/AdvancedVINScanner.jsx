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
    return /^[A-HJ-NPR-Z0-9]{17}$/.test(cleaned);
  };

  const handleVINDetected = (vin, method) => {
    const cleaned = vin.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (validateVIN(cleaned) && !detectedVINsRef.current.has(cleaned)) {
      detectedVINsRef.current.add(cleaned);
      setDetectedVIN(cleaned);
      setDetectionMethod(method);
      setStatus(`✅ VIN detected via ${method}!`);
      scanningRef.current = false;

      setTimeout(() => {
        handleClose();
        setTimeout(() => {
          onScan(cleaned);
        }, 100);
      }, 800);
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

  // OCR text detection
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

      // Crop to VIN text area for OCR
      const cropTop = Math.floor(canvas.height * 0.35);
      const cropHeight = Math.floor(canvas.height * 0.15);
      const cropLeft = Math.floor(canvas.width * 0.08);
      const cropWidth = Math.floor(canvas.width * 0.85);

      const croppedImageData = ctx.getImageData(cropLeft, cropTop, cropWidth, cropHeight);
      enhanceImageForText(croppedImageData);

      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = cropWidth;
      croppedCanvas.height = cropHeight;
      const croppedCtx = croppedCanvas.getContext('2d');
      croppedCtx.putImageData(croppedImageData, 0, 0);

      const result = await ocrWorkerRef.current.recognize(croppedCanvas);

      if (result.data.text) {
        const vinMatch = result.data.text.match(/[A-HJ-NPR-Z0-9]{17}/);
        if (vinMatch) {
          handleVINDetected(vinMatch[0], 'OCR Text');
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

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      const low = 50;
      const high = 200;
      const threshold = (gray < (low + high) / 2) ? 0 : 255;

      data[i] = threshold;
      data[i + 1] = threshold;
      data[i + 2] = threshold;
    }
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
          setStatus('✨ Multi-format scanner ready - Barcode, QR, OCR');
        } else {
          setStatus('✨ Scanner ready - QR & OCR mode');
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
