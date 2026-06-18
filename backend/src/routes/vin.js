import express from 'express';
import { decodeVIN, validateVIN } from '../services/vinService.js';
import { saveVehicle, getVehicleByVIN, getAllVehicles, searchVehicles, updateVehicleColor } from '../services/vehicleService.js';

const router = express.Router();

router.post('/decode', async (req, res) => {
  try {
    const { vin } = req.body;

    if (!validateVIN(vin)) {
      return res.status(400).json({
        error: 'Invalid VIN format. VINs must be 17 characters.'
      });
    }

    let vehicleData = getVehicleByVIN(vin);

    if (!vehicleData) {
      vehicleData = await decodeVIN(vin);
      vehicleData = saveVehicle(vehicleData);
    }

    res.json({
      success: true,
      data: vehicleData
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

router.get('/list', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const vehicles = getAllVehicles(limit, offset);

    res.json({
      success: true,
      data: vehicles
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

router.get('/search', (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        error: 'Search query must be at least 2 characters'
      });
    }

    const vehicles = searchVehicles(q);

    res.json({
      success: true,
      data: vehicles
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

router.get('/:vin', (req, res) => {
  try {
    const { vin } = req.params;

    const vehicle = getVehicleByVIN(vin);

    if (!vehicle) {
      return res.status(404).json({
        error: 'Vehicle not found'
      });
    }

    res.json({
      success: true,
      data: vehicle
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

router.patch('/:vin/color', (req, res) => {
  try {
    const { vin } = req.params;
    const { color } = req.body;

    if (!color) {
      return res.status(400).json({
        error: 'Color is required'
      });
    }

    const vehicle = updateVehicleColor(vin, color);

    res.json({
      success: true,
      data: vehicle
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

export default router;
