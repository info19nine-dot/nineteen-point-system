import { registerSW } from 'virtual:pwa-register';

const UPDATE_CHECK_MS = 30 * 60 * 1000;

async function checkRemoteBuildId() {
    try {
        const res = await fetch(`/version.json?${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const { buildId } = (await res.json()) as { buildId?: string };
        if (buildId && buildId !== __APP_BUILD_ID__) {
            window.location.reload();
        }
    } catch {
        /* offline */
    }
}

export const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
        if (!registration) return;

        void registration.update();
        window.setInterval(() => void registration.update(), UPDATE_CHECK_MS);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                void registration.update();
                void checkRemoteBuildId();
            }
        });
    },
});

void checkRemoteBuildId();
