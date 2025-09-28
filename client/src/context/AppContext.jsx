// import { dummyProducts } from '../assets/data';
// import { useNavigate } from 'react-router-dom';
// import React, { createContext, useState, useEffect, useContext } from 'react'
// import toast from 'react-hot-toast';
// import { useUser } from "@clerk/clerk-react";


// const AppContext = createContext()

// export const AppContextProvider = ({ children }) => {
//     const [products, setProducts] = useState([]);
//     const [method, setMethod] = useState("COD")
//     const [searchQuery, setSearchQuery] = useState("")
//     const [cartItems, setCartItems] = useState({})
//     const currency = import.meta.env.VITE_CURRENCY
//     const delivery_charges = 10 // 10 dollors
//     const navigate = useNavigate()
//     // Clerk
//     const {user} = useUser()


//     const fetchProducts = () => {
//         setProducts(dummyProducts);
//     };

//     // them
//     // Add Product to Cart
//     const addToCart = (itemId, size)=> {
//         if(!size) return toast.error("Please select a size first")
//         let cartData = structuredClone(cartItems)
//         cartData[itemId] = cartData[itemId] || {}
//         cartData[itemId][size] = (cartData[itemId][size] || 0) + 1
//         setCartItems(cartData)
//     }

//     // Get Cart Count
//     const getCartCount = ()=>{
//         let count = 0
//         for (const itemId in cartItems){
//             for (const size in cartItems[itemId]){
//                 count += cartItems[itemId][size]
//             }
//         }
//         return count
//     }

//     // Update Cart Quantity
//     const updateQuantity = (itemId, size, quantity)=>{
//         let cartData = structuredClone(cartItems)
//         cartData[itemId][size] = quantity
//         setCartItems(cartData)
//     }

//     // Get Cart Amount
//     const getCartAmount = ()=> {
//         let total = 0
//         for (const itemId in cartItems){
//             const product = products.find((p)=> p._id === itemId)
//             if(!product) continue
//             for(const size in cartItems[itemId]){
//                 total += product.price[size] * cartItems[itemId][size]
//             }
//         }
//         return total;
//     }

//     useEffect(() => {
//         fetchProducts()
//     }, [])

//     const value = {
//         user,
//         products,
//         fetchProducts,
//         currency,
//         navigate,
//         delivery_charges,
//         searchQuery,
//         setSearchQuery,
//         cartItems,
//         setCartItems,
//         addToCart,
//         getCartCount,
//         updateQuantity,
//         getCartAmount,
//         method,
//         setMethod
//     };

//     return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
// };

// export const useAppContext = ()=> useContext(AppContext)


import { dummyProducts } from '../assets/data';
import { useNavigate } from 'react-router-dom';
import React, { createContext, useState, useEffect, useContext } from 'react';
import toast from 'react-hot-toast';
import { useAuth0 } from '@auth0/auth0-react';

const AppContext = createContext();

export const AppContextProvider = ({ children }) => {
    const [products, setProducts] = useState([]);
    const [method, setMethod] = useState("COD");
    const [isOwner, setIsOwner] = useState(true); // Temporary
    const [searchQuery, setSearchQuery] = useState("");
    const [cartItems, setCartItems] = useState({});
    const currency = import.meta.env.VITE_CURRENCY;
    const delivery_charges = 10; // 10 dollars
    const navigate = useNavigate();


    const { user: authUser, isAuthenticated, loginWithRedirect, logout } = useAuth0();
    const [user, setUser] = useState({
        email: '',
        firstName: '',
        lastName: '',
        phone: '',
        street: '',
        ward: '',
        district: '',
        city: '',
        payment: '',
    });

    useEffect(() => {
        if (isAuthenticated && authUser) {
            setUser(prev => ({
                ...prev,
                email: authUser.email || '',
                firstName: authUser.given_name || '',
                lastName: authUser.family_name || '',
                phone: authUser.phone_number || '',
                cart: cartItems,
            }));
        }
    }, [authUser, isAuthenticated, cartItems]);

    const fetchProducts = () => setProducts(dummyProducts);

    const addToCart = (itemId, size) => {
        if (!size) return toast.error("Please select a size first");
        let cartData = structuredClone(cartItems);
        cartData[itemId] = cartData[itemId] || {};
        cartData[itemId][size] = (cartData[itemId][size] || 0) + 1;
        setCartItems(cartData);
    };

    const getCartCount = () => {
        let count = 0;
        for (const itemId in cartItems) {
            for (const size in cartItems[itemId]) {
                count += cartItems[itemId][size];
            }
        }
        return count;
    };

    const updateQuantity = (itemId, size, quantity) => {
        let cartData = structuredClone(cartItems);
        cartData[itemId][size] = quantity;
        setCartItems(cartData);
    };

    const getCartAmount = () => {
        let total = 0;
        for (const itemId in cartItems) {
            const product = products.find((p) => p._id === itemId);
            if (!product) continue;
            for (const size in cartItems[itemId]) {
                total += product.price[size] * cartItems[itemId][size];
            }
        }
        return total;
    };

    const value = {
        user,
        setUser,
        products,
        fetchProducts,
        currency,
        navigate,
        delivery_charges,
        searchQuery,
        setSearchQuery,
        cartItems,
        setCartItems,
        addToCart,
        getCartCount,
        updateQuantity,
        getCartAmount,
        method,
        setMethod,
        isOwner,
        setIsOwner,
        loginWithRedirect,
        logout,
        isAuthenticated
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;

};

export const useAppContext = () => useContext(AppContext);
