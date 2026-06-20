import { createClient } from "@supabase/supabase-js";

// Vercel の環境変数（VITE_ で始まると、ブラウザ側のコードから読めます）。
// anon キーは公開してよい鍵で、データは Supabase 側の RLS（行レベルセキュリティ）で守ります。
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 未設定なら null。その場合アプリは従来どおり「端末保存（ログインなし）」で動きます。
export const supabase = url && key ? createClient(url, key) : null;
