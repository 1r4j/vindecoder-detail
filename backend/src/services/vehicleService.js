import db from '../db.js';

export function saveVehicle(vehicleData, userId) {
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
        driveType, gvwr, plant, rawData, userId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      JSON.stringify(rawData),
      userId
    );

    return getVehicleByVIN(vin, userId);
  } catch (error) {
    throw new Error(`Failed to save vehicle: ${error.message}`);
  }
}

export function updateVehicleColor(vin, color, userId) {
  try {
    db.prepare(`
      UPDATE vehicles SET color = ? WHERE vin = ? AND userId = ?
    `).run(color, vin, userId);

    return getVehicleByVIN(vin, userId);
  } catch (error) {
    throw new Error(`Failed to update vehicle color: ${error.message}`);
  }
}

export function getVehicleByVIN(vin, userId) {
  const vehicle = db.prepare(`
    SELECT * FROM vehicles WHERE vin = ? AND userId = ?
  `).get(vin, userId);

  if (vehicle && vehicle.rawData) {
    vehicle.rawData = JSON.parse(vehicle.rawData);
  }

  return vehicle || null;
}

export function getAllVehicles(userId, limit = 100, offset = 0) {
  const vehicles = db.prepare(`
    SELECT * FROM vehicles WHERE userId = ? ORDER BY scannedAt DESC LIMIT ? OFFSET ?
  `).all(userId, limit, offset);

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

export function searchVehicles(query, userId) {
  const searchTerm = `%${query}%`;
  const vehicles = db.prepare(`
    SELECT * FROM vehicles
    WHERE userId = ? AND (vin LIKE ? OR make LIKE ? OR model LIKE ?)
    ORDER BY scannedAt DESC
    LIMIT 20
  `).all(userId, searchTerm, searchTerm, searchTerm);

  return vehicles.map(vehicle => {
    if (vehicle.rawData) {
      vehicle.rawData = JSON.parse(vehicle.rawData);
    }
    return vehicle;
  });
}
