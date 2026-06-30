import { Routes, Route, Navigate } from 'react-router-dom';
import MemberLogin from './pages/auth/MemberLogin';
import Register from './pages/auth/Register';
import PasswordReset from './pages/auth/PasswordReset';
import ConfirmEmail from './pages/auth/ConfirmEmail';
import UpdatePassword from './pages/auth/UpdatePassword';
import CardHome from './pages/member/CardHome';
import MemberSettings from './pages/member/Settings';
import SpecialMembership from './pages/member/SpecialMembership';
import NotFound from './pages/NotFound';

export function MemberAppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<MemberLogin />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<PasswordReset />} />
            <Route path="/auth/update-password" element={<UpdatePassword />} />
            <Route path="/auth/confirm-email" element={<ConfirmEmail />} />
            <Route path="/member" element={<CardHome />} />
            <Route path="/card" element={<CardHome />} />
            <Route path="/member/settings" element={<MemberSettings />} />
            <Route path="/member/special" element={<SpecialMembership />} />
            <Route path="/admin/login" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}
