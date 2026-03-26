import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const stats = [
  { label: "Posts Published", value: "14", sub: "total since launch", sparkline: "M0,8 L4,6 L8,7 L12,3 L16,4 L20,1" },
  { label: "This Month", value: "2", sub: "published so far", sparkline: "M0,7 L4,8 L8,5 L12,6 L16,3 L20,4" },
  { label: "Next Post", value: "3 days", sub: "Monday, 9:00 AM", sparkline: "M0,4 L4,5 L8,3 L12,6 L16,4 L20,2" },
  { label: "Cities Covered", value: "5", sub: "in your market", sparkline: "M0,6 L4,4 L8,5 L12,2 L16,3 L20,1" },
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

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

export default function Dashboard() {
  return (
    <DashboardLayout>
      <motion.div variants={container} initial="hidden" animate="show">
        {/* Greeting */}
        <motion.div variants={item} className="mb-8">
          <h1 className="page-title">Good morning, Sarah.</h1>
          <p className="text-sm text-muted-foreground mt-1">Your content engine published 2 posts this week.</p>
        </motion.div>

        {/* Hero Card */}
        <motion.div variants={item} className="findr-card-elevated mb-8">
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
              <div className="relative flex items-center justify-center w-12 h-12">
                <span className="w-3 h-3 rounded-full bg-emerald emerald-pulse" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Live</p>
                <p className="text-xs text-muted-foreground">Auto-publishing</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              className="findr-card relative"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.06, duration: 0.3 }}
            >
              {/* Sparkline */}
              <svg className="absolute bottom-3 right-3 opacity-[0.12]" width="48" height="20" viewBox="0 0 20 10">
                <path d={s.sparkline} fill="none" stroke="hsl(var(--emerald))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="section-label mb-2">{s.label}</p>
              <p className="stat-number">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Recent Posts */}
        <motion.div variants={item} className="mb-10">
          <p className="section-label mb-4">RECENT POSTS</p>
          <div className="findr-card !p-0">
            {recentPosts.map((post, i) => (
              <div key={post.title}>
                <div className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate">{post.title}</span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
                      <span className="text-xs text-primary">{post.tag}</span>
                    </span>
                  </div>
                  <span className="text-[13px] text-muted-foreground shrink-0 ml-4">{post.date}</span>
                </div>
                {i < recentPosts.length - 1 && <div className="fading-divider mx-6" />}
              </div>
            ))}
          </div>
          <Link to="/posts" className="inline-block mt-3 text-sm font-medium text-primary hover:text-emerald-hover transition-colors">
            View all posts →
          </Link>
        </motion.div>

        {/* Scheduled */}
        <motion.div variants={item}>
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
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}
