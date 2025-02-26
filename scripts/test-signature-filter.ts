import fetch from 'node-fetch';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function testSignatureFilter() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase configuration');
    return;
  }

  // Test cases with different variations of content and signature
  const testCases = [
    {
      name: 'Basic signature at end',
      content: `This is a test comment about the article.

*Neena Saha, PhD* *LinkedIn Profile * *Literacy Expert & Educational Consultant * *Founder & CEO,* Elemenoâ¢ (acquired by MetaMetrics, Inc.) *Watch* This month's Reading Research Recap ! Author,* The Reading Research Recap * Guest Episode: Science of Reading: The Podcast`
    },
    {
      name: 'Signature with extra content',
      content: `Here's my thoughts on the methodology.
Some additional points about the sample size.

*Neena Saha, PhD* *LinkedIn Profile * *Literacy Expert & Educational Consultant * *Founder & CEO,* Elemenoâ¢ (acquired by MetaMetrics, Inc.) *Watch* This month's Reading Research Recap ! Author,* The Reading Research Recap * Guest Episode: Science of Reading: The Podcast

Thanks!`
    },
    {
      name: 'Multiple paragraphs with signature',
      content: `First paragraph with initial thoughts.

Second paragraph with more detailed analysis.

Third paragraph with conclusions.

*Neena Saha, PhD* *LinkedIn Profile * *Literacy Expert & Educational Consultant * *Founder & CEO,* Elemenoâ¢ (acquired by MetaMetrics, Inc.) *Watch* This month's Reading Research Recap ! Author,* The Reading Research Recap * Guest Episode: Science of Reading: The Podcast`
    }
  ];

  // Fetch Neena's signature from the database
  const expertResponse = await fetch(
    `${supabaseUrl}/rest/v1/experts?select=signature&email=eq.saha.neena@gmail.com`,
    {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }
  );

  if (!expertResponse.ok) {
    console.error('Failed to fetch expert signature');
    return;
  }

  const expertData = await expertResponse.json();
  if (!expertData?.[0]?.signature) {
    console.error('No signature found for expert');
    return;
  }

  const signature = expertData[0].signature;
  console.log('\nFetched signature from database:', signature);

  // Test each case
  console.log('\nTesting signature removal...\n');
  for (const testCase of testCases) {
    console.log(`\n=== Test Case: ${testCase.name} ===`);
    console.log('Original content:');
    console.log(testCase.content);
    
    // Remove signature
    const contentWithoutSignature = testCase.content.replace(signature, '').trim();
    
    console.log('\nContent after signature removal:');
    console.log(contentWithoutSignature);
    console.log('\nSignature was ' + (contentWithoutSignature !== testCase.content ? 'successfully removed' : 'not found'));
    console.log('===============================\n');
  }
}

// Run the test
console.log('Starting signature filter test...');
testSignatureFilter().catch(console.error); 