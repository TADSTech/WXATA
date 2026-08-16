import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import TvDashboard from "./pages/TvDashboard";
import XGrabberPage from "./pages/XGrabberPage";
import TvTools from "./pages/TvTools";
import "./index.css";
import { ThemeProvider } from "./components/ThemeProvider";

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/:username" element={<Dashboard />} />
          <Route path="/tv" element={<TvDashboard />} />
          <Route path="/tv/:username" element={<TvDashboard />} />
          <Route path="/tv/tools" element={<TvTools />} />
          <Route path="/tv/tools/:username" element={<TvTools />} />
          <Route path="/grabber" element={<XGrabberPage />} />
          <Route path="/grabber/:username" element={<XGrabberPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
