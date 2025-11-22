import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { assets } from "../../assets/data";
import { useAppContext } from "../../context/AppContext";
import reviewsService from "../../services/reviews";

const containerClasses = "bg-white shadow-sm rounded-2xl p-6 space-y-6";

const CustomerFeedback = () => {
    const { restaurantProfile } = useAppContext();
    const restaurantOptions = useMemo(() => {
        const unique = new Map();
        const register = (id, name) => {
            if (!id) return;
            const normalized = String(id).trim();
            if (!normalized || unique.has(normalized)) return;
            unique.set(normalized, {
                id: normalized,
                name: name || restaurantProfile?.restaurantName || restaurantProfile?.restaurant_name || restaurantProfile?.profile?.legal_name || `Restaurant ${normalized.slice(0, 6)}`,
            });
        };
        register(restaurantProfile?.restaurantId, restaurantProfile?.restaurantName);
        register(restaurantProfile?.restaurant_id, restaurantProfile?.restaurant_name);
        register(restaurantProfile?.profile?.restaurant_id, restaurantProfile?.profile?.legal_name);
        if (Array.isArray(restaurantProfile?.scope?.restaurantIds)) {
            restaurantProfile.scope.restaurantIds.forEach((id) => register(id));
        }
        if (Array.isArray(restaurantProfile?.memberships)) {
            restaurantProfile.memberships.forEach((membership) =>
                register(membership.restaurantId || membership.restaurant_id, membership.restaurantName),
            );
        }
        return Array.from(unique.values());
    }, [restaurantProfile]);

    const [selectedRestaurantId, setSelectedRestaurantId] = useState(
        () => restaurantOptions[0]?.id || null,
    );
    useEffect(() => {
        if (!selectedRestaurantId && restaurantOptions.length) {
            setSelectedRestaurantId(restaurantOptions[0].id);
        }
    }, [restaurantOptions, selectedRestaurantId]);

    const [reviews, setReviews] = useState([]);
    const [summary, setSummary] = useState({ averageRating: null, totalReviews: 0 });
    const [loading, setLoading] = useState(false);
    const [replyDrafts, setReplyDrafts] = useState({});
    const [replySubmitting, setReplySubmitting] = useState({});

    const loadReviews = useCallback(
        async (restaurantId, params = {}) => {
            if (!restaurantId) return;
            setLoading(true);
            try {
                const data = await reviewsService.fetchOwnerRestaurantReviews(restaurantId, {
                    limit: 50,
                    ...params,
                });
                const incomingReviews = Array.isArray(data)
                    ? data
                    : Array.isArray(data?.reviews)
                        ? data.reviews
                        : [];
                const incomingSummary = data?.summary || {
                    averageRating: null,
                    totalReviews: incomingReviews.length,
                };
                setReviews(incomingReviews);
                setSummary(incomingSummary);
            } catch (error) {
                const message =
                    error?.response?.data?.message ||
                    error?.message ||
                    "Unable to load customer feedback.";
                toast.error(message);
            } finally {
                setLoading(false);
            }
        },
        [],
    );

    useEffect(() => {
        if (selectedRestaurantId) {
            const scopeBranchIds =
                (restaurantProfile?.scope?.branchIds && restaurantProfile.scope.branchIds.length
                    ? restaurantProfile.scope.branchIds
                    : []) ||
                [];
            const membershipBranchIds = Array.isArray(restaurantProfile?.memberships)
                ? restaurantProfile.memberships
                    .map((m) => m.branchId || m.branch_id)
                    .filter(Boolean)
                : [];
            const mergedBranchIds = Array.from(
                new Set([...scopeBranchIds, ...membershipBranchIds].filter(Boolean)),
            );
            const params = mergedBranchIds.length
                ? { branchIds: mergedBranchIds.join(",") }
                : {};
            loadReviews(selectedRestaurantId, params);
        }
    }, [selectedRestaurantId, loadReviews, restaurantProfile]);

    const pendingCount = useMemo(
        () => reviews.filter((review) => !review.ownerReply && !review.owner_reply).length,
        [reviews],
    );
    const resolvedRate = useMemo(() => {
        if (!reviews.length) return 0;
        const replied = reviews.length - pendingCount;
        return Math.round((replied / reviews.length) * 100);
    }, [reviews.length, pendingCount]);

    const handleReplyChange = useCallback((reviewId, value) => {
        setReplyDrafts((prev) => ({ ...prev, [reviewId]: value }));
    }, []);

    const handleReplySubmit = useCallback(
        async (reviewId) => {
            if (!selectedRestaurantId) return;
            const draft = (replyDrafts[reviewId] || "").trim();
            if (!draft.length) {
                toast.error("Please write a reply before sending.");
                return;
            }
            setReplySubmitting((prev) => ({ ...prev, [reviewId]: true }));
            try {
                const response = await reviewsService.replyRestaurantReview(
                    selectedRestaurantId,
                    reviewId,
                    { reply: draft },
                );
                const updatedReview = response?.review;
                if (updatedReview) {
                    setReviews((prev) =>
                        prev.map((item) =>
                            item.id === updatedReview.id
                                ? {
                                      ...item,
                                      ownerReply: updatedReview.ownerReply || updatedReview.owner_reply || draft,
                                      ownerReplyAt:
                                          updatedReview.ownerReplyAt ||
                                          updatedReview.owner_reply_at ||
                                          new Date().toISOString(),
                                  }
                                : item,
                        ),
                    );
                }
                setReplyDrafts((prev) => ({ ...prev, [reviewId]: "" }));
                toast.success("Reply sent successfully.");
            } catch (error) {
                const message =
                    error?.response?.data?.message ||
                    error?.message ||
                    "Unable to send reply.";
                toast.error(message);
            } finally {
                setReplySubmitting((prev) => ({ ...prev, [reviewId]: false }));
            }
        },
        [replyDrafts, selectedRestaurantId],
    );

    return (
        <div className={containerClasses}>
            <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Customer Feedback</h1>
                    <p className="text-sm text-slate-600">
                        Review customer feedback, respond directly, and track sentiment trends.
                    </p>
                </div>
                {restaurantOptions.length > 1 ? (
                    <select
                        value={selectedRestaurantId || ""}
                        onChange={(event) => setSelectedRestaurantId(event.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                        {restaurantOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                                {option.name}
                            </option>
                        ))}
                    </select>
                ) : null}
            </header>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <SentimentCard
                    title="Average Rating"
                    value={`${(summary.averageRating ?? 0).toFixed(1)}★`}
                    detail={`${summary.totalReviews || 0} reviews`}
                    accent="bg-emerald-100 text-emerald-700"
                />
                <SentimentCard
                    title="Pending replies"
                    value={pendingCount}
                    detail="Awaiting response"
                    accent="bg-orange-100 text-orange-700"
                />
                <SentimentCard
                    title="Resolved cases"
                    value={`${resolvedRate}%`}
                    detail="Reply rate"
                    accent="bg-blue-100 text-blue-700"
                />
            </section>

            <section className="mt-6 bg-white rounded-xl border border-slate-100 shadow-sm">
                <header className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Recent Feedback</h2>
                        <p className="text-sm text-slate-500">
                            Reply promptly to boost customer satisfaction and ratings.
                        </p>
                    </div>
                    {loading ? (
                        <span className="text-xs font-semibold text-slate-500">Loading...</span>
                    ) : null}
                </header>
                <div className="divide-y divide-slate-100">
                    {reviews.length ? (
                        reviews.map((item) => (
                            <article key={item.id} className="px-6 py-5 flex flex-col gap-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="flex items-start gap-4">
                                        <img
                                            src={item.avatar || assets.userImg}
                                            alt={item.customerName}
                                            className="h-10 w-10 rounded-full object-cover"
                                        />
                                        <div>
                                            <div className="flex flex-wrap items-center gap-3">
                                                <h3 className="text-base font-semibold text-slate-900">
                                                    {item.customerName || "Customer"}
                                                </h3>
                                                <RatingStars rating={item.rating} />
                                                <span className="text-xs text-slate-500">
                                                    {new Date(item.createdAt).toLocaleString(undefined, {
                                                        dateStyle: "medium",
                                                        timeStyle: "short",
                                                    })}
                                                </span>
                                            </div>
                                            <p className="mt-2 max-w-xl text-sm text-slate-600">{item.comment}</p>
                                            {item.dishes?.length ? (
                                                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                                                    {item.dishes.map((dish) => (
                                                        <span
                                                            key={dish.dishId}
                                                            className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600"
                                                        >
                                                            {dish.title}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                    <StatusBadge status={item.ownerReply ? "Replied" : "Pending"} />
                                </div>
                                {item.ownerReply ? (
                                    <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                        <p className="font-semibold">Your reply</p>
                                        <p className="mt-1">{item.ownerReply}</p>
                                        <p className="mt-2 text-xs text-emerald-600">
                                            {item.ownerReplyAt
                                                ? new Date(item.ownerReplyAt).toLocaleString()
                                                : "Just now"}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                                        <textarea
                                            value={replyDrafts[item.id] || ""}
                                            onChange={(event) =>
                                                handleReplyChange(item.id, event.target.value)
                                            }
                                            rows={3}
                                            placeholder="Write a personalized reply..."
                                            className="w-full rounded-lg border border-transparent bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                        />
                                        <div className="flex justify-between text-xs text-slate-500">
                                            <span>{item.orderId ? `Order ${item.orderId}` : "Verified order"}</span>
                                            <span>{item.dishes?.length || 0} dishes</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleReplySubmit(item.id)}
                                                disabled={replySubmitting[item.id]}
                                                className={`rounded-lg px-4 py-2 text-xs font-semibold text-white transition ${
                                                    replySubmitting[item.id]
                                                        ? "cursor-not-allowed bg-emerald-200"
                                                        : "bg-emerald-500 hover:bg-emerald-600"
                                                }`}
                                            >
                                                {replySubmitting[item.id] ? "Sending..." : "Send reply"}
                                            </button>
                                            <button
                                                onClick={() => setReplyDrafts((prev) => ({ ...prev, [item.id]: "" }))}
                                                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </article>
                        ))
                    ) : (
                        <p className="px-6 py-5 text-center text-sm text-slate-500">
                            {loading ? "Loading feedback..." : "No feedback yet."}
                        </p>
                    )}
                </div>
            </section>

            <section className="mt-6 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Response Templates</h2>
                <p className="text-sm text-slate-600 mt-1">
                    Save time with pre-written responses. Customize before sending to keep personal touch.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {["Thank you for positive review", "Apology for delayed delivery", "Menu suggestion acknowledgement"].map(
                        (template) => (
                            <div
                                key={template}
                                className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600"
                            >
                                <p className="font-semibold text-slate-800">{template}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                    Insert dynamic customer and order details before sending.
                                </p>
                                <button className="mt-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition">
                                    Use Template
                                </button>
                            </div>
                        ),
                    )}
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
