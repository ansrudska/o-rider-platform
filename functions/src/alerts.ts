import { onAlertPublished } from "firebase-functions/v2/alerts";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import * as nodemailer from "nodemailer";
import * as admin from "firebase-admin";

const gmailUser = defineSecret("GMAIL_USER");
const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser.value(),
      pass: gmailAppPassword.value(),
    },
  });
}

const SEVERITY_STYLES: Record<string, { emoji: string; color: string; label: string }> = {
  error: { emoji: "\u{1F534}", color: "#dc2626", label: "\uC624\uB958" },
  warning: { emoji: "\u{1F7E1}", color: "#d97706", label: "\uACBD\uACE0" },
  info: { emoji: "\u{1F535}", color: "#2563eb", label: "\uC815\uBCF4" },
};

// ── Firebase Billing Alerts ──
export const onBillingAlert = onAlertPublished(
  {
    alertType: "billing.planAutomatedUpdate",
    secrets: [gmailUser, gmailAppPassword],
    region: "us-central1",
  },
  async (event) => {
    const payload = JSON.stringify(event.data?.payload || {}, null, 2);
    const time = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `O-Rider <${gmailUser.value()}>`,
      to: gmailUser.value(),
      subject: `[O-Rider] \u{1F4B0} Firebase \uBE4C\uB9C1 \uC54C\uB9BC`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px;">
          <h2 style="color: #dc2626;">\u{1F4B0} Firebase \uBE4C\uB9C1 \uC54C\uB9BC</h2>
          <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
            <tr><td style="padding: 8px; color: #888; width: 100px;">\uC2DC\uAC04</td><td style="padding: 8px;">${time}</td></tr>
          </table>
          <div style="margin-top: 16px; padding: 16px; background: #fef2f2; border-radius: 8px; font-size: 13px; font-family: monospace; white-space: pre-wrap; overflow-x: auto;">${payload}</div>
        </div>
      `,
    });
  }
);

// ── Crashlytics Alerts ──
export const onCrashlyticsAlert = onAlertPublished(
  {
    alertType: "crashlytics.newFatalIssue",
    secrets: [gmailUser, gmailAppPassword],
    region: "us-central1",
  },
  async (event) => {
    const payload = JSON.stringify(event.data?.payload || {}, null, 2);
    const appId = event.appId || "N/A";
    const time = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `O-Rider <${gmailUser.value()}>`,
      to: gmailUser.value(),
      subject: `[O-Rider] \u{1F6A8} \uC571 \uCE58\uBA85\uC801 \uC624\uB958 (Crashlytics)`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px;">
          <h2 style="color: #dc2626;">\u{1F6A8} Crashlytics Fatal Issue</h2>
          <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
            <tr><td style="padding: 8px; color: #888; width: 100px;">\uC571 ID</td><td style="padding: 8px;">${appId}</td></tr>
            <tr><td style="padding: 8px; color: #888;">\uC2DC\uAC04</td><td style="padding: 8px;">${time}</td></tr>
          </table>
          <div style="margin-top: 16px; padding: 16px; background: #fef2f2; border-radius: 8px; font-size: 13px; font-family: monospace; white-space: pre-wrap; overflow-x: auto;">${payload}</div>
        </div>
      `,
    });
  }
);

// ── Performance Alerts ──
export const onPerformanceAlert = onAlertPublished(
  {
    alertType: "performance.threshold",
    secrets: [gmailUser, gmailAppPassword],
    region: "us-central1",
  },
  async (event) => {
    const payload = JSON.stringify(event.data?.payload || {}, null, 2);
    const appId = event.appId || "N/A";
    const time = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `O-Rider <${gmailUser.value()}>`,
      to: gmailUser.value(),
      subject: `[O-Rider] \u{26A1} \uC131\uB2A5 \uC784\uACC4\uAC12 \uCD08\uACFC (Performance)`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px;">
          <h2 style="color: #d97706;">\u{26A1} Performance Threshold Alert</h2>
          <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
            <tr><td style="padding: 8px; color: #888; width: 100px;">\uC571 ID</td><td style="padding: 8px;">${appId}</td></tr>
            <tr><td style="padding: 8px; color: #888;">\uC2DC\uAC04</td><td style="padding: 8px;">${time}</td></tr>
          </table>
          <div style="margin-top: 16px; padding: 16px; background: #fff7ed; border-radius: 8px; font-size: 13px; font-family: monospace; white-space: pre-wrap; overflow-x: auto;">${payload}</div>
        </div>
      `,
    });
  }
);

// ── Function Error/Warning Logger → Email ──
export const onErrorLogCreate = onDocumentCreated(
  {
    document: "error_logs/{logId}",
    secrets: [gmailUser, gmailAppPassword],
    region: "us-central1",
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const severity = data.severity || "error";
    const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.error;
    const time = new Date(data.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `O-Rider <${gmailUser.value()}>`,
      to: gmailUser.value(),
      subject: `[O-Rider] ${style.emoji} ${style.label}: ${data.source} - ${data.message?.slice(0, 80)}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px;">
          <h2 style="color: ${style.color};">${style.emoji} ${style.label}</h2>
          <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
            <tr><td style="padding: 8px; color: #888; width: 80px;">\uCD9C\uCC98</td><td style="padding: 8px; font-weight: bold;">${data.source}</td></tr>
            <tr><td style="padding: 8px; color: #888;">\uBA54\uC2DC\uC9C0</td><td style="padding: 8px;">${data.message}</td></tr>
            <tr><td style="padding: 8px; color: #888;">\uC2DC\uAC04</td><td style="padding: 8px;">${time}</td></tr>
            ${data.context ? `<tr><td style="padding: 8px; color: #888;">\uCEE8\uD14D\uC2A4\uD2B8</td><td style="padding: 8px; font-size: 13px;">${JSON.stringify(data.context)}</td></tr>` : ""}
          </table>
          ${data.stack ? `<div style="margin-top: 16px; padding: 16px; background: #fef2f2; border-radius: 8px; font-size: 12px; font-family: monospace; white-space: pre-wrap; overflow-x: auto; color: #991b1b;">${data.stack}</div>` : ""}
          <p style="margin-top: 16px; font-size: 12px; color: #aaa;">ID: ${event.params.logId}</p>
        </div>
      `,
    });
  }
);

// ── Utility: log error/warning to Firestore (triggers email) ──
export async function logError(
  source: string,
  error: unknown,
  context?: Record<string, unknown>
) {
  const db = admin.firestore();
  const errMsg = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  await db.collection("error_logs").add({
    source,
    severity: "error",
    message: errMsg,
    stack,
    context: context || {},
    createdAt: Date.now(),
  });
}

export async function logWarning(
  source: string,
  message: string,
  context?: Record<string, unknown>
) {
  const db = admin.firestore();
  await db.collection("error_logs").add({
    source,
    severity: "warning",
    message,
    context: context || {},
    createdAt: Date.now(),
  });
}
