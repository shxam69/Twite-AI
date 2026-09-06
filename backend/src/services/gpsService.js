const policyService = require('./policyService');

/**
 * Calculate geographic distance in meters between two points using the Haversine formula
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (angle) => (angle * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Validate latitude and longitude coordinate values
 */
function isValidCoordinate(lat, lon) {
  if (lat === undefined || lat === null || lon === undefined || lon === null) return false;
  const numLat = Number(lat);
  const numLon = Number(lon);
  if (isNaN(numLat) || isNaN(numLon)) return false;
  if (numLat < -90 || numLat > 90) return false;
  if (numLon < -180 || numLon > 180) return false;
  return true;
}

/**
 * Verify employee GPS location against configured workplace policy
 */
async function verifyWorkplaceGeofence(employeeLat, employeeLon) {
  // 1. Validate employee coordinates
  if (!isValidCoordinate(employeeLat, employeeLon)) {
    const error = new Error('Invalid or missing GPS coordinates. Valid latitude (-90 to 90) and longitude (-180 to 180) are required.');
    error.status = 400;
    throw error;
  }

  // 2. Fetch workplace policies
  const wpLatStr = await policyService.getPolicy('workplace_latitude');
  const wpLonStr = await policyService.getPolicy('workplace_longitude');
  const wpRadiusStr = await policyService.getPolicy('workplace_radius_meters');

  const wpLat = Number(wpLatStr);
  const wpLon = Number(wpLonStr);
  const allowedRadius = Math.max(1, Number(wpRadiusStr) || 100);

  // 3. Verify workplace coordinates are configured
  if (wpLatStr === '' || wpLonStr === '' || wpLatStr === null || wpLonStr === null || isNaN(wpLat) || isNaN(wpLon) || !isValidCoordinate(wpLat, wpLon)) {
    const error = new Error('Workplace location coordinates have not been configured by Admin.');
    error.status = 400;
    throw error;
  }

  // 4. Calculate Haversine distance
  const distanceMeters = calculateHaversineDistance(Number(employeeLat), Number(employeeLon), wpLat, wpLon);

  // 5. Compare distance with allowed radius
  if (distanceMeters > allowedRadius) {
    const error = new Error(`You are outside the allowed workplace geofence radius (${Math.round(distanceMeters)}m away, max allowed ${allowedRadius}m).`);
    error.status = 400;
    error.distanceMeters = Math.round(distanceMeters);
    error.allowedRadius = allowedRadius;
    throw error;
  }

  return {
    inside: true,
    distanceMeters: Math.round(distanceMeters),
    allowedRadius,
  };
}

module.exports = {
  calculateHaversineDistance,
  isValidCoordinate,
  verifyWorkplaceGeofence,
};
