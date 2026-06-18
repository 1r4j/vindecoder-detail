import db from '../db.js';

export function saveVehicle(vehicleData) {
  const {
    vin,
    year,
    make,
    model,
    color,
    bodyType,
    engineType,
    transmission,
    driveType,
    gvwr,
    plant,
    rawData
  } = vehicleData;

  try {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO vehicles (
        vin, year, make, model, color, bodyType, engineType, transmission,
        driveType, gvwr, plant, rawData
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      vin,
      year,
      make,
      model,
      color || '',
      bodyType,
      engineType,
      transmission,
      driveType,
      gvwr,
      plant,
      JSON.stringify(rawData)
    );

    return getVehicleByVIN(vin);
  } catch (error) {
    throw new Error(`Failed to save vehicle: ${error.message}`);
  }
}

export function updateVehicleColor(vin, color) {
  try {
    db.prepare(`
      UPDATE vehicles SET color = ? WHERE vin = ?
    `).run(color, vin);

    return getVehicleByVIN(vin);
  } catch (error) {
    throw new Error(`Failed to update vehicle color: ${error.message}`);
  }
}

export function getVehicleByVIN(vin) {
  const vehicle = db.prepare(`
    SELECT * FROM vehicles WHERE vin = ?
  `).get(vin);

  if (vehicle && vehicle.rawData) {
    vehicle.rawData = JSON.parse(vehicle.rawData);
  }

  return vehicle || null;
}

export function getAllVehicles(limit = 100, offset = 0) {
  const vehicles = db.prepare(`
    SELECT * FROM vehicles ORDER BY scannedAt DESC LIMIT ? OFFSET ?
  `).all(limit, offset);

  return vehicles.map(vehicle => {
    if (vehicle.rawData) {
      vehicle.rawData = JSON.parse(vehicle.rawData);
    }
    return vehicle;
  });
}

export function getVehicleById(id) {
  const vehicle = db.prepare(`
    SELECT * FROM vehicles WHERE id = ?
  `).get(id);

  if (vehicle && vehicle.rawData) {
    vehicle.rawData = JSON.parse(vehicle.rawData);
  }

  return vehicle || null;
}

export function deleteVehicle(id) {
  db.prepare('DELETE FROM vehicles WHERE id = ?').run(id);
  return { success: true };
}

export function searchVehicles(query) {
  const searchTerm = `%${query}%`;
  const vehicles = db.prepare(`
    SELECT * FROM vehicles
    WHERE vin LIKE ? OR make LIKE ? OR model LIKE ?
    ORDER BY scannedAt DESC
    LIMIT 20
  `).all(searchTerm, searchTerm, searchTerm);

  return vehicles.map(vehicle => {
    if (vehicle.rawData) {
      vehicle.rawData = JSON.parse(vehicle.rawData);
    }
    return vehicle;
  });
}
