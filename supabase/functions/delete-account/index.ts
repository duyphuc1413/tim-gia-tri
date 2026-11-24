import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.js";

/**
 * Xóa hoàn toàn tài khoản và toàn bộ dữ liệu liên quan (ON DELETE CASCADE)
 * theo yêu cầu của người dùng (Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân).
 */
Deno.serve(async (req) => {
  const siteUrl = (Deno.env.get("SITE_URL") || "").replace(/\/+$/, "");
  const cors = getCorsHeaders(req, siteUrl);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, cors);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse({ error: "Máy chủ chưa được cấu hình đầy đủ." }, 500, cors);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Bạn cần đăng nhập để thực hiện thao tác này." }, 401, cors);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse({ error: "Phiên đăng nhập không hợp lệ." }, 401, cors);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { error: delErr } = await admin.auth.admin.deleteUser(userData.user.id);
  if (delErr) {
    console.error("Delete user error:", delErr);
    return jsonResponse({ error: "Không xóa được tài khoản lúc này. Vui lòng thử lại." }, 500, cors);
  }

  return jsonResponse({ ok: true }, 200, cors);
});
