import { Routes, Route, Navigate } from 'react-router-dom';
import StaffLogin from './pages/auth/StaffLogin';
import StaffModeSelect from './pages/auth/StaffModeSelect';
import UpdatePassword from './pages/auth/UpdatePassword';
import Dashboard from './pages/admin/Dashboard';
import Settings from './pages/admin/Settings';
import SearchResults from './pages/admin/SearchResults';
import MemberDetail from './pages/admin/MemberDetail';
import DesktopDashboard from './pages/admin/desktop/DesktopDashboard';
import DesktopMemberDetail from './pages/admin/desktop/DesktopMemberDetail';
import DesktopMaintenance from './pages/admin/desktop/DesktopMaintenance';
import { AdminGuard } from './components/AdminGuard';
import { STAFF_LOGIN_PATH, STAFF_MODE_SELECT_PATH } from './lib/routes';

export function StaffAppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<Navigate to={STAFF_LOGIN_PATH} replace />} />
            <Route path={STAFF_LOGIN_PATH} element={<StaffLogin />} />
            <Route
                path={STAFF_MODE_SELECT_PATH}
                element={
                    <AdminGuard>
                        <StaffModeSelect />
                    </AdminGuard>
                }
            />
            <Route path="/auth/update-password" element={<UpdatePassword />} />
            <Route path="/admin" element={<AdminGuard><Dashboard /></AdminGuard>} />
            <Route path="/admin/settings" element={<AdminGuard><Settings /></AdminGuard>} />
            <Route path="/admin/search" element={<AdminGuard><SearchResults /></AdminGuard>} />
            <Route path="/admin/members/:id" element={<AdminGuard><MemberDetail /></AdminGuard>} />
            <Route path="/admin/office" element={<AdminGuard><DesktopDashboard /></AdminGuard>} />
            <Route path="/admin/office/maintenance" element={<AdminGuard><DesktopMaintenance /></AdminGuard>} />
            <Route
                path="/admin/office/members/:id"
                element={<AdminGuard><DesktopMemberDetail /></AdminGuard>}
            />
            <Route path="*" element={<Navigate to={STAFF_LOGIN_PATH} replace />} />
        </Routes>
    );
}
