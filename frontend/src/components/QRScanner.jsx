import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function QRScanner({ onScan, onClose }) {
  const [error, setError] = useState('');
  const [manualVIN, setManualVIN] = useState('');
  const scannerInstanceRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const initScanner = async () => {
      try {
        setError('');
        console.log('🎬 Initializing QR/Barcode scanner...');

        // Wait for DOM element to be ready
        await new Promise(resolve => setTimeout(resolve, 100));

        const scanner = new Html5QrcodeScanner(
          'qr-scanner-container',
          {
            fps: 20,
            qrdecoder: undefined,
            rememberLastUsedCamera: true,
            showTorchButtonIfSupported: true,
            showZoomSliderIfSupported: true,
            aspectRatio: 1.0,
            disableFlip: false,
            formatsToSupport: ['QR_CODE', 'CODE_128', 'CODE_39', 'CODABAR', 'UPC_A', 'UPC_E'],
          },
          false
        );

        scannerInstanceRef.current = scanner;

        const onScanSuccess = (decodedText) => {
          console.log('📸 Barcode detected:', decodedText);
          const cleanVIN = decodedText.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

          // Accept 17-character VINs
          if (cleanVIN.length >= 17) {
            const vinMatch = cleanVIN.substring(0, 17);
            if (/^[A-HJ-NPR-Z0-9]{17}$/.test(vinMatch)) {
              console.log('✅ Valid VIN detected:', vinMatch);
              onScan(vinMatch);
              scanner.clear().catch(() => {});
            }
          }
        };

        const onScanFailure = (error) => {
          // Silent - this happens constantly during scanning
        };

        await scanner.render(onScanSuccess, onScanFailure);
        console.log('✅ Scanner initialized successfully');

        // Add scan line animation overlay
        addScanLineOverlay();
      } catch (err) {
        console.error('Scanner initialization error:', err);
        setError(`❌ Scanner error: ${err.message || 'Unable to initialize scanner'}`);
      }
    };

    initScanner();

    return () => {
      if (scannerInstanceRef.current) {
        scannerInstanceRef.current.clear().catch(() => {});
        scannerInstanceRef.current = null;
      }
    };
  }, [onScan]);

  const addScanLineOverlay = () => {
    // Find the scanner element and add overlay
    const scannerElement = document.getElementById('qr-scanner-container');
    if (!scannerElement) return;

    // Create overlay container
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      border-radius: 8px;
      overflow: hidden;
    `;

    // Create scan line
    const scanLine = document.createElement('div');
    scanLine.style.cssText = `
      position: absolute;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, transparent, #FFD700, transparent);
      top: 50%;
      transform: translateY(-50%);
      animation: scanAnimation 2s infinite;
      box-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
    `;

    // Create frame guide
    const frame = document.createElement('div');
    frame.style.cssText = `
      position: absolute;
      top: 25%;
      left: 10%;
      right: 10%;
      height: 50%;
      border: 2px solid rgba(255, 215, 0, 0.5);
      border-radius: 12px;
      box-shadow: inset 0 0 20px rgba(255, 215, 0, 0.1);
    `;

    // Create corner indicators
    const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    corners.forEach(corner => {
      const cornerEl = document.createElement('div');
      const isTop = corner.includes('top');
      const isLeft = corner.includes('left');

      cornerEl.style.cssText = `
        position: absolute;
        width: 30px;
        height: 30px;
        border: 3px solid #FFD700;
        ${isTop ? 'top: -2px;' : 'bottom: -2px;'}
        ${isLeft ? 'left: -2px;' : 'right: -2px;'}
        ${isTop && isLeft ? 'border-right: none; border-bottom: none;' : ''}
        ${isTop && !isLeft ? 'border-left: none; border-bottom: none;' : ''}
        ${!isTop && isLeft ? 'border-right: none; border-top: none;' : ''}
        ${!isTop && !isLeft ? 'border-left: none; border-top: none;' : ''}
      `;
      frame.appendChild(cornerEl);
    });

    // Create instruction text
    const instruction = document.createElement('div');
    instruction.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 0;
      right: 0;
      text-align: center;
      color: white;
      font-size: 14px;
      font-weight: 600;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
      background: rgba(0, 0, 0, 0.3);
      padding: 12px;
      border-radius: 8px;
      margin: 0 20px;
    `;
    instruction.textContent = '📸 Align VIN barcode with yellow frame';

    overlay.appendChild(scanLine);
    overlay.appendChild(frame);
    overlay.appendChild(instruction);
    scannerElement.style.position = 'relative';
    scannerElement.appendChild(overlay);

    // Add animation keyframes
    const style = document.createElement('style');
    style.textContent = `
      @keyframes scanAnimation {
        0% { top: 20%; }
        50% { top: 80%; }
        100% { top: 20%; }
      }
    `;
    document.head.appendChild(style);
  };

  const handleManualInput = () => {
    const cleaned = manualVIN.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');

    if (cleaned.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/.test(cleaned)) {
      console.log('✅ VIN submitted manually:', cleaned);
      onScan(cleaned);
    } else {
      setError('⚠️ VIN must be exactly 17 alphanumeric characters');
    }
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
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px'
    }}>
      {/* Scanner Container */}
      <div style={{
        width: '100%',
        maxWidth: '100%',
        height: '100%',
        maxHeight: '100%',
        borderRadius: '12px',
        overflow: 'hidden',
        marginBottom: '20px'
      }}>
        <div
          id="qr-scanner-container"
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '12px'
          }}
        />
      </div>

      {/* Bottom Controls */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        padding: '20px',
        borderTop: '2px solid #FFD700'
      }}>
        {error && (
          <div className="error" style={{ marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {/* Manual VIN Input */}
        <div style={{
          marginBottom: '16px',
          padding: '16px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          border: '1px solid #FFD700'
        }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '12px',
            fontWeight: '600',
            color: '#FFD700'
          }}>
            📝 Manual VIN Input (Fallback):
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Enter 17-character VIN"
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
                border: '2px solid #FFD700',
                borderRadius: '8px',
                fontSize: '16px',
                fontFamily: 'monospace',
                fontWeight: '600',
                letterSpacing: '1px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: 'white'
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
            color: '#FFD700',
            marginTop: '6px',
            marginBottom: 0
          }}>
            {manualVIN.length}/17 characters
          </p>
        </div>

        {/* Close Button */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            className="btn-secondary"
            onClick={onClose}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: '#FFD700',
              border: '2px solid #FFD700'
            }}
          >
            ✕ Close Scanner
          </button>
        </div>
      </div>
    </div>
  );
}
