import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import ActivityPage from "./pages/ActivityPage";
import GroupDashboardPage from "./pages/GroupDashboardPage";
import GroupRidePage from "./pages/GroupRidePage";
import SegmentPage from "./pages/SegmentPage";
import AthletePage from "./pages/AthletePage";
import ExplorePage from "./pages/ExplorePage";
import StravaCallbackPage from "./pages/StravaCallbackPage";
import SettingsPage from "./pages/SettingsPage";
import FriendsPage from "./pages/FriendsPage";
import MigrationPage from "./pages/MigrationPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/activity/:activityId" element={<ActivityPage />} />
        <Route path="/group/:groupId" element={<GroupDashboardPage />} />
        <Route
          path="/group/:groupId/ride/:rideId"
          element={<GroupRidePage />}
        />
        <Route path="/segment/:segmentId" element={<SegmentPage />} />
        <Route path="/athlete/:userId" element={<AthletePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/strava/callback" element={<StravaCallbackPage />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/migrate" element={<MigrationPage />} />
      </Route>
    </Routes>
  );
}
