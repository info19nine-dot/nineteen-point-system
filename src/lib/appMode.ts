import { STAFF_LOGIN_PATH } from './routes';

export type AppMode = 'member' | 'staff';

export const APP_MODE: AppMode =
    import.meta.env.VITE_APP_MODE === 'staff' ? 'staff' : 'member';

export const isStaffApp = APP_MODE === 'staff';
export const isMemberApp = APP_MODE === 'member';

/** Default path after logout for this build */
export const DEFAULT_LOGOUT_PATH = isStaffApp ? STAFF_LOGIN_PATH : '/login';

/** Default path when opening the app from home screen */
export const DEFAULT_HOME_PATH = DEFAULT_LOGOUT_PATH;
