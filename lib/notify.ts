import "server-only";
import { Resend } from "resend";
import { SITE_NAME, TURNAROUND } from "./site";

// Outbound messages to families. Never log the address or number — only the outcome.

export async function sendReceived(method: "email" | "sms", to: string) {
  const text =
    `We got your contract. A contract reviewer will go through it and send your free review within ${TURNAROUND}. ` +
    `— ${SITE_NAME}`;
  try {
    if (method === "email") await sendEmail(to, `We got your contract — ${SITE_NAME}`, text);
    else await sendSms(to, text);
    return true;
  } catch (err) {
    console.error(`notify: ${method} confirmation failed:`, err instanceof Error ? err.message : "unknown error");
    return false;
  }
}

async function sendEmail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM; // e.g. "Funeral Contract Review <reviews@yourdomain.com>"
  if (!key || !from) throw new Error("RESEND_API_KEY / EMAIL_FROM not set");
  const { error } = await new Resend(key).emails.send({ from, to, subject, text });
  if (error) throw new Error(error.message);
}

// RingCentral SMS via JWT auth (https://developers.ringcentral.com/guide/messaging/sms).
async function sendSms(to: string, text: string) {
  const { RC_SERVER_URL, RC_CLIENT_ID, RC_CLIENT_SECRET, RC_JWT, RC_FROM_NUMBER } = process.env;
  if (!RC_CLIENT_ID || !RC_CLIENT_SECRET || !RC_JWT || !RC_FROM_NUMBER) throw new Error("RingCentral env not set");
  const server = RC_SERVER_URL ?? "https://platform.ringcentral.com";

  const tokenRes = await fetch(`${server}/restapi/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${RC_CLIENT_ID}:${RC_CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: RC_JWT }),
  });
  if (!tokenRes.ok) throw new Error(`RingCentral auth ${tokenRes.status}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const smsRes = await fetch(`${server}/restapi/v1.0/account/~/extension/~/sms`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: { phoneNumber: RC_FROM_NUMBER }, to: [{ phoneNumber: to }], text }),
  });
  if (!smsRes.ok) throw new Error(`RingCentral SMS ${smsRes.status}`);
}
