/* eslint-disable react-refresh/only-export-components */
import { Helmet } from "react-helmet-async";
import { createBrowserRouter, Outlet } from "react-router-dom";
import HomePage from "@/app/page";
import LandingPageRoute from "@/app/landingpage/page";
import LoginPage from "@/app/auth/login/page";
import SignupPage from "@/app/auth/signup/page";
import DashboardPage from "@/app/dashboard/page";
import CylindersPage from "@/app/cylinders/page";
import RefillsPage from "@/app/refills/page";
import AlertsPage from "@/app/alerts/page";
import UsersPage from "@/app/users/page";
import SettingsPage from "@/app/settings/page";
import AnalyticsPage from "@/app/analytics/page";
import ProvidersPage from "@/app/providers/page";
import { Providers } from "@/app/providers";
import { AppShell } from "@/components/app-shell";

function RootLayout() {
  return (
    <Providers>
      <Helmet>
        <title>Lumora</title>
        <meta name="description" content="Live LPG monitoring, safety alerts, and refill planning" />
      </Helmet>
      <AppShell>
        <Outlet />
      </AppShell>
    </Providers>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/landingpage", element: <LandingPageRoute /> },
      { path: "/auth/login", element: <LoginPage /> },
      { path: "/auth/signup", element: <SignupPage /> },
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/cylinders", element: <CylindersPage /> },
      { path: "/refills", element: <RefillsPage /> },
      { path: "/alerts", element: <AlertsPage /> },
      { path: "/users", element: <UsersPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "/analytics", element: <AnalyticsPage /> },
      { path: "/providers", element: <ProvidersPage /> },
    ],
  },
]);
