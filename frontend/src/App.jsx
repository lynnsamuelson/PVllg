import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import RequireVerifiedOrg from "./components/RequireVerifiedOrg.jsx";
import { ROUTES } from "./routes.js";

import WelcomePage from "./pages/welcome/WelcomePage.jsx";
import AccountTypePage from "./pages/auth/AccountTypePage.jsx";
import LoginPage from "./pages/auth/LoginPage.jsx";
import SignupPage from "./pages/auth/SignupPage.jsx";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage.jsx";
import HomePage from "./pages/home/HomePage.jsx";
import ResourceDetailPage from "./pages/resources/ResourceDetailPage.jsx";
import ProfilePage from "./pages/profile/ProfilePage.jsx";
import OrgSignupPage from "./pages/org/OrgSignupPage.jsx";
import OrgVerifyPage from "./pages/org/OrgVerifyPage.jsx";
import StatusPage from "./pages/status/StatusPage.jsx";
import ComingSoonPage from "./pages/ComingSoonPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Public pages */}
        <Route path={ROUTES.welcome} element={<WelcomePage />} />
        <Route path={ROUTES.accountType} element={<AccountTypePage />} />
        <Route path={ROUTES.login} element={<LoginPage />} />
        <Route path={ROUTES.signup} element={<SignupPage />} />
        <Route path={ROUTES.forgotPassword} element={<ForgotPasswordPage />} />
        <Route path={ROUTES.status} element={<StatusPage />} />

        {/* Pages that require being logged in */}
        <Route element={<ProtectedRoute />}>
          <Route path={ROUTES.home} element={<HomePage />} />
          <Route path={ROUTES.resource()} element={<ResourceDetailPage />} />
          <Route path={ROUTES.profile} element={<ProfilePage />} />
          <Route path={ROUTES.orgSignup} element={<OrgSignupPage />} />
          <Route path={ROUTES.orgVerify} element={<OrgVerifyPage />} />

          {/* Filled in by their own tickets: KAN-6, KAN-15, KAN-12, KAN-9, KAN-10, KAN-23 */}
          <Route path={ROUTES.profileSetup} element={<ComingSoonPage title="Your profile" />} />
          <Route path={ROUTES.search} element={<ComingSoonPage title="Search near me" />} />
          <Route path={ROUTES.claims} element={<ComingSoonPage title="My claims" />} />
          <Route path={ROUTES.give} element={<ComingSoonPage title="Give" />} />
          <Route path={ROUTES.orgItems} element={<ComingSoonPage title="My items" />} />
          <Route path={ROUTES.impact} element={<ComingSoonPage title="Impact" />} />
          <Route element={<RequireVerifiedOrg />}>
            <Route path={ROUTES.postItem} element={<ComingSoonPage title="Post an item" />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
