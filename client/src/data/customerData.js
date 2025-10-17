import restaurantA from "../assets/product_1.png";
import restaurantB from "../assets/product_2.png";
import restaurantC from "../assets/product_3.png";
import dishA from "../assets/product_4.png";
import dishB from "../assets/product_5.png";
import dishC from "../assets/product_6.png";
import dishD from "../assets/product_7.png";
import dishE from "../assets/product_8.png";
import dishF from "../assets/product_9.png";
import dishG from "../assets/product_10.png";
import dishH from "../assets/product_11.png";
import dishI from "../assets/product_12.png";
import userAvatar1 from "../assets/user1.png";
import userAvatar2 from "../assets/user2.png";
import userAvatar3 from "../assets/user3.png";
import userAvatar4 from "../assets/user4.png";

export const restaurants = [
  {
    id: "res-01",
    name: "Saigon Street Kitchen",
    address: "215 Nguyen Hue, District 1, Ho Chi Minh City",
    distanceKm: 1.2,
    rating: 4.8,
    reviewCount: 324,
    shortHours: "08:00 - 22:00",
    heroImage: restaurantA,
    coverImage: restaurantA,
    tags: ["Noodles", "Street Food", "Delivery under 30m"],
    promotions: [
      {
        id: "promo-01",
        title: "Free spring rolls for orders over 200k",
        description: "Automatically applied at checkout until 31 Dec 2025.",
      },
      {
        id: "promo-02",
        title: "Lunch combo -20%",
        description: "11:00 - 14:00, Monday to Friday.",
      },
    ],
    featuredDishIds: ["dish-01", "dish-02", "dish-03"],
    categories: ["Noodles", "Grill", "Vegan"],
    phone: "0901 234 567",
    mapHint: "District 1, HCMC",
  },
  {
    id: "res-02",
    name: "Hue Flavor Bistro",
    address: "87 Bui Thi Xuan, District 3, Ho Chi Minh City",
    distanceKm: 3.4,
    rating: 4.6,
    reviewCount: 198,
    shortHours: "09:00 - 21:00",
    heroImage: restaurantB,
    coverImage: restaurantB,
    tags: ["Central Vietnam", "Family meals", "Vegetarian options"],
    promotions: [
      {
        id: "promo-03",
        title: "Buy 2 Bun Bo Hue get 1 iced tea free",
        description: "Valid every weekend.",
      },
    ],
    featuredDishIds: ["dish-04", "dish-05", "dish-06"],
    categories: ["Noodles", "Rice", "Dessert"],
    phone: "0906 789 234",
    mapHint: "District 3, HCMC",
  },
  {
    id: "res-03",
    name: "Chay Garden",
    address: "12 Vo Van Tan, District 3, Ho Chi Minh City",
    distanceKm: 2.1,
    rating: 4.9,
    reviewCount: 412,
    shortHours: "10:00 - 22:30",
    heroImage: restaurantC,
    coverImage: restaurantC,
    tags: ["Plant based", "Healthy", "Gluten friendly"],
    promotions: [
      {
        id: "promo-04",
        title: "15% off first vegan hotpot",
        description: "Use code CHAY15 at checkout.",
      },
    ],
    featuredDishIds: ["dish-07", "dish-08", "dish-09"],
    categories: ["Salad", "Hotpot", "Dessert"],
    phone: "0905 111 222",
    mapHint: "District 3, HCMC",
  },
];

export const dishes = [
  {
    _id: "dish-01",
    restaurantId: "res-01",
    title: "Pho Bo Slow Simmered",
    description: "Beef broth cooked for 12 hours with star anise, ginger, and fresh herbs.",
    category: "Noodles",
    type: "Soup",
    spiceLevel: 1,
    sizes: ["Regular", "Large"],
    price: {
      Regular: 65000,
      Large: 78000,
    },
    images: [dishA, dishB],
    tags: ["Best seller", "Low fat"],
    rating: 4.9,
    reviewCount: 180,
    toppings: [
      { id: "top-01", label: "Extra basil", value: "extra-basil", priceDelta: 5000 },
      { id: "top-02", label: "Extra beef", value: "extra-beef", priceDelta: 15000 },
      { id: "top-03", label: "Bone marrow", value: "bone-marrow", priceDelta: 22000 },
    ],
    options: [
      {
        id: "opt-01",
        label: "Noodle style",
        values: [
          { id: "fresh-flat", label: "Fresh flat", priceDelta: 0 },
          { id: "dry-flat", label: "Dry flat", priceDelta: 0 },
          { id: "instant", label: "Instant noodle", priceDelta: -5000 },
        ],
      },
    ],
    preparation: { prepMinutes: 10, cookMinutes: 25 },
  },
  {
    _id: "dish-02",
    restaurantId: "res-01",
    title: "Charcoal Pork Rice",
    description: "Chargrilled pork chop, broken rice, pickled veggies, and sunny-side egg.",
    category: "Grill",
    type: "Rice",
    spiceLevel: 2,
    sizes: ["Regular", "XL"],
    price: {
      Regular: 59000,
      XL: 72000,
    },
    images: [dishC, dishD],
    tags: ["Combo ready"],
    rating: 4.7,
    reviewCount: 142,
    toppings: [
      { id: "top-04", label: "Extra pork", value: "extra-pork", priceDelta: 18000 },
      { id: "top-05", label: "Fried egg", value: "fried-egg", priceDelta: 8000 },
    ],
    options: [
      {
        id: "opt-02",
        label: "Sauce",
        values: [
          { id: "fish-sauce", label: "Classic fish sauce", priceDelta: 0 },
          { id: "soy-garlic", label: "Soy garlic", priceDelta: 0 },
          { id: "nuoc-mam-spicy", label: "Spicy fish sauce", priceDelta: 3000 },
        ],
      },
    ],
    preparation: { prepMinutes: 5, cookMinutes: 18 },
  },
  {
    _id: "dish-03",
    restaurantId: "res-01",
    title: "Saigon Iced Coffee",
    description: "Robusta beans brewed strong with condensed milk over ice.",
    category: "Drinks",
    type: "Coffee",
    spiceLevel: 0,
    sizes: ["Regular", "Large"],
    price: {
      Regular: 32000,
      Large: 38000,
    },
    images: [dishE, dishF],
    tags: ["Popular", "Caffeine boost"],
    rating: 4.5,
    reviewCount: 96,
    toppings: [
      { id: "top-06", label: "Extra condensed milk", value: "extra-milk", priceDelta: 4000 },
      { id: "top-07", label: "Coconut cream", value: "coconut-cream", priceDelta: 6000 },
    ],
    options: [
      {
        id: "opt-03",
        label: "Sugar level",
        values: [
          { id: "less-sugar", label: "25% sugar", priceDelta: 0 },
          { id: "normal-sugar", label: "50% sugar", priceDelta: 0 },
          { id: "full-sugar", label: "100% sugar", priceDelta: 0 },
        ],
      },
    ],
    preparation: { prepMinutes: 2, cookMinutes: 0 },
  },
  {
    _id: "dish-04",
    restaurantId: "res-02",
    title: "Bun Bo Hue Premium",
    description: "Spicy lemongrass beef noodle soup with pork knuckle and crab patty.",
    category: "Noodles",
    type: "Soup",
    spiceLevel: 4,
    sizes: ["Regular", "Large"],
    price: {
      Regular: 72000,
      Large: 84000,
    },
    images: [dishG, dishH],
    tags: ["Signature", "Spicy"],
    rating: 4.8,
    reviewCount: 210,
    toppings: [
      { id: "top-08", label: "Extra crab cake", value: "extra-crab", priceDelta: 20000 },
      { id: "top-09", label: "More chili oil", value: "more-chili", priceDelta: 3000 },
    ],
    options: [
      {
        id: "opt-04",
        label: "Spice level",
        values: [
          { id: "mild", label: "Mild", priceDelta: 0 },
          { id: "medium", label: "Medium", priceDelta: 0 },
          { id: "extra-hot", label: "Extra hot", priceDelta: 0 },
        ],
      },
    ],
    preparation: { prepMinutes: 8, cookMinutes: 30 },
  },
  {
    _id: "dish-05",
    restaurantId: "res-02",
    title: "Hue Steamed Rice Cake Set",
    description: "Six bite-sized rice cakes topped with roasted shrimp and scallion oil.",
    category: "Rice",
    type: "Snack",
    spiceLevel: 1,
    sizes: ["Six pieces", "Twelve pieces"],
    price: {
      "Six pieces": 45000,
      "Twelve pieces": 78000,
    },
    images: [dishI, dishA],
    tags: ["Light snack"],
    rating: 4.4,
    reviewCount: 87,
    toppings: [
      { id: "top-10", label: "Extra scallion oil", value: "extra-scallion", priceDelta: 4000 },
    ],
    options: [
      {
        id: "opt-05",
        label: "Dipping sauce",
        values: [
          { id: "sweet-fish", label: "Sweet fish sauce", priceDelta: 0 },
          { id: "garlic-fish", label: "Garlic fish sauce", priceDelta: 0 },
        ],
      },
    ],
    preparation: { prepMinutes: 5, cookMinutes: 12 },
  },
  {
    _id: "dish-06",
    restaurantId: "res-02",
    title: "Pandan Coconut Pudding",
    description: "Layered dessert with pandan jelly, coconut cream, and roasted peanuts.",
    category: "Dessert",
    type: "Sweet",
    spiceLevel: 0,
    sizes: ["Cup"],
    price: {
      Cup: 38000,
    },
    images: [dishB, dishC],
    tags: ["Vegan friendly"],
    rating: 4.3,
    reviewCount: 65,
    toppings: [
      { id: "top-11", label: "Extra peanuts", value: "extra-peanut", priceDelta: 3000 },
      { id: "top-12", label: "Grass jelly", value: "grass-jelly", priceDelta: 4000 },
    ],
    options: [
      {
        id: "opt-06",
        label: "Sweetness",
        values: [
          { id: "sweet-25", label: "25%", priceDelta: 0 },
          { id: "sweet-50", label: "50%", priceDelta: 0 },
          { id: "sweet-75", label: "75%", priceDelta: 0 },
        ],
      },
    ],
    preparation: { prepMinutes: 3, cookMinutes: 0 },
  },
  {
    _id: "dish-07",
    restaurantId: "res-03",
    title: "Tofu Lemongrass Skewers",
    description: "Grilled tofu marinated with lemongrass, served with green rice flakes.",
    category: "Salad",
    type: "Grill",
    spiceLevel: 1,
    sizes: ["Two skewers", "Four skewers"],
    price: {
      "Two skewers": 52000,
      "Four skewers": 89000,
    },
    images: [dishD, dishE],
    tags: ["Plant based", "High protein"],
    rating: 4.7,
    reviewCount: 155,
    toppings: [
      { id: "top-13", label: "Peanut crunch", value: "peanut-crunch", priceDelta: 5000 },
      { id: "top-14", label: "Chili flakes", value: "chili-flakes", priceDelta: 0 },
    ],
    options: [
      {
        id: "opt-07",
        label: "Side salad",
        values: [
          { id: "papaya-salad", label: "Papaya salad", priceDelta: 6000 },
          { id: "cucumber-salad", label: "Cucumber salad", priceDelta: 4000 },
        ],
      },
    ],
    preparation: { prepMinutes: 6, cookMinutes: 15 },
  },
  {
    _id: "dish-08",
    restaurantId: "res-03",
    title: "Vegan Hotpot Set",
    description: "Clear mushroom broth with seasonal vegetables and handmade tofu rolls.",
    category: "Hotpot",
    type: "Share platter",
    spiceLevel: 2,
    sizes: ["For 2", "For 4"],
    price: {
      "For 2": 220000,
      "For 4": 390000,
    },
    images: [dishF, dishG],
    tags: ["Sharing", "Restaurant special"],
    rating: 4.9,
    reviewCount: 266,
    toppings: [
      { id: "top-15", label: "Extra tofu rolls", value: "extra-tofu", priceDelta: 25000 },
      { id: "top-16", label: "Pumpkin cubes", value: "pumpkin-cubes", priceDelta: 18000 },
    ],
    options: [
      {
        id: "opt-08",
        label: "Broth flavor",
        values: [
          { id: "original", label: "Original", priceDelta: 0 },
          { id: "herbal", label: "Herbal", priceDelta: 12000 },
          { id: "spicy", label: "Spicy", priceDelta: 15000 },
        ],
      },
    ],
    preparation: { prepMinutes: 15, cookMinutes: 20 },
  },
  {
    _id: "dish-09",
    restaurantId: "res-03",
    title: "Coconut Chia Pudding",
    description: "Chia seeds soaked in coconut milk with mango, dragon fruit, and granola.",
    category: "Dessert",
    type: "Sweet",
    spiceLevel: 0,
    sizes: ["Cup"],
    price: {
      Cup: 42000,
    },
    images: [dishH, dishI],
    tags: ["Gluten friendly", "No added sugar"],
    rating: 4.6,
    reviewCount: 112,
    toppings: [
      { id: "top-17", label: "Extra granola", value: "extra-granola", priceDelta: 5000 },
      { id: "top-18", label: "Cacao nibs", value: "cacao-nibs", priceDelta: 7000 },
    ],
    options: [
      {
        id: "opt-09",
        label: "Fruit topping",
        values: [
          { id: "mango", label: "Mango", priceDelta: 0 },
          { id: "berry", label: "Berry mix", priceDelta: 6000 },
        ],
      },
    ],
    preparation: { prepMinutes: 4, cookMinutes: 0 },
  },
];

export const customerAddresses = [
  {
    id: "addr-home",
    label: "Home",
    recipient: "Tran Minh Anh",
    phone: "0909 111 222",
    street: "24 Nguyen Dinh Chieu",
    ward: "Ward 6",
    district: "District 3",
    city: "Ho Chi Minh City",
    instructions: "Call before arrival, small blue gate.",
    isDefault: true,
  },
  {
    id: "addr-office",
    label: "Office",
    recipient: "Tran Minh Anh",
    phone: "0909 111 222",
    street: "12th floor, 18 Nguyen Thi Minh Khai",
    ward: "Ben Nghe",
    district: "District 1",
    city: "Ho Chi Minh City",
    instructions: "Leave at reception if after 7pm.",
    isDefault: false,
  },
];

export const currentOrders = [
  {
    id: "order-34121",
    restaurantId: "res-01",
    status: "Delivering",
    etaMinutes: 15,
    placedAt: "2025-10-16T18:05:00+07:00",
    deliveryAddressId: "addr-home",
    courier: {
      name: "Pham Van Binh",
      phone: "0912 345 678",
      vehicle: "Yamaha Sirius - 59A1-123.45",
    },
    timeline: [
      { id: "stage-1", label: "Order confirmed", timestamp: "18:05", completed: true },
      { id: "stage-2", label: "Cooking", timestamp: "18:07", completed: true },
      { id: "stage-3", label: "Picked up", timestamp: "18:18", completed: true },
      { id: "stage-4", label: "Out for delivery", timestamp: "18:20", completed: true },
      { id: "stage-5", label: "Delivered", timestamp: null, completed: false },
    ],
    items: [
      {
        dishId: "dish-01",
        size: "Large",
        quantity: 1,
        additions: ["extra-beef", "fresh herbs"],
        price: 93000,
      },
      {
        dishId: "dish-03",
        size: "Regular",
        quantity: 2,
        additions: ["extra-milk"],
        price: 64000,
      },
    ],
    subtotal: 157000,
    shippingFee: 15000,
    discount: 10000,
  },
];

export const orderHistory = [
  {
    id: "order-33888",
    restaurantId: "res-02",
    placedAt: "2025-10-12T11:30:00+07:00",
    deliveredAt: "2025-10-12T12:10:00+07:00",
    status: "Delivered",
    paymentMethod: "Wallet",
    totalAmount: 231000,
    items: [
      { dishId: "dish-04", size: "Regular", quantity: 1, price: 72000 },
      { dishId: "dish-05", size: "Twelve pieces", quantity: 1, price: 78000 },
      { dishId: "dish-06", size: "Cup", quantity: 2, price: 76000 },
    ],
    canReview: true,
  },
  {
    id: "order-33711",
    restaurantId: "res-03",
    placedAt: "2025-10-05T19:15:00+07:00",
    deliveredAt: "2025-10-05T19:55:00+07:00",
    status: "Delivered",
    paymentMethod: "COD",
    totalAmount: 268000,
    items: [
      { dishId: "dish-08", size: "For 2", quantity: 1, price: 220000 },
      { dishId: "dish-09", size: "Cup", quantity: 2, price: 48000 },
    ],
    canReview: false,
  },
];

export const restaurantReviews = [
  {
    id: "review-001",
    restaurantId: "res-01",
    orderId: "order-33790",
    customerName: "Tran Minh Anh",
    customerPhone: "+84 909 111 222",
    avatar: userAvatar1,
    rating: 4.8,
    comment:
      "The broth is rich and true to Saigon pho. Delivery was fast and the food arrived hot.",
    photos: [dishA],
    dishes: [
      { dishId: "dish-01", title: "Pho Bo Slow Simmered", image: dishA },
      { dishId: "dish-02", title: "Grilled Pork Banh Mi", image: dishB },
    ],
    createdAt: "2025-10-11T21:15:00+07:00",
  },
  {
    id: "review-002",
    restaurantId: "res-02",
    orderId: "order-33888",
    customerName: "Nguyen Quoc Huy",
    customerPhone: "+84 938 555 123",
    avatar: userAvatar2,
    rating: 4.6,
    comment:
      "Hue beef noodle soup tastes authentic with fragrant lemongrass broth. A bit pricey but worth it.",
    photos: [dishC],
    dishes: [
      { dishId: "dish-04", title: "Hue Spicy Beef Noodle", image: dishC },
      { dishId: "dish-05", title: "Lemongrass Chicken", image: dishD },
    ],
    createdAt: "2025-10-12T12:45:00+07:00",
  },
  {
    id: "review-003",
    restaurantId: "res-03",
    orderId: "order-33711",
    customerName: "Pham Bao Tran",
    customerPhone: "+84 902 777 456",
    avatar: userAvatar3,
    rating: 5,
    comment:
      "The plant-based dishes are refined; I especially love the mushroom hotpot and flavorful dipping sauce.",
    photos: [dishE],
    dishes: [
      { dishId: "dish-07", title: "Crispy Mushroom Rolls", image: dishE },
      { dishId: "dish-08", title: "Vegan Hotpot", image: dishF },
    ],
    createdAt: "2025-10-06T08:30:00+07:00",
  },
  {
    id: "review-004",
    restaurantId: "res-03",
    orderId: "order-33670",
    customerName: "Doan Hai Nam",
    customerPhone: "+84 903 112 999",
    avatar: userAvatar4,
    rating: 4.7,
    comment:
      "Beautiful presentation, light flavors, and healthy options. I'll keep ordering here.",
    photos: [dishG],
    dishes: [
      { dishId: "dish-09", title: "Lotus Stem Salad", image: dishG },
      { dishId: "dish-10", title: "Green Curry Tofu", image: dishH },
    ],
    createdAt: "2025-10-03T19:40:00+07:00",
  },
];

export const notificationFeed = [
  {
    id: "noti-01",
    type: "promotion",
    title: "20% off vegan hotpot today only!",
    message: "Use code CHAY20 before 9pm to unlock the offer from Chay Garden.",
    createdAt: "2025-10-16T09:05:00+07:00",
    read: false,
    restaurantId: "res-03",
  },
  {
    id: "noti-02",
    type: "order",
    title: "Order #34121 is out for delivery",
    message: "Pham Van Binh is on the way with your dinner.",
    createdAt: "2025-10-16T18:20:00+07:00",
    read: false,
    orderId: "order-34121",
  },
  {
    id: "noti-03",
    type: "system",
    title: "New wallet feature",
    message: "Top up your FoodFast wallet and get instant cashback on every order.",
    createdAt: "2025-10-14T07:45:00+07:00",
    read: true,
  },
];

export const promotionSlides = [
    {
      id: "banner-01",
      headline: "Late-night cravings?",
      body: "Free delivery after 9 PM for every order this weekend.",
      actionLabel: "Browse restaurants",
      actionHref: "/restaurants",
    },
    {
      id: "banner-02",
      headline: "Wholesome lunch combos",
      body: "Stay energized with meals under 500 calories, delivered in 20 minutes.",
      actionLabel: "Choose a combo",
      actionHref: "/restaurants/res-03",
    },
    {
      id: "banner-03",
      headline: "Double loyalty points",
      body: "Complete two orders this week to earn double FoodFast points.",
      actionLabel: "See details",
      actionHref: "/rewards",
    },
  ];
  
  export const paymentOptions = [
    { id: "cod", label: "Cash on delivery", description: "Pay cash directly to the driver." },
    { id: "wallet", label: "FoodFast wallet", description: "Pay instantly using your FoodFast wallet balance." },
    { id: "card", label: "Debit/Credit card", description: "Save your card for quick, secure payments." },
  ];
