import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rifccksampnzisgiqfrm.supabase.co';
const supabaseAnonKey = 'sb_publishable_56cA0aB02M0yBDz-8J9IXA_2D2yD9-3';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);