import { useEffect, useRef, useState } from 'react';

export default function QRScanner({ onScan, onClose }) {
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [manualVIN, setManualVIN] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        setError('');
        console.log('🎬 Starting camera...');

        // Check camera permissions
        if (!navigator.mediaDevices?.getUserMedia) {
          setError('📱 Camera API not supported on this device');
          return;
        }

        // Request camera access with iOS-friendly settings
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'environment' },
              width: { min: 320, ideal: 1280 },
              height: { min: 240, ideal: 720 }
            },
            audio: false
          });

          if (!videoRef.current) {
            console.warn('Video ref not available');
            return;
          }

          streamRef.current = stream;
          videoRef.current.srcObject = stream;

          // Ensure video plays on iOS
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.setAttribute('webkit-playsinline', 'true');
          videoRef.current.play().catch(err => {
            console.error('Play error:', err);
            setError('❌ Failed to play video');
          });

          setScanning(true);
          console.log('✅ Camera started successfully');
        } catch (permError) {
          console.error('Permission error:', permError.name, permError.message);
          if (permError.name === 'NotAllowedError') {
            setError('📱 Camera permission denied. Please enable in Settings > Safari > Camera');
          } else if (permError.name === 'NotFoundError') {
            setError('📱 No camera found on this device');
          } else {
            setError(`📱 Camera error: ${permError.message}`);
          }
        }
      } catch (err) {
        console.error('Camera setup error:', err);
        setError(`❌ Error: ${err.message || 'Unable to access camera'}`);
      }
    };

    const timer = setTimeout(startCamera, 200);

    return () => {
      clearTimeout(timer);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('📹 Camera track stopped');
        });
        streamRef.current = null;
      }
    };
  }, []);

  const handleManualInput = () => {
    const cleaned = manualVIN.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');

    if (cleaned.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/.test(cleaned)) {
      console.log('✅ VIN submitted:', cleaned);
      onScan(cleaned);
    } else {
      setError('⚠️ VIN must be exactly 17 alphanumeric characters (no I, O, Q)');
    }
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{
        background: 'linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%)',
        borderRadius: '12px',
        padding: '20px',
        border: '2px solid var(--border)',
        marginBottom: '16px'
      }}>
        <h4 style={{ marginBottom: '16px', color: 'var(--text)', fontSize: '16px', fontWeight: '600' }}>
          📱 Scan VIN with Camera
        </h4>

        {error && (
          <div className="error" style={{ marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {scanning ? (
          <>
            <video
              ref={videoRef}
              style={{
                width: '100%',
                maxHeight: '400px',
                borderRadius: '8px',
                marginBottom: '16px',
                background: '#000',
                display: 'block',
                objectFit: 'cover'
              }}
              autoPlay
              playsInline
              muted
            />
            <p style={{
              textAlign: 'center',
              color: 'var(--text-light)',
              fontSize: '12px',
              marginBottom: '12px',
              fontStyle: 'italic'
            }}>
              📸 Point camera at VIN barcode
              <br />
              ℹ️ Manual input below if camera doesn't work
            </p>
          </>
        ) : (
          <div style={{
            padding: '30px 20px',
            textAlign: 'center',
            background: 'white',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <p style={{ color: 'var(--text-light)', marginBottom: '8px', fontSize: '14px' }}>
              {error ? '❌ Camera unavailable' : '⏳ Starting camera...'}
            </p>
            <p style={{ color: 'var(--text-lighter)', fontSize: '12px' }}>
              Please enable camera access on this device
            </p>
          </div>
        )}

        {/* Manual VIN Input */}
        <div style={{
          marginTop: '16px',
          padding: '16px',
          background: 'white',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '12px',
            fontWeight: '600',
            color: 'var(--text-light)'
          }}>
            📝 Manual VIN Input (Always Available):
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="XXXXXXXXXXXXXXXXX"
              value={manualVIN}
              onChange={(e) => {
                const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                setManualVIN(val.slice(0, 17));
                setError('');
              }}
              maxLength="17"
              autoComplete="off"
              style={{
                flex: 1,
                padding: '10px 12px',
                border: '2px solid var(--border)',
                borderRadius: '8px',
                fontSize: '16px',
                fontFamily: 'monospace',
                fontWeight: '600',
                letterSpacing: '1px'
              }}
            />
            <button
              onClick={handleManualInput}
              className="btn-primary"
              disabled={manualVIN.length !== 17}
              style={{ opacity: manualVIN.length === 17 ? 1 : 0.6, whiteSpace: 'nowrap' }}
            >
              Submit
            </button>
          </div>
          <p style={{
            fontSize: '11px',
            color: 'var(--text-lighter)',
            marginTop: '6px',
            marginBottom: 0
          }}>
            {manualVIN.length}/17 characters • No I, O, Q allowed
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
        <button className="btn-secondary" onClick={onClose}>
          Close Scanner
        </button>
      </div>
    </div>
  );
}
