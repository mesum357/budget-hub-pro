import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { RequireAdmin, RequireSub } from "@/components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import UsersPage from "./pages/UsersPage";
import UserProfilePage from "./pages/UserProfilePage";
import BudgetsPage from "./pages/BudgetsPage";
import SpendingsPage from "./pages/SpendingsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";
import SubDashboardPage from "./pages/sub/SubDashboardPage";
import SubSpendingPage from "./pages/sub/SubSpendingPage";
import SubAnalyticsPage from "./pages/sub/SubAnalyticsPage";
import SubWalletPage from "./pages/sub/SubWalletPage";

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <div key={location.key} className="animate-page-in">
      <Routes location={location}>
        <Route path="/" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <RequireAdmin>
              <DashboardPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/users"
          element={
            <RequireAdmin>
              <UsersPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/users/:userId"
          element={
            <RequireAdmin>
              <UserProfilePage />
            </RequireAdmin>
          }
        />
        <Route
          path="/budgets"
          element={
            <RequireAdmin>
              <BudgetsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/spendings"
          element={
            <RequireAdmin>
              <SpendingsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/analytics"
          element={
            <RequireAdmin>
              <AnalyticsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAdmin>
              <SettingsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/sub/dashboard"
          element={
            <RequireSub>
              <SubDashboardPage />
            </RequireSub>
          }
        />
        <Route
          path="/sub/spending"
          element={
            <RequireSub>
              <SubSpendingPage />
            </RequireSub>
          }
        />
        <Route
          path="/sub/analytics"
          element={
            <RequireSub>
              <SubAnalyticsPage />
            </RequireSub>
          }
        />
        <Route
          path="/sub/wallet"
          element={
            <RequireSub>
              <SubWalletPage />
            </RequireSub>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
