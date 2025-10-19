import React from "react";
import { assets } from "../../assets/data";

const containerClasses = "bg-white shadow-sm rounded-2xl p-6 space-y-6";

const feedbackEntries = [
    {
        id: "fb-301",
        customer: "Pham Minh",
        rating: 5,
        message: "Delivery was fast and the Pho is still hot. Love the new packaging!",
        date: "2025-04-15T10:32:00Z",
        status: "Replied",
    },
    {
        id: "fb-302",
        customer: "Nguyen Hoa",
        rating: 3,
        message: "Tasty but the spring rolls were a bit soggy on arrival.",
        date: "2025-04-15T08:21:00Z",
        status: "Pending",
    },
    {
        id: "fb-303",
        customer: "Le Thu",
        rating: 4,
        message: "Staff was friendly, would appreciate more vegetarian options.",
        date: "2025-04-14T19:05:00Z",
        status: "In Progress",
    },
];

const CustomerFeedback = () => {
    return (
        <div className={containerClasses}>
            <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Customer Feedback</h1>
                    <p className="text-sm text-slate-600">
                        Review customer feedback, respond directly, and track sentiment trends.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition">
                        Export Reviews
                    </button>
                    <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition">
                        Reply to All Pending
                    </button>
                </div>
            </header>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <SentimentCard title="Average Rating" value="4.6★" detail="Last 30 days" accent="bg-emerald-100 text-emerald-700" />
                <SentimentCard title="New Feedback" value="18" detail="Awaiting response" accent="bg-orange-100 text-orange-700" />
                <SentimentCard title="Resolved Cases" value="92%" detail="Service level agreement" accent="bg-blue-100 text-blue-700" />
            </section>

            <section className="mt-6 bg-white rounded-xl border border-slate-100 shadow-sm">
                <header className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Recent Feedback</h2>
                        <p className="text-sm text-slate-500">
                            Reply promptly to boost customer satisfaction and ratings.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition">
                            Unread
                        </button>
                        <button className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition">
                            5 Stars
                        </button>
                        <button className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition">
                            Negative Only
                        </button>
                    </div>
                </header>
                <div className="divide-y divide-slate-100">
                    {feedbackEntries.map(item => (
                        <article key={item.id} className="px-6 py-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-start gap-4">
                                <img src={assets.userImg} alt={item.customer} className="h-10 w-10 rounded-full object-cover" />
                                <div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <h3 className="text-base font-semibold text-slate-900">{item.customer}</h3>
                                        <RatingStars rating={item.rating} />
                                        <span className="text-xs text-slate-500">
                                            {new Date(item.date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                                        </span>
                                    </div>
                                    <p className="mt-2 max-w-xl text-sm text-slate-600">{item.message}</p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-3 lg:items-end">
                                <StatusBadge status={item.status} />
                                <div className="flex gap-2">
                                    <button className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition">
                                        View Order
                                    </button>
                                    <button className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition">
                                        Reply
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            <section className="mt-6 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Response Templates</h2>
                <p className="text-sm text-slate-600 mt-1">
                    Save time with pre-written responses. Customize before sending to keep personal touch.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {["Thank you for positive review", "Apology for delayed delivery", "Menu suggestion acknowledgement"].map(template => (
                        <div key={template} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            <p className="font-semibold text-slate-800">{template}</p>
                            <p className="text-xs text-slate-500 mt-1">
                                Insert dynamic customer and order details before sending.
                            </p>
                            <button className="mt-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition">
                                Use Template
                            </button>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

const SentimentCard = ({ title, value, detail, accent }) => (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
        <span className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${accent}`}>
            {detail}
        </span>
    </div>
);

const StatusBadge = ({ status }) => {
    const styles = {
        Replied: "bg-emerald-100 text-emerald-700",
        Pending: "bg-orange-100 text-orange-700",
        "In Progress": "bg-blue-100 text-blue-700",
    };
    return (
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
            {status}
        </span>
    );
};

const RatingStars = ({ rating }) => (
    <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, index) => (
            <svg
                key={index}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill={index < rating ? "#F97316" : "#E5E7EB"}
                className="h-4 w-4"
            >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
        ))}
    </div>
);

export default CustomerFeedback;






