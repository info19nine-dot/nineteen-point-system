import { Routes, Route, Navigate } from 'react-router-dom';
import MemberLogin from './pages/auth/MemberLogin';
import StaffLogin from './pages/auth/StaffLogin';
import Register from './pages/auth/Register';

import PasswordReset from './pages/auth/PasswordReset';
import ConfirmEmail from './pages/auth/ConfirmEmail';
import UpdatePassword from './pages/auth/UpdatePassword';
import CardHome from './pages/member/CardHome';
import Dashboard from './pages/admin/Dashboard';
import Settings from './pages/admin/Settings';
import MemberSettings from './pages/member/Settings';
import SearchResults from './pages/admin/SearchResults';
import MemberDetail from './pages/admin/MemberDetail'; 
import SpecialMembership from './pages/member/SpecialMembership'; 

import DesktopDashboard from './pages/admin/desktop/DesktopDashboard';
import DesktopMemberDetail from './pages/admin/desktop/DesktopMemberDetail';
import { AdminGuard } from './components/AdminGuard';



function App() {
  return (
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Auth Routes */}
        <Route path="/login" element={<MemberLogin />} />
        <Route path="/register" element={<Register />} />

        <Route path="/forgot-password" element={<PasswordReset />} />
        <Route path="/auth/update-password" element={<UpdatePassword />} />
        <Route path="/auth/confirm-email" element={<ConfirmEmail />} />
        
        {/* Staff Portal */}
        <Route path="/admin/login" element={<StaffLogin />} />
        
        {/* Protected Routes (Guard logic is inside components for now) */}
        <Route path="/member" element={<CardHome />} />
        <Route path="/card" element={<CardHome />} />
        <Route path="/member/settings" element={<MemberSettings />} />
        <Route path="/member/special" element={<SpecialMembership />} />
        
        {/* Mobile Admin Routes (Store Mode) */}
        <Route path="/admin" element={<AdminGuard><Dashboard /></AdminGuard>} />
        <Route path="/admin/settings" element={<AdminGuard><Settings /></AdminGuard>} />
        <Route path="/admin/search" element={<AdminGuard><SearchResults /></AdminGuard>} />
        <Route path="/admin/members/:id" element={<AdminGuard><MemberDetail /></AdminGuard>} />

        {/* PC Admin Routes (Office Mode) */}
        <Route path="/admin/office" element={<AdminGuard><DesktopDashboard /></AdminGuard>} />
        <Route path="/admin/office/members/:id" element={<AdminGuard><DesktopMemberDetail /></AdminGuard>} />

        {/* Demo Routes */}

      </Routes>
  );
}

export default App;
