// import { dummyProducts } from '../assets/data';
// import { useNavigate } from 'react-router-dom';
// import React, { createContext, useState, useEffect, useContext } from 'react'
// import toast from 'react-hot-toast';
// import { useUser } from "@clerk/clerk-react";


// const AppContext = createContext()

// export const AppContextProvider = ({ children }) => {
//     const [products, setProducts] = useState([]);
//     const [method, setMethod] = useState("COD")
//     const [isOwner, setIsOwner] = useState(true) // Temporary
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
//         setMethod,
//         isOwner,
//         setIsOwner,
//     };

//     return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
// };

// export const useAppContext = ()=> useContext(AppContext)


// import { dummyProducts } from '../assets/data';
// import { useNavigate } from 'react-router-dom';
// import React, { createContext, useState, useEffect, useContext } from 'react';
// import toast from 'react-hot-toast';
// import { useAuth0 } from '@auth0/auth0-react';

// const AppContext = createContext();

// export const AppContextProvider = ({ children }) => {
//     const [products, setProducts] = useState([]);
//     const [method, setMethod] = useState("COD");
//     const [isOwner, setIsOwner] = useState(true); // Temporary
//     const [searchQuery, setSearchQuery] = useState("");
//     const [cartItems, setCartItems] = useState({});
//     const currency = import.meta.env.VITE_CURRENCY;
//     const delivery_charges = 10; // 10 dollars
//     const navigate = useNavigate();

//     // Auth0
//     const { user: authUser, isAuthenticated, loginWithRedirect, logout } = useAuth0();
//     const [user, setUser] = useState({
//         email: '',
//         firstName: '',
//         lastName: '',
//         phone: '',
//         street: '',
//         ward: '',
//         district: '',
//         city: '',
//         payment: '',
//     });

//     useEffect(() => {
//         if (isAuthenticated && authUser) {
//             setUser(prev => ({
//                 ...prev,
//                 email: authUser.email || '',
//                 firstName: authUser.given_name || '',
//                 lastName: authUser.family_name || '',
//                 phone: authUser.phone_number || '',
//             }));
//         }
//     }, [authUser, isAuthenticated]);

//     const fetchProducts = () => {
//         setProducts(dummyProducts);
//     };

//     // Add Product to Cart
//     const addToCart = (itemId, size) => {
//         if (!size) return toast.error("Please select a size first");
//         let cartData = structuredClone(cartItems);
//         cartData[itemId] = cartData[itemId] || {};
//         cartData[itemId][size] = (cartData[itemId][size] || 0) + 1;
//         setCartItems(cartData);
//     };

//     // Get Cart Count
//     const getCartCount = () => {
//         let count = 0;
//         for (const itemId in cartItems) {
//             for (const size in cartItems[itemId]) {
//                 count += cartItems[itemId][size];
//             }
//         }
//         return count;
//     };

//     // Update Cart Quantity
//     const updateQuantity = (itemId, size, quantity) => {
//         let cartData = structuredClone(cartItems);
//         cartData[itemId][size] = quantity;
//         setCartItems(cartData);
//     };

//     // Get Cart Amount
//     const getCartAmount = () => {
//         let total = 0;
//         for (const itemId in cartItems) {
//             const product = products.find((p) => p._id === itemId);
//             if (!product) continue;
//             for (const size in cartItems[itemId]) {
//                 total += product.price[size] * cartItems[itemId][size];
//             }
//         }
//         return total;
//     };

//     useEffect(() => {
//         fetchProducts();
//     }, []);

//     const value = {
//         user,
//         setUser,
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
//         setMethod,
//         isOwner,
//         setIsOwner,
//         isAuthenticated,
//         loginWithRedirect,
//         logout
//     };

//     return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
// };

// export const useAppContext = () => useContext(AppContext);


// src/context/AppContext.jsx
import { dummyProducts } from '../assets/data';
import { useNavigate } from 'react-router-dom';
import React, { createContext, useState, useEffect, useContext } from 'react'
import toast from 'react-hot-toast';

// --- Auth Systems ---
import { useAuth0 } from '@auth0/auth0-react';
import { useUser as useClerkUser } from "@clerk/clerk-react";

const AppContext = createContext()

export const AppContextProvider = ({ children }) => {
    const navigate = useNavigate();

    // --- States ---
    const [products, setProducts] = useState([]);
    const [method, setMethod] = useState("COD");
    const [isOwner, setIsOwner] = useState(true);  // Owner mode
    const [searchQuery, setSearchQuery] = useState("");
    const [cartItems, setCartItems] = useState({});
    const currency = import.meta.env.VITE_CURRENCY;
    const delivery_charges = 10;

    // --- Auth0 ---
    const { user: auth0User, isAuthenticated: isAuth0, loginWithRedirect, logout: logoutAuth0 } = useAuth0();

    // --- Clerk ---
    const { user: clerkUser } = useClerkUser();
    const isClerkAuthenticated = Boolean(clerkUser);

    // --- Unified user object ---
    const user = auth0User || clerkUser || null;

    // --- Fetch Dummy Products ---
    useEffect(() => {
        setProducts(dummyProducts);
    }, []);

    // --- Cart Functions ---
    const addToCart = (itemId, size) => {
        if (!size) return toast.error("Please select a size first");
        setCartItems(prev => {
            const updated = structuredClone(prev);
            updated[itemId] = updated[itemId] || {};
            updated[itemId][size] = (updated[itemId][size] || 0) + 1;
            return updated;
        });
    };

    const getCartCount = () => {
        return Object.values(cartItems).reduce((count, sizes) =>
            count + Object.values(sizes).reduce((sum, qty) => sum + qty, 0), 0);
    };

    const updateQuantity = (itemId, size, quantity) => {
        setCartItems(prev => {
            const updated = structuredClone(prev);
            updated[itemId][size] = quantity;
            return updated;
        });
    };

    const getCartAmount = () => {
        let total = 0;
        for (const itemId in cartItems) {
            const product = products.find(p => p._id === itemId);
            if (!product) continue;
            for (const size in cartItems[itemId]) {
                total += product.price[size] * cartItems[itemId][size];
            }
        }
        return total;
    };

    // --- Exposed Values ---
    const value = {
        user,
        products,
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

        // Auth Actions
        isAuthenticated: Boolean(user),
        loginWithRedirect,      // For Auth0
        logoutAuth0
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => useContext(AppContext);
