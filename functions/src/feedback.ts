import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import * as nodemailer from "nodemailer";

const gmailUser = defineSecret("GMAIL_USER");
const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");

const TYPE_LABELS: Record<string, string> = {
  bug: "🐛 버그 신고",
  feature: "💡 기능 요청",
  question: "❓ 문의",
  other: "💬 기타",
};

export const onFeedbackCreate = onDocumentCreated(
  {
    document: "feedback/{feedbackId}",
    secrets: [gmailUser, gmailAppPassword],
    region: "us-central1",
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser.value(),
        pass: gmailAppPassword.value(),
      },
    });

    const typeLabel = TYPE_LABELS[data.type] || data.type;
    const nickname = data.nickname || "익명";
    const email = data.email || "없음";
    const createdAt = new Date(data.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

    await transporter.sendMail({
      from: `O-Rider <${gmailUser.value()}>`,
      to: gmailUser.value(),
      subject: `[O-Rider 피드백] ${typeLabel} - ${data.title}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px;">
          <h2 style="color: #ea580c;">${typeLabel}</h2>
          <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
            <tr><td style="padding: 8px; color: #888; width: 80px;">제목</td><td style="padding: 8px; font-weight: bold;">${data.title}</td></tr>
            <tr><td style="padding: 8px; color: #888;">닉네임</td><td style="padding: 8px;">${nickname}</td></tr>
            <tr><td style="padding: 8px; color: #888;">이메일</td><td style="padding: 8px;">${email}</td></tr>
            <tr><td style="padding: 8px; color: #888;">시간</td><td style="padding: 8px;">${createdAt}</td></tr>
          </table>
          <div style="margin-top: 16px; padding: 16px; background: #f9fafb; border-radius: 8px; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${data.body}</div>
          <p style="margin-top: 16px; font-size: 12px; color: #aaa;">ID: ${event.params.feedbackId}</p>
        </div>
      `,
    });
  }
);
