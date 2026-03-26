import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const stats = [
  { label: "Posts Published", value: "14", sub: "total since launch" },
  { label: "This Month", value: "2", sub: "published so far" },
  { label: "Next Post", value: "3 days", sub: "Monday, 9:00 AM" },
  { label: "Cities Covered", value: "5", sub: "in your market" },
];

const recentPosts = [
  { title: "Best realtor in Omaha for first-time buyers", tag: "Local Discovery", date: "Dec 14, 2024" },
  { title: "Best luxury realtor in Dundee", tag: "Neighborhood", date: "Dec 11, 2024" },
  { title: "Best realtor in Papillion", tag: "Local Discovery", date: "Dec 7, 2024" },
  { title: "Best realtor in Douglas County", tag: "County", date: "Dec 4, 2024" },
];

const scheduled = [
  { title: "Best realtor in Papillion for families", date: "Publishes Monday" },
  { title: "Best realtor in Douglas County", date: "Publishes Thursday" },
];

export default function Dashboard() {
  return (
    <DashboardLayout>
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="page-title">Good morning, Sarah.</h1>
        <p className="text-sm text-muted-foreground mt-1">Your content engine published 2 posts this week.</p>
      </div>

      {/* Hero Card */}
      <div className="findr-card mb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="section-label mb-2">YOUR FINDR SITE</p>
            <p className="text-base font-semibold text-primary">sarahjones-omaha.netlify.app</p>
            <div className="flex gap-3 mt-4">
              <Button variant="default" size="sm">Visit Site</Button>
              <Button variant="secondary" size="sm">Copy URL</Button>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2 border-emerald/30" />
              <div className="absolute inset-2 rounded-full border-2 border-emerald/50" />
              <div className="absolute inset-4 rounded-full bg-emerald animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Live</p>
              <p className="text-xs text-muted-foreground">Auto-publishing</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map((s) => (
          <div key={s.label} className="findr-card">
            <p className="section-label mb-2">{s.label}</p>
            <p className="stat-number">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Recent Posts */}
      <div className="mb-10">
        <p className="section-label mb-4">RECENT POSTS</p>
        <div className="findr-card !p-0 divide-y divide-border">
          {recentPosts.map((post) => (
            <div key={post.title} className="flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-medium text-foreground truncate">{post.title}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
                  <span className="text-xs text-primary">{post.tag}</span>
                </span>
              </div>
              <span className="text-[13px] text-muted-foreground shrink-0 ml-4">{post.date}</span>
            </div>
          ))}
        </div>
        <Link to="/posts" className="inline-block mt-3 text-sm font-medium text-primary hover:text-emerald-hover transition-colors">
          View all posts →
        </Link>
      </div>

      {/* Scheduled */}
      <div>
        <p className="section-label mb-4">SCHEDULED</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scheduled.map((post) => (
            <div key={post.title} className="findr-card">
              <p className="text-sm font-medium text-foreground mb-1">{post.title}</p>
              <p className="text-xs text-muted-foreground mb-3">{post.date}</p>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                Scheduled
              </span>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
