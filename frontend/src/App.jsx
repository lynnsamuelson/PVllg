import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import RequireGiver from "./components/RequireGiver.jsx";
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
import ProfileSetupPage from "./pages/profile/ProfileSetupPage.jsx";
import OrgSignupPage from "./pages/org/OrgSignupPage.jsx";
import OrgVerifyPage from "./pages/org/OrgVerifyPage.jsx";
import OrgProfilePage from "./pages/org/OrgProfilePage.jsx";
import PostItemPage from "./pages/items/PostItemPage.jsx";
import MyItemsPage from "./pages/items/MyItemsPage.jsx";
import SearchPage from "./pages/search/SearchPage.jsx";
import MyClaimsPage from "./pages/claims/MyClaimsPage.jsx";
import AddToCalendarPage from "./pages/claims/AddToCalendarPage.jsx";
import ReportProblemPage from "./pages/claims/ReportProblemPage.jsx";
import ItemDetailPage from "./pages/items/ItemDetailPage.jsx";
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
          <Route path={ROUTES.profileSetup} element={<ProfileSetupPage />} />
          <Route path={ROUTES.orgSignup} element={<OrgSignupPage />} />
          <Route path={ROUTES.orgVerify} element={<OrgVerifyPage />} />

          {/* Filled in by its own ticket: KAN-23 */}
          <Route path={ROUTES.search} element={<SearchPage />} />
          <Route path={ROUTES.item()} element={<ItemDetailPage />} />
          <Route path={ROUTES.claims} element={<MyClaimsPage />} />
          <Route path={ROUTES.claimCalendar()} element={<AddToCalendarPage />} />
          <Route path={ROUTES.claimReport()} element={<ReportProblemPage />} />

          <Route path={ROUTES.impact} element={<ComingSoonPage title="Impact" />} />
          <Route element={<RequireGiver title="Post an item" />}>
            <Route path={ROUTES.postItem} element={<PostItemPage />} />
            <Route path={ROUTES.editItem()} element={<PostItemPage />} />
          </Route>
          <Route element={<RequireGiver title="My items" anyPerson />}>
            <Route path={ROUTES.give} element={<MyItemsPage />} />
            <Route path={ROUTES.orgItems} element={<MyItemsPage />} />
          </Route>
          <Route
            element={
              <RequireVerifiedOrg
                title="Organization profile"
                pendingNote="You can set up your organization's profile once its email is confirmed."
                othersNote="Only verified organizations have this profile."
              />
            }
          >
            <Route path={ROUTES.orgProfile} element={<OrgProfilePage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
