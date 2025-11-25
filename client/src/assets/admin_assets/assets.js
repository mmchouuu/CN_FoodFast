import logo from './logo.png'
import add_icon from './add_icon.png'
import order_icon from './order_icon.png'
import profile_image from './profile_image.png'
import upload_area from './upload_area.png'
import parcel_icon from './parcel_icon.png'

export const assets ={
    logo,
    add_icon,
    order_icon,
    profile_image,
    upload_area,
    parcel_icon
}

const SOCKET_BASE_URL =
  (import.meta.env && import.meta.env.VITE_SOCKET_GATEWAY_URL) ||
  'https://26.62.36.103:4000'

export const url = SOCKET_BASE_URL
