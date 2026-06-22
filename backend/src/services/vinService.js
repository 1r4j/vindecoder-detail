import axios from 'axios';

const NHTSA_API_BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles';

// Use NHTSA's DecodeVin endpoint for vehicle data
export async function decodeVIN(vin) {
  if (!vin || vin.length !== 17) {
    throw new Error('Invalid VIN format. VINs must be exactly 17 characters.');
  }

  const cleanVIN = vin.toUpperCase().trim();

  try {
    console.log(`🔍 Decoding VIN: ${cleanVIN}`);

    // Use DecodeVin endpoint
    const response = await axios.get(`${NHTSA_API_BASE}/DecodeVin/${cleanVIN}?format=json`);

    if (!response.data || response.data.Count === 0) {
      throw new Error('VIN not found in NHTSA database. Please verify the VIN number is correct.');
    }

    const results = response.data.Results;
    if (!results || !Array.isArray(results)) {
      throw new Error('Invalid response from NHTSA API.');
    }

    const vehicleData = parseVINResults(results, cleanVIN);

    // Verify we got at least year and make (some VINs may not have model in NHTSA DB)
    if (!vehicleData.year || !vehicleData.make) {
      console.warn(`⚠️ Incomplete VIN data: year=${vehicleData.year}, make=${vehicleData.make}, model=${vehicleData.model}`);
      throw new Error('Unable to decode VIN. This VIN may not exist in the NHTSA database.');
    }

    console.log(`✅ VIN decoded successfully: ${cleanVIN}`, vehicleData);
    return vehicleData;
  } catch (error) {
    console.error(`❌ VIN decoding error for ${cleanVIN}:`, error.message);

    if (error.response?.status === 404) {
      throw new Error('VIN not found. Please verify the VIN number.');
    }

    if (error.message && (error.message.includes('Unable to decode') || error.message.includes('not found') || error.message.includes('Invalid response'))) {
      throw error;
    }

    throw new Error(error.message || 'Failed to decode VIN. Please try again.');
  }
}

function parseVINResults(results, vin) {
  const getData = (key) => {
    if (!results || !Array.isArray(results)) return null;
    const item = results.find(r => r.Variable === key);
    return item && item.Value && item.Value.trim() !== '' ? item.Value : null;
  };

  const year = getData('Model Year');
  const make = getData('Make');
  const model = getData('Model');

  return {
    vin: vin,
    year: year ? parseInt(year) : null,
    make: make || '',
    model: model || '',
    bodyType: getData('Body Class') || '',
    engineType: getData('Engine Type') || '',
    displacement: getData('Displacement (CC)') || '',
    cylinders: getData('Engine Number of Cylinders') || '',
    transmission: getData('Transmission Style') || '',
    driveType: getData('Drive Type') || '',
    gvwr: getData('Gross Vehicle Weight Rating Class') || '',
    plant: getData('Plant Country') || '',
    series: getData('Series') || '',
    manufacturerName: getData('Manufacturer Name') || '',
    // Additional fields for better vehicle identification
    fuelType: getData('Fuel Type - Primary') || '',
    doors: getData('Number of Doors') || '',
    wheelBase: getData('Wheelbase 2') || '',
    seatbelts: getData('Number of Seat Belts') || ''
  };
}

export function validateVIN(vin) {
  if (!vin || typeof vin !== 'string') return false;
  if (vin.length !== 17) return false;
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return false;
  return true;
}
