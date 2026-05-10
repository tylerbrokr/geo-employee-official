import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { RoleGate } from "@/components/RoleGate";
import { AdminLayout } from "@/components/AdminLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Posts from "./pages/Posts";
import MySite from "./pages/MySite";
import Market from "./pages/Market";
import Account from "./pages/Account";
import Onboarding from "./pages/Onboarding";
import Unsubscribe from "./pages/Unsubscribe";
import NotFound from "./pages/NotFound";
import AdminClients from "./pages/admin/Clients";
import AdminClientDetail from "./pages/admin/ClientDetail";
import AdminPostsQueue from "./pages/admin/PostsQueue";
import AdminPostEditor from "./pages/admin/PostEditor";
import AdminChangeRequests from "./pages/admin/ChangeRequests";
import AdminEmails from "./pages/admin/Emails";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/portal" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />

            {/* Onboarding (client) */}
            <Route
              path="/onboarding"
              element={
                <RoleGate require="client">
                  <Onboarding />
                </RoleGate>
              }
            />

            {/* Portal (client) */}
            <Route path="/portal" element={<RoleGate require="client"><Dashboard /></RoleGate>} />
            <Route path="/portal/posts" element={<RoleGate require="client"><Posts /></RoleGate>} />
            <Route path="/portal/my-site" element={<RoleGate require="client"><MySite /></RoleGate>} />
            <Route path="/portal/market" element={<RoleGate require="client"><Market /></RoleGate>} />
            <Route path="/portal/account" element={<RoleGate require="client"><Account /></RoleGate>} />

            {/* Admin */}
            <Route element={<RoleGate require="admin"><AdminLayout /></RoleGate>}>
              <Route path="/admin" element={<AdminClients />} />
              <Route path="/admin/clients/:clientId" element={<AdminClientDetail />} />
              <Route path="/admin/posts" element={<AdminPostsQueue />} />
              <Route path="/admin/posts/:postId" element={<AdminPostEditor />} />
              <Route path="/admin/change-requests" element={<AdminChangeRequests />} />
              <Route path="/admin/emails" element={<AdminEmails />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
