import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated } from './lib/auth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MembersPage from './pages/MembersPage';
import MemberProfilePage from './pages/MemberProfilePage';
import BanquestImportPage from './pages/BanquestImportPage';
import ImportPage from './pages/ImportPage';
import UnmatchedPage from './pages/UnmatchedPage';
import ZellePage from './pages/ZellePage';
import DonorsPage from './pages/DonorsPage';
import DonorProfilePage from './pages/DonorProfilePage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/members/:id" element={<MemberProfilePage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/import/legacy" element={<BanquestImportPage />} />
          <Route path="/donors" element={<DonorsPage />} />
          <Route path="/donors/:id" element={<DonorProfilePage />} />
          <Route path="/unmatched" element={<UnmatchedPage />} />
          <Route path="/zelle" element={<ZellePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
