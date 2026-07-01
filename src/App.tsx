import { isStaffApp } from './lib/appMode';
import { StaffAppRoutes } from './App.staff';
import { MemberAppRoutes } from './App.member';
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt';

function App() {
    return (
        <>
            {isStaffApp ? <StaffAppRoutes /> : <MemberAppRoutes />}
            <PwaUpdatePrompt />
        </>
    );
}

export default App;
