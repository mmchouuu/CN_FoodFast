import React from 'react'
import { NavLink } from 'react-router-dom'

const Navbar = ({containerStyles, setMenuOpened}) => {
  const navLinks = [
    { path: '/', title: 'Home'},
    { path: '/menu', title: 'Menu'},
    { path: '/blog', title: 'Blog'},
    { path: '/contact', title: 'Contact'}
  ]
  return (
    <nav className={containerStyles}>
      {navLinks.map((link)=> (
        <NavLink 
          onClick={() => setMenuOpened(false)} 
          key={link.title} 
          to={link.path}
          className={({ isActive }) => `${isActive ? "active-link" : ""} px-3 py-2 rounded-full uppercase text-sm font-bold`}
        >
          {link.title}
        </NavLink>

      ))}
    </nav>
  )
}

export default Navbar
