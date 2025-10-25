// /web/api/contact.js
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method === "GET") return res.status(200).json({ ok: true, hint: "POST to this endpoint" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    // 1) 입력 검증
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { name, hospital, phone, email, message, page } = body;
    if (!name || !hospital || !phone || !email) return res.status(400).json({ error: "필수 항목 누락" });

    // 2) 환경변수 검증
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 465);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const to   = process.env.TO_EMAIL || "contact@mediswich.co.kr";
    if (!host || !port || !user || !pass) return res.status(500).json({ error: "ENV_MISSING" });

    // 3) SMTP 연결
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,            // 465=SSL, 587=STARTTLS
      auth: { user, pass },
      // 네이버웍스 인증서 문제 회피가 필요할 때만 아래 한 줄을 잠시 사용
      // tls: { rejectUnauthorized: false }
    });

    // 자격 검증(여기서 많이 실패함: Invalid login, CERT 등)
    await transporter.verify();

    // 4) 메일 발송
    const subject = `웹 문의 접수: ${hospital} / ${name}`;
    const text = [
      `이름: ${name}`,
      `병원/회사: ${hospital}`,
      `연락처: ${phone}`,
      `이메일: ${email}`,
      `페이지: ${page || ""}`,
      "",
      "문의내용:",
      (message || "")
    ].join("\n");

    await transporter.sendMail({
      from: `"Mediswich Web" <${user}>`, // 일부 SMTP는 From=로그인계정 요구
      to,
      replyTo: email,
      subject,
      text
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    // Vercel Functions 로그에서 확인 가능
    console.error("MAIL_ERR", { message: e.message, code: e.code, command: e.command, response: e.response });
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}


