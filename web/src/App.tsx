import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import GroupDashboardPage from "./pages/GroupDashboardPage";
import GroupRidePage from "./pages/GroupRidePage";
import SegmentPage from "./pages/SegmentPage";
import AthletePage from "./pages/AthletePage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/group/:groupId" element={<GroupDashboardPage />} />
        <Route
          path="/group/:groupId/ride/:rideId"
          element={<GroupRidePage />}
        />
        <Route path="/segment/:segmentId" element={<SegmentPage />} />
        <Route path="/athlete/:userId" element={<AthletePage />} />
      </Route>
    </Routes>
  );
}
