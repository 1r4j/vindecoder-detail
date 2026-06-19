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
    const startScanning = async () => {
      try {
        setError('');
        console.log('📱 Requesting back camera access...');

        // Request ONLY back camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

        console.log('✅ Camera access granted');
        streamRef.current = stream;

        if (!videoRef.current) return;

        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();

        setTimeout(() => {
          scanQRCodes();
        }, 500);
      } catch (err) {
        console.error('Camera error:', err);
        if (err.name === 'NotAllowedError') {
          setError('❌ Camera permission denied');
        } else if (err.name === 'NotFoundError') {
          setError('❌ No camera found');
        } else {
          setError('❌ Camera error: ' + err.message);
        }
      }
    };

    startScanning();

    return () => {
      scanningRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [onScan]);

  const scanQRCodes = () => {
    if (!scanningRef.current || !videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

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
            onScan(vin);
          }, 800);
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

  const handleSkip = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#000000',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      width: '100vw',
      height: '100vh',
      margin: 0,
      padding: 0,
      overflow: 'hidden'
    }}>
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
        playsInline
        muted
      />

      {/* Hidden Canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px'
      }}>
        {/* Header */}
        <div style={{
          position: 'absolute',
          top: '40px',
          left: '40px',
          color: 'white',
          fontSize: clamp('14px', '3vw', '18px'),
          fontWeight: '700',
          letterSpacing: '0.5px'
        }}>
          Scan the VIN
        </div>

        {/* Top Right Buttons */}
        <div style={{
          position: 'absolute',
          top: '40px',
          right: '40px',
          display: 'flex',
          gap: '12px',
          zIndex: 3
        }}>
          {/* Trash Icon */}
          <button
            onClick={() => setDetectedVIN('')}
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              backgroundColor: '#FFD700',
              border: 'none',
              color: '#000',
              fontSize: '24px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s',
              boxShadow: '0 4px 12px rgba(255, 215, 0, 0.3)'
            }}
          >
            🗑️
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              border: '2px solid rgba(255, 255, 255, 0.5)',
              color: 'white',
              fontSize: '24px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s'
            }}
          >
            ✕
          </button>
        </div>

        {/* Scanning Frame */}
        <div style={{
          position: 'relative',
          width: '100%',
          maxWidth: '600px',
          aspectRatio: '4/1',
          borderRadius: '12px',
          marginBottom: '40px'
        }}>
          {/* Yellow Border Frame */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%',
            height: '80%',
            border: '4px solid #FFD700',
            borderRadius: '12px',
            boxShadow: 'inset 0 0 30px rgba(255, 215, 0, 0.2), 0 0 20px rgba(255, 215, 0, 0.3)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}>
            {/* Animated Detection Circle */}
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: isProcessing ? 'rgba(255, 107, 107, 0.8)' : 'rgba(255, 165, 0, 0.6)',
              boxShadow: `0 0 30px ${isProcessing ? '#FF6B6B' : '#FFB800'}`,
              animation: isProcessing ? 'pulse 1s infinite' : 'pulse 2s infinite',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid rgba(255, 215, 0, 0.8)'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: isProcessing ? '#FF6B6B' : '#FFB800',
                opacity: 0.9
              }} />
            </div>
          </div>

          {/* VIN Display */}
          {detectedVIN && (
            <div style={{
              position: 'absolute',
              top: '-40px',
              left: '50%',
              transform: 'translateX(-50%)',
              color: '#FFD700',
              fontSize: '18px',
              fontWeight: '700',
              letterSpacing: '2px',
              whiteSpace: 'nowrap',
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.8)',
              zIndex: 11
            }}>
              {detectedVIN}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div style={{
          textAlign: 'center',
          color: 'white',
          fontSize: clamp('12px', '2vw', '14px'),
          fontWeight: '500',
          letterSpacing: '0.3px',
          marginBottom: '20px',
          lineHeight: '1.6',
          maxWidth: '600px'
        }}>
          <p style={{ marginBottom: '8px' }}>
            {isProcessing ? '⏳ Processing VIN...' : '📱 Tap to finish focusing'}
          </p>
          <p style={{ fontSize: clamp('11px', '1.8vw', '13px'), opacity: 0.8 }}>
            Place the VIN barcode in the yellow frame
          </p>
        </div>

        {/* Skip Button */}
        <button
          onClick={handleSkip}
          style={{
            padding: '12px 32px',
            fontSize: clamp('13px', '2vw', '14px'),
            fontWeight: '600',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.3s',
            letterSpacing: '1px'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
          }}
        >
          SKIP
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          position: 'absolute',
          top: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(239, 68, 68, 0.95)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '600',
          textAlign: 'center',
          zIndex: 3,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.8)',
          maxWidth: '90%'
        }}>
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
            transform: scale(1.1);
          }
        }

        @media (max-width: 768px) {
          div:has(> video) {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
