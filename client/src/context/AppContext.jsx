import { dummyProducts } from '../assets/data';
import { useNavigate } from 'react-router-dom';
import React, { createContext, useState, useEffect, useContext } from 'react'



const AppContext = createContext()

export const AppContextProvider = ({ children }) => {
    const [products, setProducts] = useState([]);
    const currency = import.meta.env.VITE_CURRENCY
    const delivery_charges = 10 // 10 dollors
    const navigate = useNavigate()

    const fetchProducts = () => {
        setProducts(dummyProducts);
    };

    useEffect(() => {
        fetchProducts()
    }, [])

    const value = {
        products,
        fetchProducts,
        currency,
        navigate,
        delivery_charges
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = ()=> useContext(AppContext)
