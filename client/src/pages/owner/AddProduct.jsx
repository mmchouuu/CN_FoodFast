import React, { useState } from 'react'
import { useAppContext } from '../../context/AppContext'
import { assets } from '../../assets/data'

const AddProduct = () => {
  const [images, setImages] = useState({
    1: null,
    2: null,
    3: null,
    4: null,
  })

  const [inputs, setInputs] = useState({
    title: "",
    description: "",
    category: "",
    type: "",
    popular: false,
  })

  const [sizePrices, setSizePrices] = useState([])
  const [newSize, setNewSize] = useState("")
  const [newPrice, setNewPrice] = useState("")
  const [loading, setLoading] = useState(false)

const allCategories = [
  "Burger",
  "Hotdog",
  "Sandwich",
  "Tacos",
  "Drinks",
]

  return (
    <div className="md:px-8 py-6 xl:py-8 m-1.5 sm:m-3 h-[97vh] overflow-y-scroll w-full
    bg-white shadow-sm rounded-2xl p-6 space-y-6">
      <form className="flex flex-col gap-y-3.5 px-2 text-sm w-full lg:w-11/12">
        <div className="w-full">
          <h5>Product Name</h5>
          <input onChange={(e)=> setInputs({...inputs, title: e.target.value})} value={inputs.title} type="text" placeholder="Type here..." 
          className="px-3 py-1.5 ring-1 ring-slate-900/10 rounded-lg bg-white
          text-gray-600 text-sm font-medium mt-1 w-full" />
        </div>
        <div className="w-full">
          <h5>Product Description</h5>
          <textarea onChange={(e)=> setInputs({...inputs, description: e.target.value})} value={inputs.description} type="text" rows={5} 
          placeholder="Type here..." 
          className="px-3 py-1.5 ring-1 ring-slate-900/10 rounded-lg bg-white
          text-gray-600 text-sm font-medium mt-1 w-full" />
        </div>
        {/* Categories & Types */}
        <div className="flex gap-4 flex-wrap">
          <div>
            <h5>Category</h5>
            <select onChange={(e)=> setInputs({...inputs, category: e.target.value})} value={inputs.category} 
            className="px-3 py-1.5 ring-1 ring-slate-900/10 rounded-lg bg-white
          text-gray-600 text-sm font-medium mt-1 w-38">
              <option value="">Select Category</option>
                {allCategories.map((cat, index)=>(
                  <option key={index} value={cat}>{cat}</option>
                ))}           
            </select>
          </div>
          <div>
            <h5>Types</h5>
            <select onChange={(e)=> setInputs({...inputs, type: e.target.value})} value={inputs.type} 
            className="px-3 py-1.5 ring-1 ring-slate-900/10 rounded-lg bg-white
          text-gray-600 text-sm font-medium mt-1 w-36">
              <option value="">Select Type</option>
                {allCategories.map((t, index)=>(
              <option key={index} value={t}>{t}</option>
                ))}   
            </select>
          </div>
        </div>
        {/* Size and Price Pairs */}
        <div className="w-full mt-4">
          <h5>Size and Prices</h5>
          <div className="flex gap-4 mt-2">
            <input value={newSize} type="text" placeholder="Size (S,M)" className="px-3 py-1.5 ring-1 ring-slate-900/10 rounded-lg bg-white
          text-gray-600 text-sm font-medium mt-1 w-32" />
            <input value={newPrice} type="number" placeholder="Price" 
            className="px-3 py-1.5 ring-1 ring-slate-900/10 rounded-lg bg-white
          text-gray-600 text-sm font-medium mt-1 w-32" />
            <button type="button" className="btn-solid font-semibold p-1.5 rounded-lg">
            Add</button>
          </div>
          <div className="mt-2">
            {sizePrices.map((sp, index)=>(
              <div key={index}>
                <span>{sp.size}: ${sp.price}</span>
                <button type="button" className="text-red-500">Remove</button>
              </div>
            ))}
          </div>
        </div>
        {/* Images */}
        <div className="flex gap-2 mt-2">
        {Object.keys(images).map((key) => (
          <label key={key} htmlFor={`productImage${key}`} className="ring-1 ring-slate-900/10 overflow-hidden rounded-lg">
            <input type="file" onChange={(e) => setImages({ ...images, [key]: e.target.files[0]})} accept="image/*" id={`productImage${key}`} 
            hidden className="" />
            <div className="h-16 w-22 bg-white flexCenter">
              <img src={images[key] ? URL.createObjectURL(images[key]) : assets.uploadIcon} alt="" className="w-17 overflow-hidden 
              object-contain" />
            </div>
          </label>
        ))}
        </div>
        <div className="flex gap-2 mt-3">
        <h5>Add to Popular</h5>
        <input type="checkbox" checked={inputs.popular} onChange={(e)=>
          setImages({...inputs, popular: e.target.checked})} /> 
        </div>
        <button type="submit" disabled={loading} className="btn-solid font-semibold mt-3
        p-2 max-w-36 sm:w-full rounded-xl" >
          {loading ? "Adding" : "Add Product"}
        </button>
      </form>
    </div>
  )
}

export default AddProduct






