import api from './api';

// Nepal's provinces, districts and local levels (with ward counts). The list
// rarely changes, so it is fetched once per app session and shared.
let treeRequest = null;

export const fetchLocations = () => {
  if (!treeRequest) {
    treeRequest = api.get('/locations')
      .then(({ data }) => data.locations)
      .catch((error) => {
        // Let the next attempt try again instead of caching the failure.
        treeRequest = null;
        throw error;
      });
  }
  return treeRequest;
};

// The province, district, local level and ward at a point (the ward is null
// where it isn't mapped), plus a suggested tole/area name.
export const detectLocation = async ({ lat, lng }) => {
  const { data } = await api.post('/locations/detect', { lat, lng });
  return data;
};
