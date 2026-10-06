const express = require('express');
const router = express.Router();
const locationController = require('../controllers/location.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// States + their cities.
router.get('/', authenticate, locationController.listStates);
router.get('/:stateId/cities', authenticate, locationController.listCities);
router.post('/:stateId/cities', authenticate, locationController.createCity);

module.exports = router;
