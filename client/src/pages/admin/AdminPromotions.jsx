import React from "react";

const campaigns = [
    { id: "SYS-PR-01", name: "Summer Delivery Blast", channel: "Banner + Push", reach: "1.2M users", status: "Running", duration: "Jun 1 - Jun 30" },
    { id: "SYS-PR-02", name: "Shared Voucher - HAPPYMEAL", channel: "Voucher", reach: "450K users", status: "Scheduled", duration: "Jul 10 - Jul 20" },
    { id: "SYS-PR-03", name: "Golden Week Ads", channel: "Banner", reach: "870K users", status: "Completed", duration: "Apr 25 - May 5" },
];

const AdminPromotions = () => (
    <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
                <h1 className="text-2xl font-bold text-neutral-900">System Promotions</h1>
                <p className="text-sm text-neutral-600">
                    Launch and monitor platform-wide advertising banners and shared voucher programs.
                </p>
            </div>
            <div className="flex gap-3">
                <button className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-600 hover:text-neutral-900">
                    Campaign Library
                </button>
                <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
                    Create Campaign
                </button>
            </div>
        </div>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricCard label="Active Campaigns" value="6" detail="Across 42 cities" />
            <MetricCard label="Voucher Redemptions" value="68,430" detail="Last 30 days" />
            <MetricCard label="Ad Impressions" value="12.4M" detail="Across all banners" />
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white shadow-sm">
            <header className="flex flex-col gap-3 border-b border-neutral-200 px-6 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-neutral-900">Campaign Overview</h2>
                    <p className="text-xs text-neutral-500">Status, reach, and timelines for system-wide promotions.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-200">
                        Running
                    </button>
                    <button className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-200">
                        Scheduled
                    </button>
                    <button className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-200">
                        Completed
                    </button>
                </div>
            </header>
            <div className="divide-y divide-neutral-200">
                {campaigns.map(campaign => (
                    <article key={campaign.id} className="px-6 py-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
                        <div className="lg:col-span-2">
                            <p className="text-sm font-semibold text-neutral-900">{campaign.name}</p>
                            <p className="text-xs text-neutral-500">{campaign.id}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase text-neutral-500">Channel</p>
                            <p className="text-sm text-neutral-600">{campaign.channel}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase text-neutral-500">Reach</p>
                            <p className="text-sm text-neutral-600">{campaign.reach}</p>
                        </div>
                        <div className="flex flex-col gap-2 text-right">
                            <StatusBadge status={campaign.status} />
                            <span className="text-xs text-neutral-500">{campaign.duration}</span>
                            <div className="flex gap-2 justify-end">
                                <button className="text-xs font-semibold text-neutral-600 hover:text-neutral-900">
                                    View
                                </button>
                                <button className="text-xs font-semibold text-neutral-600 hover:text-neutral-900">
                                    Duplicate
                                </button>
                            </div>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    </div>
);

const MetricCard = ({ label, value, detail }) => (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
        <p className="mt-2 text-xl font-bold text-neutral-900">{value}</p>
        <p className="text-xs text-neutral-500 mt-2">{detail}</p>
    </div>
);

const badgeStyles = {
    Running: "bg-emerald-100 text-emerald-700",
    Scheduled: "bg-amber-100 text-amber-700",
    Completed: "bg-neutral-200 text-neutral-600",
};

const StatusBadge = ({ status }) => (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badgeStyles[status] ?? "bg-neutral-200 text-neutral-600"}`}>
        {status}
    </span>
);

export default AdminPromotions;
