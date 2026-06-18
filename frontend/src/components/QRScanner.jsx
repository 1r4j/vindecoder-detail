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
        console.log('🎬 Requesting camera permission...');

        // Request camera permission FIRST (back camera)
        try {
          console.log('Requesting camera access...');
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'environment'
            },
            audio: false
          });

          // Stop the stream - we just needed to trigger the permission prompt
          stream.getTracks().forEach(track => track.stop());
          console.log('✅ Camera permission granted');
        } catch (permError) {
          console.error('Camera permission error:', permError.name);
          if (permError.name === 'NotAllowedError') {
            setError('❌ Camera permission denied. Please allow camera access in your phone settings.');
          } else if (permError.name === 'NotFoundError') {
            setError('❌ No camera found on this device');
          } else {
            setError(`❌ Camera error: ${permError.message}`);
          }
          return;
        }

        console.log('🎬 Initializing QR/Barcode scanner...');

        // Wait for DOM element to be ready
        await new Promise(resolve => setTimeout(resolve, 100));

        const scanner = new Html5QrcodeScanner(
          'qr-scanner-container',
          {
            fps: 15,
            qrdecoder: undefined,
            rememberLastUsedCamera: true,
            showTorchButtonIfSupported: true,
            showZoomSliderIfSupported: true,
            disableFlip: false,
            formatsToSupport: ['QR_CODE', 'CODE_128', 'CODE_39', 'CODABAR'],
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

              // Stop scanning and close scanner after small delay
              scanner.clear().catch(() => {});

              // Call onScan which should trigger color selection and invoice creation
              setTimeout(() => {
                onScan(vinMatch);
              }, 500);
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
      width: '100vw',
      height: '100vh',
      margin: 0,
      padding: 0,
      overflow: 'hidden'
    }}>
      {/* Full Scanner - Landscape View */}
      <div
        id="qr-scanner-container"
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#000000',
          borderRadius: 0,
          overflow: 'hidden'
        }}
      />

      {/* Error Display - Overlay on Scanner */}
      {error && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '20px',
          right: '20px',
          backgroundColor: 'rgba(239, 68, 68, 0.95)',
          padding: '16px',
          borderRadius: '8px',
          color: 'white',
          fontSize: '14px',
          fontWeight: '600',
          textAlign: 'center',
          zIndex: 1001,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.8)'
        }}>
          {error}
        </div>
      )}

      {/* Manual Input Fallback - Bottom Panel */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.98)',
        padding: '16px',
        borderTop: '3px solid #FFD700',
        zIndex: 1001,
        maxHeight: '120px',
        overflow: 'auto'
      }}>
        <div style={{
          maxWidth: '600px',
          margin: '0 auto',
          display: 'flex',
          gap: '8px',
          alignItems: 'center'
        }}>
          <input
            type="text"
            placeholder="Type VIN (17 chars)"
            value={manualVIN}
            onChange={(e) => {
              const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
              setManualVIN(val.slice(0, 17));
              setError('');
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && manualVIN.length === 17) {
                handleManualInput();
              }
            }}
            maxLength="17"
            autoComplete="off"
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
              color: '#FFD700'
            }}
          />
          <button
            onClick={handleManualInput}
            disabled={manualVIN.length !== 17}
            className="btn-primary"
            style={{
              opacity: manualVIN.length === 17 ? 1 : 0.5,
              whiteSpace: 'nowrap',
              padding: '10px 16px',
              fontSize: '12px'
            }}
          >
            Submit
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '10px 16px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: '#FFD700',
              border: '2px solid #FFD700',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '12px',
              whiteSpace: 'nowrap'
            }}
          >
            ✕ Close
          </button>
        </div>
      </div>
    </div>
  );
}
