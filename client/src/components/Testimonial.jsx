import React from 'react'
import Title from './Title'
import { assets } from '../assets/data'

const Testimonial = () => {
    return (
        <div>
            <section className='max-padd-container py-22 xl:py-28'>
                <Title title1={"What "} title2={"People Says"} titleStyles={"pb-10"} />
                {/* CONTAINER */}
                <div className="flex gap-8 items-stretch justify-between">
                    <div className="text-sm max-w-[411px] pb-6 rounded-lg bg-[#edbdcd] overflow-hidden">
                        <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-900/10">
                            <img className="h-12 w-12 rounded-full" src={assets.user1} alt="userImage1" />
                            <div>
                                <h4>Donald Jackman</h4>
                                <p>Content Creator</p>
                            </div>
                        </div>
                        <div className="p-5 pb-7">
                            <div className="flex gap-0.5">
                                <img src={assets.starBlack} alt="" width={16}/>
                                <img src={assets.starBlack} alt="" width={16}/>
                                <img src={assets.starBlack} alt="" width={16}/>
                                <img src={assets.starBlack} alt="" width={16}/>
                                <img src={assets.starBlack} alt="" width={16}/>
                            </div>
                            <p className="text-gray-500 mt-5">I've been using imagify for nearly two years, primarily for Instagram, and it has been incredibly user-friendly, making my work much easier.</p>
                        </div>
                        <a href="#" className="text-black underline px-5">Read more</a>
                    </div>

                    <div className="text-sm max-w-[411px] pb-6 rounded-lg bg-[#cebfab] overflow-hidden">
                        <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-900/10">
                            <img className="h-12 w-12 rounded-full" src={assets.user2} alt="userImage2" />
                            <div>
                                <h4>Richard Nelson</h4>
                                <p>Instagram Influencer</p>
                            </div>
                        </div>
                        <div className="p-5 pb-7">
                            <div className="flex gap-0.5">
                                <img src={assets.starBlack} alt="" width={16}/>
                                <img src={assets.starBlack} alt="" width={16}/>
                                <img src={assets.starBlack} alt="" width={16}/>
                                <img src={assets.starBlack} alt="" width={16}/>
                                <img src={assets.starBlack} alt="" width={16}/>
                            </div>
                            <p className="text-gray-500 mt-5">I've been using imagify for nearly two years, primarily for Instagram, and it has been incredibly user-friendly, making my work much easier.</p>
                        </div>
                        <a href="#" className="text-black underline px-5">Read more</a>
                    </div>

                    <div className="text-sm max-w-[411px] pb-6 rounded-lg bg-[#aed6ff] overflow-hidden">
                        <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-900/10">
                            <img className="h-12 w-12 rounded-full" src={assets.user3} alt="userImage3" />
                            <div>
                                <h4>James Washington</h4>
                                <p>Digital Content Creator</p>
                            </div>
                        </div>
                        <div className="p-5 pb-7">
                            <div className="flex gap-0.5">
                                <img src={assets.starBlack} alt="" width={16}/>
                                <img src={assets.starBlack} alt="" width={16}/>
                                <img src={assets.starBlack} alt="" width={16}/>
                                <img src={assets.starBlack} alt="" width={16}/>
                                <img src={assets.starBlack} alt="" width={16}/>
                            </div>
                            <p className="text-gray-500 mt-5">I've been using imagify for nearly two years, primarily for Instagram, and it has been incredibly user-friendly, making my work much easier.</p>
                        </div>
                        <a href="#" className="text-black underline px-5">Read more</a>
                    </div>
                </div>
            </section>
        </div>
    )
}

export default Testimonial
