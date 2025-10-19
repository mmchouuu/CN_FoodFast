// import React, { useState } from 'react'
// import { useAppContext } from '../../context/AppContext'
// import { assets } from '../../assets/data'

// const ListProduct = () => {
//   const {products, currency, fetchProducts} = useAppContext()

//   return (
//     <div className="md:px-8 py-6 xl:py-8 m-1 sm:m-3 h-[97vh] overflow-y-scroll lg:w-11/12
//     bg-primary shadow rounded-xl">
//       <div className="flex flex-col gap-2 lg:w-11/12">
//         <div className="grid grid-cols-[1.5fr_3.5fr_2fr_1.5fr_1fr] items-center py-4 px-2
//         bg-solid text-white bold-14 sm:bold-15 mb-1 rounded-xl">
//           <h5>Image</h5>
//           <h5>Title</h5>
//           <h5>Category</h5>
//           <h5>Price</h5>
//           <h5>InStock</h5>
//         </div>
//         {/* Product List */}
//         {products.map((product)=>(
//           <div key={product._id} className="grid grid-cols-[1fr_3.5fr_1.5fr_1.5fr_1fr]
//           items-center gap-2 p-2 bg-white rounded-lg">
//             <img src={product.images[0]} alt="" className="w-12 bg-primary rounded" />
//             <h5 className="text-sm font-semibold line-clamp-2">{product.title}</h5>
//             <p className="text-sm font-semibold">{product.category}</p>
//             <div className="text-sm font-semibold">From {currency}{product.price[product.sizes[0]]}</div>
//             <div>
//               <label className="relative inline-flex items-center cursor-pointer
//               text-gray-900 gap-3">
//                 <input type="checkbox" className="sr-only peer" defaultChecked={product.inStock} />
//                 <div className="w-10 h-6 bg-slate-300 rounded-full peer peer-checked:bg-solid transition-colors duration-200" />
//                 <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-in-out peer-checked:translate-x-4" />
//               </label>
//             </div>
//           </div>
//         ))}
//       </div>
//     </div>
//   )
// }

// export default ListProduct


import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';

const CategoryManager = ({ categories, setCategories }) => {
  const [newCat, setNewCat] = useState('');
  const [editCat, setEditCat] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);

  const handleAdd = () => {
    const cat = newCat.trim();
    if (!cat || categories.includes(cat)) return;
    setCategories([...categories, cat]);
    setNewCat('');
  };

  const handleSave = () => {
    if (!editCat.trim()) return;
    const updated = [...categories];
    updated[editingIndex] = editCat.trim();
    setCategories(updated);
    setEditingIndex(null);
    setEditCat('');
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-gray-700">Categories</h3>
      <div className="flex gap-2">
        <input
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          placeholder="New category"
          className="border rounded px-2 py-1 flex-1 focus:outline-none"
        />
        <button
          onClick={handleAdd}
          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition"
        >
          Add
        </button>
      </div>

      <ul className="space-y-1">
        {categories.map((cat, idx) => (
          <li key={idx} className="flex items-center justify-between bg-gray-100 px-3 py-1 rounded">
            {editingIndex === idx ? (
              <>
                <input
                  value={editCat}
                  onChange={(e) => setEditCat(e.target.value)}
                  className="border px-2 py-1 flex-1 focus:outline-none"
                />
                <button
                  onClick={handleSave}
                  className="ml-2 px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                >
                  Save
                </button>
              </>
            ) : (
              <>
                <span>{cat}</span>
                <button
                  onClick={() => {
                    setEditingIndex(idx);
                    setEditCat(cat);
                  }}
                  className="ml-2 px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition"
                >
                  Edit
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

const ProductRow = ({ product, currency }) => (
  <div className="grid grid-cols-[1fr_3.5fr_1.5fr_1.5fr_1fr] items-center gap-2 p-2 bg-white rounded-lg hover:shadow-md transition">
    <img src={product.images[0]} alt="" className="w-12 h-12 rounded" />
    <h5 className="text-sm font-semibold line-clamp-2">{product.title}</h5>
    <p className="text-sm font-medium">{product.category}</p>
    <div className="text-sm font-semibold">
      From {currency}{product.price[product.sizes[0]]}
    </div>
    <label className="relative inline-flex items-center cursor-pointer text-gray-900 gap-3">
      <input type="checkbox" className="sr-only peer" defaultChecked={product.inStock} />
      <div className="w-10 h-6 bg-slate-300 rounded-full peer peer-checked:bg-solid transition-colors duration-200" />
      <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-in-out peer-checked:translate-x-4" />
    </label>
  </div>
);

const ListProduct = () => {
  const { products, currency } = useAppContext();
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    const uniqueCats = Array.from(new Set(products.map(p => p.category)));
    setCategories(uniqueCats);
  }, [products]);

  const filteredProducts = filter === 'All' ? products : products.filter(p => p.category === filter);

  return (
    <div className="md:px-8 py-6 xl:py-8 m-1 sm:m-3 h-[97vh] overflow-y-scroll lg:w-11/12 bg-primary shadow rounded-xl flex flex-col gap-6">

      {/* Category Manager */}
      <CategoryManager categories={categories} setCategories={setCategories} />

      {/* Filter */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-semibold text-gray-700">Filter:</label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded px-2 py-1 focus:outline-none"
        >
          <option value="All">All</option>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </div>

      {/* Product List Header */}
      <div className="grid grid-cols-[1.5fr_3.5fr_2fr_1.5fr_1fr] items-center py-4 px-2 bg-solid text-white bold-14 sm:bold-15 rounded-xl">
        <h5>Image</h5>
        <h5>Title</h5>
        <h5>Category</h5>
        <h5>Price</h5>
        <h5>InStock</h5>
      </div>

      {/* Product Rows */}
      <div className="flex flex-col gap-2">
        {filteredProducts.map(product => (
          <ProductRow key={product._id} product={product} currency={currency} />
        ))}
      </div>
    </div>
  );
};

export default ListProduct;






