import axios from 'axios';

const NHTSA_API_BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles';

// Use NHTSA's DecodeVinFull endpoint for comprehensive vehicle data
export async function decodeVIN(vin) {
  if (!vin || vin.length !== 17) {
    throw new Error('Invalid VIN format. VINs must be exactly 17 characters.');
  }

  const cleanVIN = vin.toUpperCase().trim();

  try {
    // Use DecodeVinFull endpoint which provides more complete data
    const response = await axios.get(`${NHTSA_API_BASE}/DecodeVinFull/${cleanVIN}?format=json`);

    if (response.data.Count === 0) {
      // Try alternative DecodeVin endpoint if DecodeVinFull returns no results
      return await decodeVINAlternative(cleanVIN);
    }

    const results = response.data.Results;
    const vehicleData = parseVINResults(results, cleanVIN);

    if (!vehicleData.year || !vehicleData.make || !vehicleData.model) {
      throw new Error('Unable to decode VIN. Please check the VIN and try again.');
    }

    console.log(`✅ VIN decoded successfully: ${cleanVIN}`, vehicleData);
    return vehicleData;
  } catch (error) {
    console.error(`❌ VIN decoding error for ${cleanVIN}:`, error.message);
    if (error.response?.status === 404) {
      throw new Error('VIN not found. Please verify the VIN number.');
    }
    if (error.message && error.message.includes('Unable to decode')) {
      throw error;
    }
    throw new Error(error.message || 'Failed to decode VIN. Please try again.');
  }
}

// Fallback to DecodeVin endpoint if DecodeVinFull fails
async function decodeVINAlternative(vin) {
  try {
    const response = await axios.get(`${NHTSA_API_BASE}/DecodeVin/${vin}?format=json`);

    if (response.data.Count === 0 || !response.data.Results) {
      throw new Error('VIN not found in NHTSA database.');
    }

    const results = response.data.Results;
    const vehicleData = parseVINResults(results, vin);

    if (!vehicleData.year || !vehicleData.make || !vehicleData.model) {
      throw new Error('Unable to decode VIN. Please check the VIN and try again.');
    }

    return vehicleData;
  } catch (error) {
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
