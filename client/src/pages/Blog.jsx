import React from 'react'
import Footer from '../components/Footer'
import { assets, blogs } from '../assets/data'

const Blog = () => {
  return (
    <div className='py-28'>
      <div className='max-padd-container'>
        {/* CONTAINER */}
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 gap-y-12'>
          {blogs.map((blog, index) => (
            <article className="flex bg-white transition hover:shadow-xl">
              <div className="rotate-180 p-2 [writing-mode:_vertical-lr]">
                <time
                  datetime="2022-10-10"
                  className="flex items-center justify-between gap-4 text-xs font-bold text-gray-900 uppercase"
                >
                  <span>{blog.category}</span>
                  <span className="w-px flex-1 bg-gray-900/10"></span>
                  <span>{new Date().toLocaleDateString()}</span>
                </time>
              </div>

              <div className="hidden sm:block sm:basis-56">
                <img
                  alt=""
                  src={blog.image}
                  className="aspect-square h-75 w-full object-cover"
                />
              </div>

              <div className="flex flex-1 flex-col justify-between">
                <div className="border-s border-gray-900/10 p-4 sm:border-l-transparent sm:p-6">
                  <a href="#">
                    <h5 className="font-bold text-gray-900 uppercase">
                      {blog.title}
                    </h5>
                  </a>

                  <p className="mt-2 line-clamp-3 text-sm/relaxed text-gray-700">
                    {blog.description}
                  </p>
                </div>

                <div className="sm:flex sm:items-end sm:justify-end">
                  <button
                    className="btn-solid rounded-none"
                  >
                    Read Blog
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Blog
