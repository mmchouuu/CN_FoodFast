import React, { useState } from 'react';
import { assets } from '../assets/data'

const Item = ({product}) => {
    const [size, setSize] = useState(product.sizes[0]) // Default size (first in the array)
  
    return (
   <div className='relative mt-24 graoup'>
    {/* Photo */}
    <div >
        <img src={product.images} alt="" />
    </div>
   </div>
  )
}

export default Item
