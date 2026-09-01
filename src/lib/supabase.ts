import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://znvtclgwekvtxlueyocl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpudnRjbGd3ZWt2dHhsdWV5b2NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNjM4NDEsImV4cCI6MjEwMzgzOTg0MX0.RiR6CE6rmYlmB1Ad_SL_e-Xwvwo13wEBID4Jq7YlNtw'; // Replace with your actual anon key

export const supabase = createClient(supabaseUrl, supabaseAnonKey);