import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

export default function QRScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState('');
  const streamRef = useRef(null);
  const scanningRef = useRef(true);

  useEffect(() => {
    const startScanning = async () => {
      try {
        setError('');
        console.log('📱 Requesting back camera access...');

        // Request ONLY back camera with strict constraints
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

        console.log('✅ Camera access granted - back camera');
        streamRef.current = stream;

        if (!videoRef.current) return;

        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();

        // Start scanning after video is ready
        setTimeout(() => {
          scanQRCodes();
        }, 500);
      } catch (err) {
        console.error('Camera error:', err);
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

    // Set canvas size
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    // Draw current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Try to decode QR code
    try {
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) {
        console.log('📸 QR Code detected:', code.data);
        const vin = extractVIN(code.data);
        if (vin) {
          console.log('✅ Valid VIN found:', vin);
          scanningRef.current = false;
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
          }
          setTimeout(() => onScan(vin), 300);
          return;
        }
      }
    } catch (err) {
      // Continue scanning
    }

    // Continue scanning
    requestAnimationFrame(scanQRCodes);
  };

  const extractVIN = (text) => {
    // Clean text
    const cleaned = text.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Look for 17-character VIN
    if (cleaned.length >= 17) {
      const vin = cleaned.substring(0, 17);
      if (/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
        return vin;
      }
    }

    return null;
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

      {/* Canvas for barcode detection (hidden) */}
      <canvas
        ref={canvasRef}
        style={{
          display: 'none'
        }}
      />

      {/* Scan Line Overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 2
      }}>
        {/* Yellow Scan Line */}
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: '3px',
          background: 'linear-gradient(90deg, transparent, #FFD700, transparent)',
          top: '50%',
          transform: 'translateY(-50%)',
          animation: 'scanAnimation 2s infinite',
          boxShadow: '0 0 20px rgba(255, 215, 0, 0.8)'
        }} />

        {/* Frame Guide */}
        <div style={{
          position: 'absolute',
          top: '25%',
          left: '10%',
          right: '10%',
          height: '50%',
          border: '3px solid rgba(255, 215, 0, 0.6)',
          borderRadius: '12px',
          boxShadow: 'inset 0 0 20px rgba(255, 215, 0, 0.1)'
        }}>
          {/* Corner indicators */}
          {['tl', 'tr', 'bl', 'br'].map(corner => (
            <div key={corner} style={{
              position: 'absolute',
              width: '30px',
              height: '30px',
              border: '3px solid #FFD700',
              ...(corner === 'tl' && { top: '-2px', left: '-2px', borderRight: 'none', borderBottom: 'none' }),
              ...(corner === 'tr' && { top: '-2px', right: '-2px', borderLeft: 'none', borderBottom: 'none' }),
              ...(corner === 'bl' && { bottom: '-2px', left: '-2px', borderRight: 'none', borderTop: 'none' }),
              ...(corner === 'br' && { bottom: '-2px', right: '-2px', borderLeft: 'none', borderTop: 'none' })
            }} />
          ))}
        </div>

        {/* Instruction Text */}
        <div style={{
          position: 'absolute',
          bottom: '40px',
          left: '20px',
          right: '20px',
          textAlign: 'center',
          color: 'white',
          fontSize: '16px',
          fontWeight: '700',
          textShadow: '0 2px 8px rgba(0, 0, 0, 0.9)',
          background: 'rgba(0, 0, 0, 0.4)',
          padding: '16px 20px',
          borderRadius: '8px',
          letterSpacing: '0.3px'
        }}>
          📸 Point at VIN barcode
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          right: '20px',
          backgroundColor: 'rgba(239, 68, 68, 0.95)',
          color: 'white',
          padding: '16px 20px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '600',
          textAlign: 'center',
          zIndex: 3,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.8)'
        }}>
          {error}
        </div>
      )}

      {/* Close Button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 3,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          color: '#FFD700',
          border: '2px solid #FFD700',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          fontSize: '24px',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s'
        }}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = 'rgba(255, 215, 0, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
        }}
      >
        ✕
      </button>

      <style>{`
        @keyframes scanAnimation {
          0% { top: 20%; }
          50% { top: 80%; }
          100% { top: 20%; }
        }
      `}</style>
    </div>
  );
}
