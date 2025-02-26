import type { VercelRequest, VercelResponse } from "./types";
import { sendInitialEmail } from "../src/lib/email";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const testEmail = {
      expertName: "Test Expert",
      expertEmail: req.body.email || "your-email@example.com",
      articleTitle: "Test Article",
      articleId: "test-123"
    };

    const result = await sendInitialEmail(testEmail);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Test email error:", error);
    return res.status(500).json({ error: "Failed to send test email" });
  }
} 