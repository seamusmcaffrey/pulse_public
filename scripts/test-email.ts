import { sendInitialEmail } from "../src/lib/email.ts";
import { supabase } from "../src/lib/supabase.ts";

async function main() {
  const recipient = {
    expertName: "Seamus",
    expertEmail: "sean.w.meehan@gmail.com",
    articleTitle: "Test Article for Multiple Replies",
    articleId: "012c1834-c1a0-4d06-a224-8edd77fc3a62"
  };

  try {
    const result = await sendInitialEmail(recipient);
    console.log(`Email sent successfully to ${recipient.expertEmail}:`, result);
  } catch (error) {
    console.error(`Failed to send email to ${recipient.expertEmail}:`, error);
  }
}

main(); 