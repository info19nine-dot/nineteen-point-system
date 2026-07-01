import { isStaffApp } from './lib/appMode';
import { StaffAppRoutes } from './App.staff';
import { MemberAppRoutes } from './App.member';

function App() {
    return isStaffApp ? <StaffAppRoutes /> : <MemberAppRoutes />;
}

export default App;
