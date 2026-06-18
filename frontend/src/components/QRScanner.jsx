import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function QRScanner({ onScan, onClose }) {
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [manualVIN, setManualVIN] = useState('');
  const scannerRef = useRef(null);
  const scannerInstanceRef = useRef(null);

  useEffect(() => {
    const initScanner = async () => {
      try {
        setError('');

        // Request camera permissions
        try {
          await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        } catch (permError) {
          setError('📱 Camera permission denied. Please enable camera access in your browser settings.');
          console.error('Camera permission error:', permError);
          return;
        }

        // Check if element exists
        if (!document.getElementById('qr-scanner-element')) {
          setError('Scanner element not found');
          return;
        }

        const scanner = new Html5QrcodeScanner(
          'qr-scanner-element',
          {
            fps: 15,
            qrdecoder: undefined,
            rememberLastUsedCamera: true,
            showTorchButtonIfSupported: true,
            showZoomSliderIfSupported: true,
            aspectRatio: 1,
            disableFlip: false,
          },
          false
        );

        scannerInstanceRef.current = scanner;

        const onScanSuccess = (decodedText) => {
          const cleanVIN = decodedText.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

          // Accept VINs (17 chars) or codes that contain VIN format
          if (cleanVIN.length >= 17) {
            const vinMatch = cleanVIN.substring(0, 17);
            if (/^[A-HJ-NPR-Z0-9]{17}$/.test(vinMatch)) {
              onScan(vinMatch);
              scanner.clear().catch(() => {});
              setScanning(false);
            }
          }
        };

        const onScanFailure = (error) => {
          // Silent failures are OK during scanning
          console.debug('Scan attempt:', error);
        };

        await scanner.render(onScanSuccess, onScanFailure);
        setScanning(true);
        console.log('Scanner initialized successfully');
      } catch (err) {
        console.error('Scanner initialization error:', err);
        setError(`❌ Scanner error: ${err.message || 'Unable to access camera'}`);
        setScanning(false);
      }
    };

    initScanner();

    return () => {
      if (scannerInstanceRef.current) {
        scannerInstanceRef.current.clear().catch(err => {
          console.debug('Cleanup error:', err);
        });
        scannerInstanceRef.current = null;
      }
    };
  }, [onScan]);

  const handleManualInput = () => {
    if (manualVIN.length === 17) {
      onScan(manualVIN.toUpperCase());
    } else {
      setError('⚠️ VIN must be exactly 17 characters');
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

        {!scanning && error && (
          <div className="error" style={{ marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {scanning ? (
          <>
            <div
              id="qr-scanner-element"
              ref={scannerRef}
              style={{
                width: '100%',
                minHeight: '350px',
                borderRadius: '8px',
                overflow: 'hidden',
                marginBottom: '16px',
                background: '#000'
              }}
            />
            <p style={{
              textAlign: 'center',
              color: 'var(--text-light)',
              fontSize: '12px',
              marginBottom: '12px'
            }}>
              Point camera at VIN barcode or display
            </p>
          </>
        ) : (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            background: 'white',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <p style={{ color: 'var(--text-light)', marginBottom: '8px' }}>
              {error ? '❌ Camera not available' : '⏳ Initializing camera...'}
            </p>
          </div>
        )}

        {/* Manual VIN Input Fallback */}
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
            Manual VIN Input (Fallback):
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Enter 17-character VIN"
              value={manualVIN}
              onChange={(e) => {
                setManualVIN(e.target.value.toUpperCase());
                setError('');
              }}
              maxLength="17"
              style={{
                flex: 1,
                padding: '10px 12px',
                border: '2px solid var(--border)',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: 'monospace',
                fontWeight: '600'
              }}
            />
            <button
              onClick={handleManualInput}
              className="btn-primary"
              disabled={manualVIN.length !== 17}
              style={{ opacity: manualVIN.length === 17 ? 1 : 0.6 }}
            >
              Submit
            </button>
          </div>
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
