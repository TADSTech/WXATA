import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import DocsPage from "./pages/DocsPage";
import MarketplacePage from "./components/marketplace/MarketplacePage";
import PluginDetailPage from "./components/marketplace/PluginDetailPage";
import PublishPage from "./components/marketplace/PublishPage";
import MarketplaceAuthPage from "./components/marketplace/MarketplaceAuthPage";
import MyPluginsPage from "./components/marketplace/MyPluginsPage";
import "./index.css";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/marketplace/login" element={<MarketplaceAuthPage />} />
        <Route path="/marketplace/publish" element={<PublishPage />} />
        <Route path="/marketplace/my-plugins" element={<MyPluginsPage />} />
        <Route path="/marketplace/:id" element={<PluginDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
