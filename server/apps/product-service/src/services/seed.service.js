const { randomUUID } = require('crypto');
const restaurantModel = require('../models/restaurant.model');
const productModel = require('../models/product.model');

const restaurantPresets = [
  {
    key: 'pho-house',
    name: 'Saigon Pho House',
    description: 'Authentic Saigon-style pho with slow-simmered broth.',
    cuisine: 'Vietnamese',
    phone: '028-1234-5678',
    email: 'hello@saigonpho.vn',
    images: [
      'https://images.unsplash.com/photo-1604908177070-0e7f3a4e1dca?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1600&q=80',
    ],
  },
  {
    key: 'bun-cha',
    name: 'Hanoi Bun Cha Corner',
    description: 'Charcoal grilled pork with traditional dipping sauce.',
    cuisine: 'Vietnamese',
    phone: '024-2345-6789',
    email: 'contact@buncha.vn',
    images: [
      'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80',
    ],
  },
  {
    key: 'banh-mi',
    name: 'Bánh Mì Station',
    description: 'Freshly baked baguettes and signature fillings every day.',
    cuisine: 'Street Food',
    phone: '028-3456-7890',
    email: 'order@banhmistation.vn',
    images: [
      'https://images.unsplash.com/photo-1589308078052-efe869cf56be?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1600&q=80',
    ],
  },
  {
    key: 'veggie-garden',
    name: 'Veggie Garden',
    description: 'Plant-based Vietnamese comfort food and fusion dishes.',
    cuisine: 'Vegetarian',
    phone: '028-4567-8901',
    email: 'care@veggiegarden.vn',
    images: [
      'https://images.unsplash.com/photo-1546069901-5aea2c8a66c7?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1528715471579-d1bcf0ba5e83?auto=format&fit=crop&w=1600&q=80',
    ],
  },
  {
    key: 'seafood-bay',
    name: 'Coastal Seafood Bay',
    description: 'Daily catch seafood platters with signature sauces.',
    cuisine: 'Seafood',
    phone: '025-5678-9012',
    email: 'fresh@seafoodbay.vn',
    images: [
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1601315483447-02008188c656?auto=format&fit=crop&w=1600&q=80',
    ],
  },
];

const restaurantHeroImageByKey = restaurantPresets.reduce((acc, preset) => {
  acc[preset.key] = preset.images[0];
  return acc;
}, {});

const productPresets = [
  {
    restaurantKey: 'pho-house',
    title: 'Phở Bò Tái Gầu',
    description: 'Rare beef and brisket with rice noodles in aromatic broth.',
    category: 'Main Course',
    type: 'Noodle',
    base_price: 75000,
    images: [
      'https://images.unsplash.com/photo-1604908177070-0e7f3a4e1dca?auto=format&fit=crop&w=1200&q=80',
      restaurantHeroImageByKey['pho-house'],
    ],
    popular: true,
  },
  {
    restaurantKey: 'pho-house',
    title: 'Gỏi Cuốn Tôm Thịt',
    description: 'Fresh spring rolls with shrimp, pork, and herbs.',
    category: 'Starter',
    type: 'Roll',
    base_price: 45000,
    images: [
      'https://images.unsplash.com/photo-1612870533462-1a0b1fb26a40?auto=format&fit=crop&w=1200&q=80',
      restaurantHeroImageByKey['pho-house'],
    ],
  },
  {
    restaurantKey: 'bun-cha',
    title: 'Bún Chả Truyền Thống',
    description: 'Grilled pork patties with vermicelli and pickled papaya.',
    category: 'Main Course',
    type: 'Noodle',
    base_price: 82000,
    images: [
      'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=1200&q=80',
      restaurantHeroImageByKey['bun-cha'],
    ],
    popular: true,
  },
  {
    restaurantKey: 'bun-cha',
    title: 'Nem Rán Hà Nội',
    description: 'Hanoi-style fried spring rolls with dipping sauce.',
    category: 'Starter',
    type: 'Fried',
    base_price: 50000,
    images: [
      'https://images.unsplash.com/photo-1601050690597-df92e3f3cd0b?auto=format&fit=crop&w=1200&q=80',
      restaurantHeroImageByKey['bun-cha'],
    ],
  },
  {
    restaurantKey: 'banh-mi',
    title: 'Bánh Mì Đặc Biệt',
    description: 'Mixed cold cuts, pate, and pickled vegetables.',
    category: 'Sandwich',
    type: 'Bánh mì',
    base_price: 38000,
    images: [
      'https://images.unsplash.com/photo-1589308078052-efe869cf56be?auto=format&fit=crop&w=1200&q=80',
      restaurantHeroImageByKey['banh-mi'],
    ],
    popular: true,
  },
  {
    restaurantKey: 'banh-mi',
    title: 'Bánh Mì Gà Xé',
    description: 'Shredded chicken with house-made sauce.',
    category: 'Sandwich',
    type: 'Bánh mì',
    base_price: 36000,
    images: [
      'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1200&q=80',
      restaurantHeroImageByKey['banh-mi'],
    ],
  },
  {
    restaurantKey: 'veggie-garden',
    title: 'Bún Huế Chay',
    description: 'Spicy Hue-style noodle soup with tofu and mushrooms.',
    category: 'Vegan',
    type: 'Noodle',
    base_price: 78000,
    images: [
      'https://images.unsplash.com/photo-1546069901-5aea2c8a66c7?auto=format&fit=crop&w=1200&q=80',
      restaurantHeroImageByKey['veggie-garden'],
    ],
  },
  {
    restaurantKey: 'veggie-garden',
    title: 'Cơm Đậu Hũ Sả Ớt',
    description: 'Lemongrass tofu served with brown rice and greens.',
    category: 'Vegan',
    type: 'Rice',
    base_price: 72000,
    images: [
      'https://images.unsplash.com/photo-1615529328331-f8917597711f?auto=format&fit=crop&w=1200&q=80',
      restaurantHeroImageByKey['veggie-garden'],
    ],
  },
  {
    restaurantKey: 'seafood-bay',
    title: 'Mực Nướng Sa Tế',
    description: 'Grilled squid with satay sauce.',
    category: 'Seafood',
    type: 'Grill',
    base_price: 135000,
    images: [
      'https://images.unsplash.com/photo-1601315483447-02008188c656?auto=format&fit=crop&w=1200&q=80',
      restaurantHeroImageByKey['seafood-bay'],
    ],
    popular: true,
  },
  {
    restaurantKey: 'seafood-bay',
    title: 'Lẩu Hải Sản Chua Cay',
    description: 'Seafood hotpot with tamarind broth.',
    category: 'Seafood',
    type: 'Hotpot',
    base_price: 220000,
    images: [
      'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?auto=format&fit=crop&w=1200&q=80',
      restaurantHeroImageByKey['seafood-bay'],
    ],
  },
];

async function seedSampleData() {
  // Clean existing data to keep the dataset predictable
  await productModel.pool.query('DELETE FROM products');
  await productModel.pool.query('DELETE FROM restaurants');

  const restaurantMap = new Map();
  const createdRestaurants = [];

  for (const preset of restaurantPresets) {
    const created = await restaurantModel.createRestaurant({
      owner_id: randomUUID(),
      name: preset.name,
      description: preset.description,
      cuisine: preset.cuisine,
      phone: preset.phone,
      email: preset.email,
      images: preset.images,
    });
    createdRestaurants.push(created);
    restaurantMap.set(preset.key, created);
  }

  const createdProducts = [];

  for (const preset of productPresets) {
    const restaurant = restaurantMap.get(preset.restaurantKey);
    if (!restaurant) {
      // Skip products that reference a restaurant not found
      continue;
    }
    const created = await productModel.createProduct({
      restaurant_id: restaurant.id,
      title: preset.title,
      description: preset.description,
      images: preset.images,
      category: preset.category,
      type: preset.type,
      base_price: preset.base_price,
      popular: Boolean(preset.popular),
    });
    createdProducts.push(created);
  }

  return {
    restaurants: createdRestaurants,
    products: createdProducts,
  };
}

module.exports = {
  seedSampleData,
};
