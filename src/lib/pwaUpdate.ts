import { registerSW } from 'virtual:pwa-register';

const listeners = new Set<() => void>();
let updatePending = false;

export const updateSW = registerSW({
    onNeedRefresh() {
        updatePending = true;
        listeners.forEach((fn) => fn());
    },
});

export function onPwaNeedRefresh(cb: () => void) {
    listeners.add(cb);
    if (updatePending) cb();
    return () => {
        listeners.delete(cb);
    };
}

export function applyPwaUpdate() {
    void updateSW(true);
}
