import { useEffect, useRef, useState } from 'react';

export default function QRScanner({ onScan, onClose }) {
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState('Initializing...');
  const [manualVIN, setManualVIN] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        setError('');
        setStatus('Initializing camera...');
        console.log('🎬 Step 1: Starting camera...');

        // Check camera support
        if (!navigator.mediaDevices?.getUserMedia) {
          setError('📱 Camera API not supported on this device');
          console.error('getUserMedia not available');
          return;
        }

        // Wait for video ref to be ready
        if (!videoRef.current) {
          console.error('Video ref not ready');
          setError('❌ Video element not ready');
          return;
        }

        setStatus('Requesting camera access...');
        console.log('🎬 Step 2: Requesting camera...');

        // Request camera with fallback constraints
        let stream = null;
        try {
          console.log('Requesting camera with preferred constraints...');
          setStatus('Requesting camera with preferred settings...');
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: false
          });
        } catch (err1) {
          console.warn('Preferred constraints failed, trying fallback...', err1.name);
          setStatus('Trying fallback camera settings...');
          try {
            // Fallback with minimal constraints
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'environment' },
              audio: false
            });
          } catch (err2) {
            console.error('Both constraint attempts failed');
            throw err2;
          }
        }

        if (!stream) {
          setError('❌ Failed to get camera stream');
          setStatus('');
          return;
        }

        console.log('📹 Stream obtained:', stream.getTracks().length, 'tracks');
        setStatus('Stream obtained, setting up video...');

        // Assign stream to video element
        streamRef.current = stream;
        videoRef.current.srcObject = stream;

        // Ensure iOS compatibility
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.setAttribute('autoplay', 'true');
        videoRef.current.setAttribute('muted', 'true');

        setStatus('Waiting for video to load...');
        console.log('🎬 Step 3: Waiting for video to load...');

        // Wait for stream to be ready with timeout
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Video loading timeout'));
          }, 5000);

          const checkReady = () => {
            console.log('Video readyState:', videoRef.current?.readyState);
            if (videoRef.current?.readyState === 4) {
              clearTimeout(timeout);
              console.log('✅ Video ready');
              resolve();
            } else {
              setTimeout(checkReady, 100);
            }
          };
          checkReady();
        });

        setStatus('Starting video playback...');
        console.log('🎬 Step 4: Starting playback...');

        // Try to play
        try {
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            await playPromise;
            console.log('✅ Video playing');
          }
        } catch (playErr) {
          console.error('Play error:', playErr);
          if (playErr.name !== 'NotAllowedError') {
            throw playErr;
          }
        }

        setScanning(true);
        setStatus('');
        console.log('✅ Camera initialization complete');
      } catch (err) {
        console.error('Complete error:', err.name, err.message, err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('📱 Camera permission denied. Check Settings > Safari > Camera');
        } else if (err.name === 'NotFoundError') {
          setError('📱 No camera found on this device');
        } else if (err.name === 'NotReadableError') {
          setError('📱 Camera is in use by another app');
        } else if (err.name === 'AbortError') {
          setError('📱 Camera initialization aborted');
        } else if (err.message?.includes('timeout')) {
          setError('📱 Camera took too long to initialize');
        } else {
          setError(`📱 Camera error: ${err.name || err.message}`);
        }
        setScanning(false);
        setStatus('');
      }
    };

    // Delay to ensure DOM is fully mounted
    const timer = setTimeout(startCamera, 300);

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

        {/* Video element - always rendered */}
        <video
          ref={videoRef}
          style={{
            width: '100%',
            height: 'auto',
            minHeight: '300px',
            maxHeight: '400px',
            borderRadius: '8px',
            marginBottom: '16px',
            background: '#000000',
            display: 'block',
            objectFit: 'cover'
          }}
          autoPlay
          playsInline
          muted
        />

        {/* Status message */}
        {status && (
          <p style={{
            textAlign: 'center',
            color: 'var(--primary)',
            fontSize: '13px',
            fontWeight: '500',
            marginBottom: '12px',
            animation: 'pulse 1s infinite'
          }}>
            {status}
          </p>
        )}

        {/* Camera instructions */}
        {scanning && (
          <p style={{
            textAlign: 'center',
            color: 'var(--success)',
            fontSize: '12px',
            marginBottom: '12px',
            fontStyle: 'italic',
            fontWeight: '500'
          }}>
            ✅ Camera ready! Point at VIN barcode
          </p>
        )}

        {error && (
          <p style={{
            textAlign: 'center',
            color: 'var(--danger)',
            fontSize: '12px',
            marginBottom: '12px'
          }}>
            {error}
          </p>
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
