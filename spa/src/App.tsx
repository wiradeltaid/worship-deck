import { useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import ThemeProvider from '@/components/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';
import { OperatorUiLocaleProvider } from '@/lib/i18n/operator';
import { hydrateImportedFonts } from '@/lib/registry/font-catalog';
import { SessionProvider, useSession } from './lib/auth/SessionProvider';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CreateServicePage from './pages/CreateServicePage';
import RunSheetPage from './pages/RunSheetPage';
import PresentPage from './pages/PresentPage';
import RemotePage from './pages/RemotePage';
import SlideshowPage from './pages/SlideshowPage';
import ProjectorPage from './pages/ProjectorPage';
import ParityDiagnosticPage from './pages/ParityDiagnosticPage';
import AdminPage from './pages/AdminPage';
import AdminArtifactsPage from './pages/AdminArtifactsPage';
import AdminSyncPage from './pages/AdminSyncPage';
import OperatorShell from './pages/OperatorShell';

export default function App() {
  const loc = useLocation();

  // SPEC-37-02: Top-level font hydration on application boot
  useEffect(() => {
    void hydrateImportedFonts();
  }, []);

  const projected =
    loc.pathname.endsWith('/slideshow') || loc.pathname.endsWith('/projector');

  // Projected routes live outside the operator tree: they need no session and
  // no operator chrome. The two layout routes inside SessionProvider carry the
  // two operator surfaces — full chrome (`OperatorShell`) and the presenter
  // window (`PresentGate`, which renders nothing but its Outlet so
  // PresenterOperator keeps its own chrome).
  const routes = (
    <Routes>
      <Route path="/services/:id/present/projector" element={<ProjectorPage />} />
      <Route path="/services/:id/slideshow" element={<SlideshowPage />} />
      <Route path="/services/diagnostic-parity" element={<ParityDiagnosticPage />} />
      {/* Login must stay outside OperatorShell — shell returns null until authed. */}
      <Route path="/login" element={<LoginPage />} />
      <Route element={<SessionProvider><OperatorShell /></SessionProvider>}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/services/new" element={<CreateServicePage />} />
        <Route path="/services/:id" element={<RunSheetPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/artifacts" element={<AdminArtifactsPage />} />
        <Route path="/admin/sync" element={<AdminSyncPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
      <Route element={<SessionProvider><PresentGate /></SessionProvider>}>
        <Route path="/services/:id/present" element={<PresentPage />} />
        <Route path="/services/:id/remote" element={<RemotePage />} />
      </Route>
    </Routes>
  );

  if (projected) {
    return <div className="projected-root">{routes}</div>;
  }
  return (
    <ThemeProvider>
      <OperatorUiLocaleProvider>
      <Toaster />
      <div className="min-h-full">{routes}</div>
      </OperatorUiLocaleProvider>
    </ThemeProvider>
  );
}

/**
 * Bare session gate for `PresentPage`. Renders nothing until the session
 * resolves (so it does not flicker), then yields to its `<Outlet />`. No
 * Header / no OperatorPageShell — PresenterOperator paints its own chrome.
 */
function PresentGate() {
  const { status } = useSession();
  if (status !== 'authed') return null;
  return <Outlet />;
}
