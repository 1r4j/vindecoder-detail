import { useState } from 'react';

export default function VINBreakdown({ vin }) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  if (!vin || vin.length !== 17) return null;

  const breakdown = [
    { pos: '1-3', label: 'WMI (World Manufacturer Identifier)', value: vin.substring(0, 3), desc: 'Identifies the manufacturer and country of origin' },
    { pos: '4-8', label: 'VDS (Vehicle Descriptor Section)', value: vin.substring(3, 8), desc: 'Describes vehicle attributes (body, engine, transmission, etc.)' },
    { pos: '9', label: 'Check Digit', value: vin[8], desc: 'Validates the VIN using a mathematical formula' },
    { pos: '10', label: 'Model Year', value: vin[9], desc: 'Represents the vehicle model year (A=2010, B=2011, etc.)' },
    { pos: '11', label: 'Assembly Plant', value: vin[10], desc: 'Identifies where the vehicle was assembled' },
    { pos: '12-17', label: 'Serial Number', value: vin.substring(11, 17), desc: 'Unique sequential number for the production run' }
  ];

  return (
    <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>VIN Breakdown</h3>
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary)',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            padding: '4px 8px'
          }}
        >
          {showBreakdown ? '▼ Hide' : '▶ Show'}
        </button>
      </div>

      {showBreakdown && (
        <div>
          {/* Visual VIN Breakdown */}
          <div style={{
            backgroundColor: 'var(--light)',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontFamily: 'monospace',
            fontSize: '18px',
            fontWeight: 'bold',
            letterSpacing: '2px',
            textAlign: 'center',
            wordSpacing: '4px'
          }}>
            <span style={{ color: '#10B981' }}>{vin.substring(0, 3)}</span>
            {' '}
            <span style={{ color: '#06B6D4' }}>{vin.substring(3, 8)}</span>
            {' '}
            <span style={{ color: '#EF4444' }}>{vin[8]}</span>
            {' '}
            <span style={{ color: '#F59E0B' }}>{vin[9]}</span>
            {' '}
            <span style={{ color: '#8B5CF6' }}>{vin[10]}</span>
            {' '}
            <span style={{ color: '#EC4899' }}>{vin.substring(11, 17)}</span>
          </div>

          {/* Position Labels */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '8px',
            marginBottom: '16px',
            fontSize: '12px',
            textAlign: 'center',
            fontWeight: '600'
          }}>
            <div style={{ color: '#10B981' }}>Positions 1-3<br/>(WMI)</div>
            <div style={{ color: '#06B6D4' }}>Positions 4-8<br/>(VDS)</div>
            <div style={{ color: '#EF4444' }}>Position 9<br/>(Check)</div>
            <div style={{ color: '#F59E0B' }}>Position 10<br/>(Year)</div>
            <div style={{ color: '#8B5CF6' }}>Position 11<br/>(Plant)</div>
            <div style={{ color: '#EC4899' }}>Positions 12-17<br/>(Serial)</div>
          </div>

          {/* Detailed Breakdown */}
          <div style={{ display: 'grid', gap: '12px' }}>
            {breakdown.map((item, idx) => (
              <div key={idx} style={{
                backgroundColor: 'white',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '12px',
                borderLeft: '4px solid var(--primary)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontWeight: '600', color: 'var(--text)' }}>{item.label}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>Position {item.pos}</div>
                  </div>
                  <div style={{
                    backgroundColor: 'var(--light)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: 'var(--primary)'
                  }}>
                    {item.value}
                  </div>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-light)' }}>
                  {item.desc}
                </div>
              </div>
            ))}
          </div>

          {/* VIN Explanation */}
          <div style={{
            backgroundColor: '#F0F9FF',
            border: '1px solid #7DD3FC',
            borderRadius: '8px',
            padding: '12px',
            marginTop: '16px',
            fontSize: '13px',
            color: '#0369A1'
          }}>
            <strong>ℹ️ About VINs:</strong> The Vehicle Identification Number (VIN) is a 17-character code that uniquely identifies a vehicle. Each position or group of positions has a specific meaning, allowing manufacturers, dealers, and regulators to track vehicle information.
          </div>
        </div>
      )}
    </div>
  );
}
