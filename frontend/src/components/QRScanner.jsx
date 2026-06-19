import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function QRScanner({ onScan, onClose }) {
  const [error, setError] = useState('');
  const [detectedVIN, setDetectedVIN] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('📱 Initializing scanner...');
  const [manualVIN, setManualVIN] = useState('');
  const scannerRef = useRef(null);
  const streamRef = useRef(null);
  const scanningRef = useRef(true);
  const onCloseRef = useRef(onClose);
  const detectedVINsRef = useRef(new Set());

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleClose = () => {
    console.log('Closing scanner...');
    scanningRef.current = false;

    if (scannerRef.current) {
      try {
        scannerRef.current.clear();
      } catch (err) {
        console.warn('Scanner clear error:', err);
      }
    }

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
        setStatus('🔍 Initializing barcode scanner...');

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

        setStatus('📱 Requesting camera...');

        // Initialize Html5QrcodeScanner
        const scanner = new Html5QrcodeScanner(
          'scanner-video',
          {
            fps: 30,
            qrdecoder: undefined,
            disableFlip: false,
            rememberLastUsedCamera: true,
            showTorchButtonIfSupported: true,
            showZoomSliderIfSupported: true,
            formatsToSupport: [
              'CODE_128',
              'CODE_39',
              'CODE_39_VIN',
              'EAN_13',
              'EAN_8',
              'UPC_A',
              'UPC_E',
              'CODABAR',
              'QR_CODE'
            ]
          },
          false
        );

        scannerRef.current = scanner;

        const onScanSuccess = (decodedText, decodedResult) => {
          if (!scanningRef.current) return;

          console.log('📸 Barcode detected:', decodedText);

          const vin = extractVIN(decodedText);

          if (vin && !detectedVINsRef.current.has(vin)) {
            detectedVINsRef.current.add(vin);
            console.log('✅ Valid VIN:', vin);
            handleVINDetected(vin);
          }
        };

        const onScanFailure = (error) => {
          // Silently continue scanning
        };

        await scanner.render(onScanSuccess, onScanFailure);
        setStatus('🎯 Point at VIN barcode');

        // Get stream reference
        const video = document.querySelector('#scanner-video video');
        if (video && video.srcObject) {
          streamRef.current = video.srcObject;
        }
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

      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch (err) {
          console.warn('Scanner cleanup error:', err);
        }
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
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

  const handleVINDetected = (vin) => {
    setDetectedVIN(vin);
    setIsProcessing(true);
    setStatus('✅ VIN detected!');
    scanningRef.current = false;

    if (scannerRef.current) {
      try {
        scannerRef.current.clear();
      } catch (err) {
        console.warn('Scanner clear error:', err);
      }
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
    console.log('Cleaned barcode:', cleaned);

    // Look for exactly 17-character VIN pattern
    if (cleaned.length >= 17) {
      // Try to find VIN anywhere in the string
      for (let i = 0; i <= cleaned.length - 17; i++) {
        const candidate = cleaned.substring(i, i + 17);
        if (/^[A-HJ-NPR-Z0-9]{17}$/.test(candidate)) {
          console.log('Valid VIN found:', candidate);
          return candidate;
        }
      }
    }

    return null;
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
      {/* Scanner Video */}
      <div
        id="scanner-video"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,
          borderRadius: 0
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
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: '16px 20px',
          borderRadius: '12px',
          border: '2px solid #FFD700',
          zIndex: 3,
          width: '80%',
          maxWidth: '400px'
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
          📝 Type VIN (Fallback)
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="17-char VIN"
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
            Submit
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
