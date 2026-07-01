import { supabase } from './supabaseClient';

export async function fetchPointsPaused(): Promise<boolean> {
    const { data, error } = await supabase
        .from('app_settings')
        .select('points_paused')
        .eq('id', 1)
        .maybeSingle();

    if (error) {
        console.error('Failed to fetch app_settings:', error);
        return false;
    }
    return data?.points_paused ?? false;
}

export async function setPointsPaused(paused: boolean): Promise<string | null> {
    const { error } = await supabase.rpc('set_points_paused', { p_paused: paused });
    if (error) {
        console.error('Failed to set points_paused:', error);
        return error.message;
    }
    return null;
}
