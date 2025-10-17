import {
  getAllRestaurants,
  getRestaurantById,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant
} from '../services/restaurant.service.js';

export async function getRestaurants(req, res) {
  try {
    const data = await getAllRestaurants();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getRestaurant(req, res) {
  try {
    const { id } = req.params;
    const restaurant = await getRestaurantById(id);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function addRestaurant(req, res) {
  try {
    const newRestaurant = await createRestaurant(req.body);
    res.status(201).json(newRestaurant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function editRestaurant(req, res) {
  try {
    const { id } = req.params;
    const updated = await updateRestaurant(id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function removeRestaurant(req, res) {
  try {
    const { id } = req.params;
    const result = await deleteRestaurant(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
