// /api/contact.js
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { name, hospital, phone, email, message, page } = req.body || {};
    if (!name || !hospital || !phone || !email)
      return res.status(400).json({ error: "필수 항목 누락" });

    // SMTP 설정: Vercel 환경변수에 설정
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,          // 예: smtp.gmail.com, smtp.worksmobile.com 등
      port: Number(process.env.SMTP_PORT),  // 예: 465 또는 587
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,        // 발신 계정 ID
        pass: process.env.SMTP_PASS         // 발신 계정 비밀번호/앱비번
      }
    });

    const to = process.env.TO_EMAIL || "contact@mediswich.co.kr";
    const subject = `웹 문의 접수: ${hospital} / ${name}`;
    const plain = [
      `이름: ${name}`,
      `병원/회사: ${hospital}`,
      `연락처: ${phone}`,
      `이메일: ${email}`,
      `페이지: ${page || ""}`,
      "",
      `문의내용:`,
      `${message || ""}`
    ].join("\n");

    const html = `
      <h2>메디스위치 웹 문의</h2>
      <p><b>이름:</b> ${escapeHtml(name)}</p>
      <p><b>병원/회사:</b> ${escapeHtml(hospital)}</p>
      <p><b>연락처:</b> ${escapeHtml(phone)}</p>
      <p><b>이메일:</b> ${escapeHtml(email)}</p>
      <p><b>페이지:</b> ${escapeHtml(page || "")}</p>
      <p><b>문의내용:</b><br>${escapeHtml(message || "").replace(/\n/g,"<br>")}</p>
    `;

    await transporter.sendMail({
      from: `"Mediswich Web" <${process.env.SMTP_USER || to}>`,
      to,
      replyTo: email,
      subject,
      text: plain,
      html
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "서버 오류" });
  }
}

// 간단 XSS 방지
function escapeHtml(s="") {
  return s.replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}

