const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY || 'YUyNgtKuEPD1fLE16S0e';

if (!MAPTILER_KEY) {
  // eslint-disable-next-line no-console
  console.warn('[map] VITE_MAPTILER_KEY is not set. Map rendering will be limited.');
}

export const mapConfig = {
  key: MAPTILER_KEY,
  styleUrl: MAPTILER_KEY
    ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
    : 'https://api.maptiler.com/maps/streets-v2/style.json',
  tilesBase: 'https://api.maptiler.com/maps',
  geocodingBase: 'https://api.maptiler.com/geocoding',
  osrmBase: 'https://router.project-osrm.org',
};

export default mapConfig;
