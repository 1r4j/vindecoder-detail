import { useEffect, useRef, useState } from 'react';
import Tesseract from 'tesseract.js';

export default function QRScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState('');
  const [detectedVIN, setDetectedVIN] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('Initializing OCR...');
  const streamRef = useRef(null);
  const scanningRef = useRef(true);
  const ocrRef = useRef(null);
  const lastScanRef = useRef(0);
  const onCloseRef = useRef(onClose);
  const processingRef = useRef(false);

  // Update ref when onClose changes
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Define handleClose
  const handleClose = () => {
    console.log('Closing scanner...');
    scanningRef.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
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
    // Hide body scrolling and lock viewport
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.documentElement.style.overflow = 'hidden';

    // Handle ESC key
    const handleKeyPress = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyPress);

    const initializeScanner = async () => {
      try {
        setError('');
        setStatus('Initializing OCR engine...');

        // Initialize Tesseract
        const { createWorker } = Tesseract;
        const worker = await createWorker();
        ocrRef.current = worker;
        setStatus('OCR ready, requesting camera...');

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

        setStatus('📱 Point camera at VIN');

        // Start scanning frames
        setTimeout(() => {
          scanFrames();
        }, 500);
      } catch (err) {
        console.error('Error:', err);
        if (err.name === 'NotAllowedError') {
          setError('Camera permission denied');
        } else if (err.name === 'NotFoundError') {
          setError('No camera found');
        } else {
          setError('Error: ' + err.message);
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

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      if (ocrRef.current) {
        ocrRef.current.terminate();
      }
    };
  }, []);

  const scanFrames = () => {
    if (!scanningRef.current || !videoRef.current || !canvasRef.current) {
      return;
    }

    const now = Date.now();
    // Scan every 1000ms to avoid blocking UI
    if (now - lastScanRef.current < 1000) {
      setTimeout(scanFrames, 100);
      return;
    }

    // Skip if already processing
    if (processingRef.current) {
      setTimeout(scanFrames, 100);
      return;
    }

    lastScanRef.current = now;

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const ctx = canvas.getContext('2d');

      // Set canvas size
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;

      // Draw video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Process image asynchronously
      processFrame(canvas);
    } catch (err) {
      console.error('Frame scan error:', err);
    }

    setTimeout(scanFrames, 100);
  };

  const processFrame = async (canvas) => {
    if (!scanningRef.current || !ocrRef.current) return;

    processingRef.current = true;
    setIsProcessing(true);
    setStatus('🔍 Analyzing...');

    try {
      // Convert canvas to blob with low quality to reduce processing time
      const blob = await new Promise((resolve) => {
        canvas.toBlob(
          (blob) => resolve(blob),
          'image/jpeg',
          0.7 // Lower quality = faster processing
        );
      });

      if (!blob || !scanningRef.current) {
        processingRef.current = false;
        return;
      }

      // Run OCR
      const result = await ocrRef.current.recognize(blob);
      const text = result.data.text;

      if (text) {
        console.log('OCR result:', text);

        // Extract VIN from text
        const vin = extractVINFromText(text);

        if (vin) {
          console.log('✅ VIN detected:', vin);
          setDetectedVIN(vin);
          setStatus('✅ VIN detected!');
          scanningRef.current = false;

          // Stop scanning and close after delay
          setTimeout(() => {
            processingRef.current = false;
            if (streamRef.current) {
              streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (ocrRef.current) {
              ocrRef.current.terminate();
            }
            if (screen.orientation) {
              screen.orientation.unlock().catch(() => {});
            }
            onScan(vin);
          }, 800);
          return;
        }
      }

      setIsProcessing(false);
      setStatus('📱 Point camera at VIN');
    } catch (err) {
      console.error('OCR error:', err);
      setIsProcessing(false);
      setStatus('📱 Point camera at VIN');
    } finally {
      processingRef.current = false;
    }
  };

  const extractVINFromText = (text) => {
    // Remove whitespace and line breaks
    const cleaned = text.replace(/\s+/g, '').toUpperCase();

    // Look for 17-character VIN patterns
    const vinRegex = /[A-HJ-NPR-Z0-9]{17}/g;
    const matches = cleaned.match(vinRegex);

    if (matches) {
      for (const match of matches) {
        // Verify it looks like a valid VIN
        if (/^[A-HJ-NPR-Z0-9]{17}$/.test(match)) {
          return match;
        }
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
      <canvas ref={canvasRef} style={{ display: 'none' }} />

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
          justifyContent: 'center'
        }}
      >
        {/* Pulsing Detection Circle */}
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
          animation: status.includes('Analyzing') ? 'pulse 1s infinite' : 'none'
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
      `}</style>
    </div>
  );
}
