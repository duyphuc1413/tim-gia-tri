import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.js";

interface AnalysisPayload {
  ranking?: string[];
  antis?: string[];
  definitions?: Record<string, { def?: string; act?: string }>;
  experiences?: Array<{ label?: string; text?: string }>;
}

interface ReportSection {
  title: string;
  body: string;
}

interface DeepReport {
  mode: "gemini" | "openai" | "structured";
  generatedAt: string;
  headline: string;
  sections: ReportSection[];
}

function buildFallbackReport(input: AnalysisPayload): DeepReport {
  const rank = (input.ranking || []).slice(0, 5);
  const antis = (input.antis || []).slice(0, 5);
  const top1 = rank[0] || "giá trị cốt lõi số 1";
  const top2 = rank[1] || "giá trị cốt lõi số 2";
  const top3 = rank[2] || "giá trị cốt lõi số 3";
  const expCount = (input.experiences || []).filter((e) => e && e.text).length;

  return {
    mode: "structured",
    generatedAt: new Date().toISOString(),
    headline: `Trục định vị: ${top1} dẫn đường, ${top2} làm nền`,
    sections: [
      {
        title: "1. Bản sắc cốt lõi từ bằng chứng sống",
        body:
          `Qua ${expCount || "các"} khoảnh khắc bạn đã viết, hệ giá trị của bạn xoay quanh bộ ba ${rank.slice(0, 3).join(" – ")}. ` +
          `Khi "${top1}" đứng ở vị trí #1, đây không chỉ là điều bạn thích mà là tiêu chuẩn tối thiểu để bạn cảm thấy mình đang sống thật. ` +
          `Mọi quyết định lớn về công việc hay mối quan hệ nếu đi ngược "${top1}" sẽ sớm tạo ra cảm giác bứt rứt dù bên ngoài trông có vẻ thành công.`
      },
      {
        title: `2. Điểm căng nội tâm giữa "${top1}" và "${top2}"`,
        body:
          `Trong đời thực, hai giá trị đứng đầu hiếm khi lúc nào cũng đi cùng một hướng. Hãy tự hỏi trong 30 ngày qua: ` +
          `có tình huống nào việc bảo vệ "${top1}" khiến bạn vô tình bỏ bê "${top2}" (hoặc "${top3}") không? ` +
          `Thay vì chọn tất cả, hãy thiết kế một ranh giới rõ ràng: lịch cố định cho "${top2}" để "${top1}" không nuốt trọn năng lượng của bạn.`
      },
      {
        title: "3. Bẫy kiệt sức & ranh giới đỏ cần giữ",
        body: antis.length
          ? `Những điều bạn không chịu nổi (${antis.join(", ")}) chính là hệ thống báo động sớm. ` +
            `Khi môi trường làm việc hoặc một mối quan hệ lặp đi lặp lại các dấu hiệu này, năng lượng của bạn sẽ tụt nhanh dù khối lượng việc không lớn. ` +
            `Hãy coi đây là bộ lọc "không thương lượng" khi chọn dự án, sếp hoặc đối tác mới.`
          : `Hãy quay lại Bước 4 để chọn thêm 2–3 điều bạn không chịu nổi — đó là cách nhanh nhất để phát hiện ranh giới đỏ giúp bạn tránh kiệt sức.`
      },
      {
        title: "4. La bàn hành động trong 7 ngày tới",
        body:
          `Chọn duy nhất 1 hành động nhỏ dưới 30 phút cho "${top1}" và đặt lịch cố định vào ngày mai. ` +
          `Cuối tuần này, dùng thẻ Check-in trong bảng Pro để tự chấm điểm 1–5 cho từng giá trị trong Top 5 — chỉ sau 4 tuần, bạn sẽ thấy rõ mình đang sống lệch ở đâu.`
      }
    ]
  };
}

function buildPrompt(input: AnalysisPayload): string {
  const rank = (input.ranking || []).slice(0, 5);
  const antis = (input.antis || []).slice(0, 6);
  const defs = input.definitions || {};
  const exps = (input.experiences || []).slice(0, 6);

  const rankText = rank
    .map((v, i) => {
      const d = defs[v] || {};
      return `#${i + 1} ${v}${d.def ? ` — Định nghĩa: ${d.def}` : ""}${d.act ? ` — Hành động tuần này: ${d.act}` : ""}`;
    })
    .join("\n");

  const expText = exps
    .filter((e) => e && e.text)
    .map((e) => `- ${e.label || "Khoảnh khắc"}: ${String(e.text).slice(0, 350)}`)
    .join("\n");

  return `Bạn là chuyên gia khai vấn (Life & Career Coach) người Việt Nam, sắc sảo, ấm áp, thực tế, không sáo rỗng.
Dựa trên bảng giá trị cốt lõi thật của người dùng dưới đây, hãy viết một bản luận giải cá nhân hóa sâu sắc bằng tiếng Việt.

TOP 5 GIÁ TRỊ CỐT LÕI:
${rankText || "(chưa có)"}

NHỮNG ĐIỀU KHÔNG CHỊU NỔI (ANTI-VALUES):
${antis.join(", ") || "(chưa chọn)"}

BẰNG CHỨNG SỐNG (BƯỚC 1):
${expText || "(chưa ghi)"}

Trả về DUY NHẤT JSON hợp lệ (không markdown fence) theo đúng schema:
{
  "headline": "Một câu định vị ngắn gọn, đắt giá (dưới 18 từ)",
  "sections": [
    { "title": "1. Bản sắc cốt lõi từ bằng chứng sống", "body": "3-4 câu phân tích sâu gắn trực tiếp với bằng chứng sống của họ" },
    { "title": "2. Điểm căng nội tâm & điểm mù cần soi", "body": "3-4 câu chỉ ra xung đột tiềm ẩn giữa giá trị #1 và #2/#3" },
    { "title": "3. Bẫy kiệt sức & môi trường phù hợp", "body": "3-4 câu nối anti-values với môi trường làm việc/quan hệ nên tránh và nên chọn" },
    { "title": "4. Gợi ý thực hành đắt giá trong 30 ngày tới", "body": "3-4 câu cụ thể, đo được, bám sát định nghĩa của họ" }
  ]
}`;
}

function parseJsonReport(text: string): { headline: string; sections: ReportSection[] } | null {
  try {
    const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    if (
      parsed &&
      typeof parsed.headline === "string" &&
      Array.isArray(parsed.sections) &&
      parsed.sections.length >= 3
    ) {
      return {
        headline: parsed.headline.slice(0, 200),
        sections: parsed.sections.slice(0, 6).map((s: Record<string, unknown>) => ({
          title: String(s.title || "").slice(0, 140),
          body: String(s.body || "").slice(0, 1500)
        }))
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function callGemini(prompt: string, apiKey: string): Promise<DeepReport | null> {
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    })
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") return null;
  const parsed = parseJsonReport(text);
  if (!parsed) return null;
  return {
    mode: "gemini",
    generatedAt: new Date().toISOString(),
    headline: parsed.headline,
    sections: parsed.sections
  };
}

async function callOpenAI(prompt: string, apiKey: string): Promise<DeepReport | null> {
  const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Bạn là chuyên gia khai vấn giá trị cốt lõi người Việt Nam. Luôn trả về JSON hợp lệ." },
        { role: "user", content: prompt }
      ]
    })
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  const text = json?.choices?.[0]?.message?.content;
  if (typeof text !== "string") return null;
  const parsed = parseJsonReport(text);
  if (!parsed) return null;
  return {
    mode: "openai",
    generatedAt: new Date().toISOString(),
    headline: parsed.headline,
    sections: parsed.sections
  };
}

Deno.serve(async (req) => {
  const siteUrl = (Deno.env.get("SITE_URL") || "").replace(/\/+$/, "");
  const cors = getCorsHeaders(req, siteUrl);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, cors);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse({ error: "Máy chủ chưa được cấu hình." }, 500, cors);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Bạn cần đăng nhập để xem luận giải chuyên sâu." }, 401, cors);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse({ error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." }, 401, cors);
  }

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: profile } = await adminClient
    .from("profiles")
    .select("trial_ends_at, paid_until")
    .eq("id", userData.user.id)
    .maybeSingle();

  const nowMs = Date.now();
  const paidMs = profile?.paid_until ? new Date(profile.paid_until).getTime() : 0;
  const trialMs = profile?.trial_ends_at ? new Date(profile.trial_ends_at).getTime() : 0;
  if (paidMs <= nowMs && trialMs <= nowMs) {
    return jsonResponse({ error: "Tính năng này dành cho tài khoản Tìm Giá Trị Pro." }, 403, cors);
  }

  let body: AnalysisPayload = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Dữ liệu không hợp lệ." }, 400, cors);
  }

  if (!Array.isArray(body.ranking) || body.ranking.length < 3) {
    return jsonResponse({ error: "Cần ít nhất 3 giá trị đã xếp hạng để phân tích." }, 400, cors);
  }

  const prompt = buildPrompt(body);
  const geminiKey = Deno.env.get("GEMINI_API_KEY") || "";
  const openaiKey = Deno.env.get("OPENAI_API_KEY") || "";

  let report: DeepReport | null = null;
  if (geminiKey) {
    report = await callGemini(prompt, geminiKey);
  }
  if (!report && openaiKey) {
    report = await callOpenAI(prompt, openaiKey);
  }
  if (!report) {
    report = buildFallbackReport(body);
  }

  return jsonResponse({ report }, 200, cors);
});
