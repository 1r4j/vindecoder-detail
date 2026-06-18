export default function VehicleDetails({ vehicle }) {
  return (
    <div className="vehicle-data">
      <div className="data-item">
        <div className="data-label">Year</div>
        <div className="data-value">{vehicle.year}</div>
      </div>
      <div className="data-item">
        <div className="data-label">Make</div>
        <div className="data-value">{vehicle.make}</div>
      </div>
      <div className="data-item">
        <div className="data-label">Model</div>
        <div className="data-value">{vehicle.model}</div>
      </div>
      <div className="data-item">
        <div className="data-label">Body Type</div>
        <div className="data-value">{vehicle.bodyType || 'N/A'}</div>
      </div>
      <div className="data-item">
        <div className="data-label">Engine Type</div>
        <div className="data-value">{vehicle.engineType || 'N/A'}</div>
      </div>
      <div className="data-item">
        <div className="data-label">Transmission</div>
        <div className="data-value">{vehicle.transmission || 'N/A'}</div>
      </div>
      <div className="data-item">
        <div className="data-label">Drive Type</div>
        <div className="data-value">{vehicle.driveType || 'N/A'}</div>
      </div>
      <div className="data-item">
        <div className="data-label">GVWR</div>
        <div className="data-value">{vehicle.gvwr || 'N/A'}</div>
      </div>
      <div className="data-item">
        <div className="data-label">Manufacturing Plant</div>
        <div className="data-value">{vehicle.plant || 'N/A'}</div>
      </div>
      <div className="data-item">
        <div className="data-label">VIN</div>
        <div className="data-value" style={{ fontSize: '14px', fontFamily: 'monospace' }}>{vehicle.vin}</div>
      </div>
    </div>
  );
}
