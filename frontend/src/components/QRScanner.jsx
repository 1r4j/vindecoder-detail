import { useEffect, useRef, useState } from 'react';
import Tesseract from 'tesseract.js';
import Quagga from '@ericblade/quagga2';

export default function QRScanner({ onScan, onClose }) {
  const [error, setError] = useState('');
  const [detectedVIN, setDetectedVIN] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('📱 Initializing camera...');
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
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

    try {
      Quagga.stop();
      Quagga.offDetected();
    } catch (err) {
      console.warn('Quagga stop error:', err);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }

    if (ocrWorkerRef.current) {
      ocrWorkerRef.current.terminate();
    }

    if (screen.orientation) {
      try {
        const unlockPromise = screen.orientation.unlock();
        if (unlockPromise && typeof unlockPromise.catch === 'function') {
          unlockPromise.catch(() => {});
        }
      } catch (err) {
        console.warn('Unlock orientation error:', err);
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
        setStatus('🔍 Initializing OCR + Barcode scanner...');

        // Initialize OCR worker
        const { createWorker } = Tesseract;
        const worker = await createWorker();
        ocrWorkerRef.current = worker;

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

        // Initialize Quagga for barcode detection
        setStatus('📱 Initializing barcode detection...');

        await Quagga.init(
          {
            inputStream: {
              type: 'LiveStream',
              constraints: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                facingMode: 'environment'
              },
              target: document.querySelector('#scanner-video')
            },
            decoder: {
              readers: [
                'code_128_reader',
                'code_39_reader',
                'code_39_vin_reader',
                'ean_reader',
                'ean_8_reader',
                'upc_reader'
              ],
              debug: { showCanvas: false, showPatternOverlay: false }
            },
            locator: {
              halfSample: false,
              patchSize: 'large'
            },
            numOfWorkers: 1,
            frequency: 15
          },
          (err) => {
            if (err) {
              console.error('Quagga init error:', err);
              return;
            }
            Quagga.start();
            setStatus('🎯 Align VIN text/barcode with frame');
          }
        );

        // Handle barcode detection
        Quagga.onDetected((result) => {
          if (!scanningRef.current || !result.codeResult) return;

          const code = result.codeResult.code;
          console.log('📸 Barcode detected:', code);

          const vin = extractVIN(code);
          if (vin && !detectedVINsRef.current.has(vin)) {
            detectedVINsRef.current.add(vin);
            console.log('✅ VIN from barcode:', vin);
            handleVINDetected(vin);
          }
        });

        // Start OCR scanning
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

      try {
        Quagga.stop();
        Quagga.offDetected();
      } catch (err) {
        console.warn('Quagga cleanup error:', err);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      if (ocrWorkerRef.current) {
        ocrWorkerRef.current.terminate();
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
    // OCR every 1.5 seconds
    if (now - lastScanRef.current < 1500) {
      setTimeout(scanWithOCR, 300);
      return;
    }

    lastScanRef.current = now;

    try {
      const canvas = canvasRef.current;
      const video = document.querySelector('#scanner-video video');

      if (!video || video.readyState !== 2) {
        setTimeout(scanWithOCR, 300);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Crop to VIN area (VINs typically appear in the middle section of sticker)
      const cropTop = Math.floor(canvas.height * 0.35);
      const cropHeight = Math.floor(canvas.height * 0.3);
      const cropLeft = Math.floor(canvas.width * 0.1);
      const cropWidth = Math.floor(canvas.width * 0.8);

      const croppedImageData = ctx.getImageData(cropLeft, cropTop, cropWidth, cropHeight);

      // Apply preprocessing to cropped area
      preprocessImage(croppedImageData);

      // Put back the preprocessed data
      ctx.putImageData(croppedImageData, cropLeft, cropTop);

      // Create a new canvas with only the cropped VIN area
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = cropWidth;
      croppedCanvas.height = cropHeight;
      const croppedCtx = croppedCanvas.getContext('2d');
      croppedCtx.drawImage(canvas, cropLeft, cropTop, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

      // Convert to blob and run OCR on cropped image
      croppedCanvas.toBlob(async (blob) => {
        if (!blob || !scanningRef.current || !ocrWorkerRef.current) return;

        try {
          setStatus('🔍 Scanning VIN...');
          const result = await ocrWorkerRef.current.recognize(blob, 'eng', {
            tessedit_char_whitelist: 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'
          });

          const text = result.data.text;
          console.log('📝 OCR text from VIN area:', JSON.stringify(text));

          if (text) {
            const vin = extractVINFromText(text);

            if (vin && !detectedVINsRef.current.has(vin)) {
              detectedVINsRef.current.add(vin);
              console.log('✅ Valid VIN detected:', vin);
              handleVINDetected(vin);
              return;
            }
          }

          setStatus('🎯 Align VIN with frame');
        } catch (err) {
          console.error('OCR error:', err);
          setStatus('🎯 Align VIN with frame');
        }
      }, 'image/png');

      setTimeout(scanWithOCR, 300);
    } catch (err) {
      console.error('Scan error:', err);
      setTimeout(scanWithOCR, 300);
    }
  };

  const preprocessImage = (imageData) => {
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Convert to grayscale
      const gray = r * 0.299 + g * 0.587 + b * 0.114;

      // Apply contrast enhancement
      const contrast = 1.5;
      const adjusted = (gray - 128) * contrast + 128;

      // Clamp values
      const value = Math.max(0, Math.min(255, adjusted));

      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }
  };

  const handleVINDetected = (vin) => {
    setDetectedVIN(vin);
    setIsProcessing(true);
    setStatus('✅ VIN detected!');
    scanningRef.current = false;

    try {
      Quagga.stop();
    } catch (err) {
      console.warn('Quagga stop error:', err);
    }

    setTimeout(() => {
      handleClose();
      setTimeout(() => {
        onScan(vin);
      }, 100);
    }, 800);
  };

  const extractVIN = (text) => {
    if (!text) return null;
    const cleaned = text.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (cleaned.length >= 17) {
      const vin = cleaned.substring(0, 17);
      if (/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
        return vin;
      }
    }

    return null;
  };

  const extractVINFromText = (text) => {
    if (!text) return null;

    // Remove extra whitespace and convert to uppercase
    const cleaned = text.toUpperCase().replace(/\s+/g, '').trim();
    console.log('Cleaned text (no spaces):', cleaned);

    // Look for consecutive 17-character VIN patterns
    const vinPattern = /[A-HJ-NPR-Z0-9]{17}/g;
    const matches = cleaned.match(vinPattern);

    console.log('Found VIN candidates:', matches);

    if (matches && matches.length > 0) {
      for (const match of matches) {
        // Validate VIN format
        if (/^[A-HJ-NPR-Z0-9]{17}$/.test(match)) {
          console.log('✅ Valid VIN extracted:', match);
          return match;
        }
      }
    }

    // Also try with original spacing removed but more relaxed
    const relaxedPattern = /[A-HJ-NPR-Z0-9]{17,}/;
    const relaxedMatch = cleaned.match(relaxedPattern);

    if (relaxedMatch) {
      const candidate = relaxedMatch[0].substring(0, 17);
      if (/^[A-HJ-NPR-Z0-9]{17}$/.test(candidate)) {
        console.log('✅ Valid VIN from relaxed pattern:', candidate);
        return candidate;
      }
    }

    return null;
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
      {/* Quagga Video Container */}
      <div
        id="scanner-video"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1
        }}
      />

      {/* Hidden Canvas for OCR */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          display: 'none'
        }}
      />

      {/* Hidden Video for OCR fallback */}
      <video
        ref={videoRef}
        style={{
          position: 'absolute',
          display: 'none'
        }}
        autoPlay
        playsInline
        muted
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
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          color: 'white',
          fontSize: '16px',
          fontWeight: '500',
          textShadow: '0 2px 8px rgba(0, 0, 0, 0.8)',
          zIndex: 3,
          animation: status.includes('Scanning') ? 'pulse 1s infinite' : 'none'
        }}
      >
        {status}
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

        #scanner-video {
          overflow: hidden;
        }

        #scanner-video canvas {
          width: 100%;
          height: 100%;
          display: block;
        }
      `}</style>
    </div>
  );
}
