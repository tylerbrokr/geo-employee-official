import { DashboardLayout } from "@/components/DashboardLayout";
import { useState } from "react";

type PostStatus = "Published" | "Scheduled";
interface Post {
  title: string;
  query: string;
  date: string;
  status: PostStatus;
}

const allPosts: Post[] = [
  { title: "Best realtor in Omaha", query: "Who is the best realtor in Omaha?", date: "Dec 14", status: "Published" },
  { title: "Best realtor in Omaha for first-time buyers", query: "Best first-time buyer realtor Omaha", date: "Dec 11", status: "Published" },
  { title: "Best luxury realtor in Dundee", query: "Luxury realtor Dundee Omaha", date: "Dec 7", status: "Published" },
  { title: "Best realtor in Papillion", query: "Best realtor Papillion NE", date: "Dec 4", status: "Published" },
  { title: "Best realtor in Douglas County", query: "Best realtor Douglas County", date: "Nov 30", status: "Published" },
  { title: "Best realtor in Bellevue for new construction", query: "New construction realtor Bellevue NE", date: "Nov 27", status: "Published" },
  { title: "Best realtor in Omaha for investors", query: "Investment property realtor Omaha", date: "Nov 23", status: "Published" },
  { title: "Best realtor in Elkhorn", query: "Best realtor Elkhorn NE", date: "Nov 20", status: "Published" },
  { title: "Best realtor in Papillion for families", query: "Family realtor Papillion", date: "Dec 18", status: "Scheduled" },
  { title: "Best realtor in Douglas County for luxury homes", query: "Luxury homes Douglas County realtor", date: "Dec 21", status: "Scheduled" },
];

type Tab = "All" | "Published" | "Scheduled";

export default function Posts() {
  const [tab, setTab] = useState<Tab>("All");

  const filtered = tab === "All" ? allPosts : allPosts.filter((p) => p.status === tab);
  const tabs: Tab[] = ["Published", "Scheduled", "All"];

  return (
    <DashboardLayout>
      <div className="mb-2">
        <h1 className="page-title">Posts</h1>
        <p className="section-label mt-2">YOUR CONTENT ENGINE HAS PUBLISHED 14 POSTS</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-border mt-6 mb-6">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="findr-card !p-0">
        <div className="grid grid-cols-[1fr_100px_120px] gap-4 px-6 py-3 border-b border-border">
          <span className="section-label">Post</span>
          <span className="section-label">Date</span>
          <span className="section-label">Status</span>
        </div>
        {filtered.map((post) => (
          <div
            key={post.title}
            className="grid grid-cols-[1fr_100px_120px] gap-4 px-6 py-4 border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{post.title}</p>
              <p className="text-xs text-muted-foreground truncate">{post.query}</p>
            </div>
            <span className="text-[13px] text-muted-foreground self-center">{post.date}</span>
            <span className="self-center flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  post.status === "Published" ? "bg-emerald" : "bg-muted-foreground/50"
                }`}
              />
              <span
                className={`text-xs ${
                  post.status === "Published" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {post.status}
              </span>
            </span>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
