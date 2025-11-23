import axios from 'axios';
import mapConfig from '../config/mapConfig';

const { osrmBase } = mapConfig;

const osrmClient = axios.create({
  baseURL: osrmBase,
});

const encodeCoordinate = (coord) => {
  if (!coord || typeof coord.longitude !== 'number' || typeof coord.latitude !== 'number') {
    throw new Error('Coordinate requires { longitude, latitude }');
  }
  return `${coord.longitude},${coord.latitude}`;
};

export const buildRoute = async (origin, destination, { overview = 'full', annotations = 'duration,distance' } = {}) => {
  const originStr = encodeCoordinate(origin);
  const destinationStr = encodeCoordinate(destination);
  const url = `/route/v1/driving/${originStr};${destinationStr}`;
  const params = {
    overview,
    geometries: 'geojson',
    annotations,
  };
  const { data } = await osrmClient.get(url, { params });
  return data;
};

export default {
  buildRoute,
};
