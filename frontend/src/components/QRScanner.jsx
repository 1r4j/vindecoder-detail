import { useEffect, useRef, useState } from 'react';
import Quagga from '@ericblade/quagga2';

export default function QRScanner({ onScan, onClose }) {
  const [error, setError] = useState('');
  const [detectedVIN, setDetectedVIN] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('📱 Initializing camera...');
  const streamRef = useRef(null);
  const scanningRef = useRef(true);
  const onCloseRef = useRef(onClose);
  const detectedVINsRef = useRef(new Set());

  // Update ref when onClose changes
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Define handleClose
  const handleClose = () => {
    console.log('Closing scanner...');
    scanningRef.current = false;

    // Stop Quagga
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
        setStatus('📱 Requesting camera...');

        // Lock orientation
        if (screen.orientation) {
          try {
            await screen.orientation.lock('landscape-primary').catch(() => {
              return screen.orientation.lock('landscape');
            });
            console.log('✅ Locked to landscape');
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

        // Initialize Quagga
        setStatus('🔍 Initializing barcode scanner...');

        await Quagga.init(
          {
            inputStream: {
              type: 'LiveStream',
              constraints: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'environment'
              },
              target: document.querySelector('#scanner-video')
            },
            decoder: {
              readers: [
                'code_128_reader',
                'ean_reader',
                'ean_8_reader',
                'upc_reader',
                'upc_e_reader',
                'codabar_reader',
                'code_39_reader',
                'code_39_vin_reader',
                'i2of5_reader'
              ],
              debug: {
                showCanvas: false,
                showPatternOverlay: false,
                showFrequency: false,
                showSkeleton: false
              }
            },
            locator: {
              halfSample: true,
              patchSize: 'medium'
            },
            numOfWorkers: 1,
            frequency: 10
          },
          (err) => {
            if (err) {
              console.error('Quagga init error:', err);
              setError('Failed to initialize barcode scanner');
              return;
            }
            console.log('✅ Quagga initialized');
            Quagga.start();
            setStatus('🎯 Align barcode with frame');
          }
        );

        // Handle barcode detection
        Quagga.onDetected((result) => {
          if (!scanningRef.current) return;

          const code = result.codeResult.code;
          console.log('📸 Barcode detected:', code);

          if (code) {
            const vin = extractVIN(code);

            if (vin && !detectedVINsRef.current.has(vin)) {
              detectedVINsRef.current.add(vin);
              console.log('✅ VIN detected:', vin);
              setDetectedVIN(vin);
              setIsProcessing(true);
              setStatus('✅ VIN detected!');
              scanningRef.current = false;

              // Stop scanning
              try {
                Quagga.stop();
              } catch (err) {
                console.warn('Quagga stop error:', err);
              }

              // Close after delay
              setTimeout(() => {
                handleClose();
                setTimeout(() => {
                  onScan(vin);
                }, 100);
              }, 800);
            }
          }
        });

        // Get stream reference
        const videoElement = document.querySelector('#scanner-video video');
        if (videoElement && videoElement.srcObject) {
          streamRef.current = videoElement.srcObject;
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

      try {
        Quagga.stop();
        Quagga.offDetected();
      } catch (err) {
        console.warn('Quagga cleanup error:', err);
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

  const extractVIN = (text) => {
    // Clean up the text
    const cleaned = text.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Look for 17-character VIN pattern
    if (cleaned.length >= 17) {
      const vin = cleaned.substring(0, 17);
      if (/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
        return vin;
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
          animation: status.includes('Initializing') ? 'pulse 1s infinite' : 'none'
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
