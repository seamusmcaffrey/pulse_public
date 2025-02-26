import { sendInitialEmail } from "../dist/lib/email.js";

async function main() {
  try {
    const testEmail = {
      expertName: "Test Expert",
      expertEmail: "sean.w.meehan@gmail.com",
      articleTitle: "Test Article for Email Parsing",
      articleId: "test-123"
    };

    console.log('Sending test email...');
    const result = await sendInitialEmail(testEmail);
    console.log('Email sent:', result);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

main(); 