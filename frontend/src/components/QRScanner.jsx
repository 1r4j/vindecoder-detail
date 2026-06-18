import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function QRScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!scannerRef.current) return;

    const scanner = new Html5QrcodeScanner(
      'qr-scanner',
      {
        fps: 10,
        qrdecoder: undefined,
        rememberLastUsedCamera: true,
        showTorchButtonIfSupported: true,
        showZoomSliderIfSupported: true,
      },
      false
    );

    const onScanSuccess = (decodedText) => {
      const vin = decodedText.trim().toUpperCase();
      if (vin.length === 17) {
        onScan(vin);
        scanner.clear();
        setScanning(false);
      }
    };

    const onScanFailure = (error) => {
      console.log(`QR code scan error: ${error}`);
    };

    scanner.render(onScanSuccess, onScanFailure);
    setScanning(true);

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [onScan]);

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{
        background: 'var(--light)',
        borderRadius: '8px',
        padding: '16px',
        border: '2px solid var(--border)',
        marginBottom: '12px'
      }}>
        <h4 style={{ marginBottom: '12px', color: 'var(--text)' }}>📱 Scan VIN with Camera</h4>
        <div id="qr-scanner" style={{ width: '100%', minHeight: '300px' }}></div>
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
        <button className="btn-secondary" onClick={onClose}>
          Close Scanner
        </button>
      </div>

      {error && <div className="error">{error}</div>}
    </div>
  );
}
