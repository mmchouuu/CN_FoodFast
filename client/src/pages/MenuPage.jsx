import React from "react";
import { useParams, Link } from "react-router-dom";

// Import ảnh từ thư mục assets
import product1 from "../assets/product_1.png";
import product2 from "../assets/product_2.png";
import product3 from "../assets/product_3.png";
import product4 from "../assets/product_4.png";

const menuItems = [
  { id: 1, name: "Grilled Chicken", price: "$10", image: product1 },
  { id: 2, name: "Spaghetti", price: "$12", image: product2 },
  { id: 3, name: "Pizza Margherita", price: "$9", image: product3 },
  { id: 4, name: "Mango Smoothie", price: "$5", image: product4 },
];

export default function MenuPage() {
  const { restaurantId } = useParams();

  return (
    <div className="p-6">
      <Link
        to="/"
        className="text-orange-500 hover:underline mb-4 inline-block"
      >
        ← Back to Home
      </Link>

      <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">
        Menu for Restaurant #{restaurantId}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
        {menuItems.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-all"
          >
            <img
              src={item.image}
              alt={item.name}
              className="w-full h-48 object-cover"
            />
            <div className="p-4 text-center">
              <h3 className="text-lg font-semibold text-gray-800">
                {item.name}
              </h3>
              <p className="text-gray-600 mt-2">{item.price}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
