import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

export default function QRScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState('');
  const [detectedVIN, setDetectedVIN] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const streamRef = useRef(null);
  const scanningRef = useRef(true);

  useEffect(() => {
    // Hide body scrolling and lock viewport
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.documentElement.style.overflow = 'hidden';

    const startScanning = async () => {
      try {
        setError('');

        // Lock orientation to landscape
        if (screen.orientation) {
          try {
            await screen.orientation.lock('landscape-primary').catch(() => {
              return screen.orientation.lock('landscape');
            });
            console.log('✅ Locked to landscape');
          } catch (err) {
            console.warn('Orientation lock not available:', err);
          }
        }

        // Request fullscreen if available
        const scannerContainer = document.getElementById('scanner-fullscreen');
        if (scannerContainer && scannerContainer.requestFullscreen) {
          try {
            await scannerContainer.requestFullscreen().catch(() => {});
          } catch (err) {
            console.warn('Fullscreen not available:', err);
          }
        }

        console.log('📱 Requesting camera...');

        // Request back camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        });

        console.log('✅ Camera granted');
        streamRef.current = stream;

        if (!videoRef.current) return;

        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('autoplay', 'true');
        videoRef.current.setAttribute('muted', 'true');

        setTimeout(() => {
          scanQRCodes();
        }, 500);
      } catch (err) {
        console.error('Error:', err);
        if (err.name === 'NotAllowedError') {
          setError('Camera permission denied');
        } else if (err.name === 'NotFoundError') {
          setError('No camera found');
        } else {
          setError('Camera error: ' + err.message);
        }
      }
    };

    startScanning();

    return () => {
      scanningRef.current = false;

      // Restore body
      document.body.style.overflow = 'auto';
      document.body.style.position = 'relative';
      document.body.style.width = 'auto';
      document.documentElement.style.overflow = 'auto';

      // Unlock orientation
      if (screen.orientation) {
        try {
          screen.orientation.unlock();
        } catch (err) {
          console.warn('Could not unlock:', err);
        }
      }

      // Exit fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      // Stop camera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const scanQRCodes = () => {
    if (!scanningRef.current || !videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    try {
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) {
        const vin = extractVIN(code.data);
        if (vin) {
          setIsProcessing(true);
          setDetectedVIN(vin);
          console.log('✅ VIN detected:', vin);
          scanningRef.current = false;

          setTimeout(() => {
            if (streamRef.current) {
              streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (screen.orientation) {
              screen.orientation.unlock().catch(() => {});
            }
            onScan(vin);
          }, 600);
          return;
        }
      }
    } catch (err) {
      // Continue scanning
    }

    requestAnimationFrame(scanQRCodes);
  };

  const extractVIN = (text) => {
    const cleaned = text.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length >= 17) {
      const vin = cleaned.substring(0, 17);
      if (/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
        return vin;
      }
    }
    return null;
  };

  const handleClose = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (screen.orientation) {
      screen.orientation.unlock().catch(() => {});
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    onClose();
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
      {/* Video Stream - Full Background */}
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

      {/* Overlay - Dark tint */}
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

      {/* Instructions */}
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
          zIndex: 3
        }}
      >
        <p>{isProcessing ? '⏳ Processing...' : '📱 Align VIN with frame'}</p>
      </div>

      {/* Close Button - Top Right */}
      <button
        onClick={handleClose}
        style={{
          position: 'absolute',
          top: '30px',
          right: '30px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          border: '2px solid rgba(255, 255, 255, 0.5)',
          color: 'white',
          fontSize: '28px',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s',
          zIndex: 4,
          padding: 0,
          lineHeight: '1'
        }}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
          e.target.style.borderColor = 'rgba(255, 255, 255, 0.8)';
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
          e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
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
