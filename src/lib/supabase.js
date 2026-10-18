import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://poyxlifxzqntlmjuvhsb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_s0pnPd_WqZ3vK_PoljcI2w_GdHBLzDu';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});