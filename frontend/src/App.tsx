import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import DocsPage from "./pages/DocsPage";
import Connect from "./pages/Connect";
import Dashboard from "./pages/Dashboard";
import TvDashboard from "./pages/TvDashboard";
import XGrabberPage from "./pages/XGrabberPage";
import TvTools from "./pages/TvTools";
import MarketplacePage from "./components/marketplace/MarketplacePage";
import PluginDetailPage from "./components/marketplace/PluginDetailPage";
import PublishPage from "./components/marketplace/PublishPage";
import MarketplaceAuthPage from "./components/marketplace/MarketplaceAuthPage";
import MyPluginsPage from "./components/marketplace/MyPluginsPage";
import "./index.css";
import { ThemeProvider } from "./components/ThemeProvider";

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/connect" element={<Connect />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/:username" element={<Dashboard />} />
          <Route path="/tv" element={<TvDashboard />} />
          <Route path="/tv/:username" element={<TvDashboard />} />
          <Route path="/tv/tools" element={<TvTools />} />
          <Route path="/tv/tools/:username" element={<TvTools />} />
          <Route path="/grabber" element={<XGrabberPage />} />
          <Route path="/grabber/:username" element={<XGrabberPage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/marketplace/login" element={<MarketplaceAuthPage />} />
          <Route path="/marketplace/publish" element={<PublishPage />} />
          <Route path="/marketplace/my-plugins" element={<MyPluginsPage />} />
          <Route path="/marketplace/:id" element={<PluginDetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
