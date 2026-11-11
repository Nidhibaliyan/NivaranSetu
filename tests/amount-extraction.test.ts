import { extractFactsFromGrievanceText } from '../src/components/CaseBuilder';

// -------------------------------------------------------------
// NivaranSetu Fact & Amount Extraction Unit Tests
// -------------------------------------------------------------

console.log('=== NivaranSetu Fact & Amount Extraction Test Suite ===\n');

let failedCount = 0;
let passedCount = 0;

function assert(condition: boolean, testName: string, actual?: any, expected?: any) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`[FAIL] ${testName} | Expected: ${JSON.stringify(expected)} | Got: ${JSON.stringify(actual)}`);
    failedCount++;
  }
}

// -------------------------------------------------------------
// Test 1: User's Actual Test Complaint
// -------------------------------------------------------------
console.log('--- Test 1: Complete User Complaint ---');
const testComplaint =
  'Hello, I want to file a complaint against HDFC Bank. On 5 November 2026, an amount of Rs. 4500 was deducted from my savings account through an unauthorized UPI transaction. I did not make this payment or approve it. The transaction happened in Noida, Uttar Pradesh. I contacted customer care, but my money has not been refunded.';

const result = extractFactsFromGrievanceText(testComplaint);

assert(
  result.category === 'banking_financial',
  'Extracts Category: Banking / Financial',
  result.category,
  'banking_financial'
);

assert(
  result.involvedEntity === 'HDFC Bank',
  'Extracts Entity: HDFC Bank',
  result.involvedEntity,
  'HDFC Bank'
);

assert(
  result.disputedAmount === 4500,
  'Extracts Disputed Amount: 4500',
  result.disputedAmount,
  4500
);

assert(
  result.incidentDate === '2026-11-05',
  'Extracts Incident Date: 2026-11-05',
  result.incidentDate,
  '2026-11-05'
);

assert(
  result.incidentLocation === 'Noida, Uttar Pradesh',
  'Extracts Incident Location: Noida, Uttar Pradesh',
  result.incidentLocation,
  'Noida, Uttar Pradesh'
);

// -------------------------------------------------------------
// Test 2: Four Required Amount Formats
// -------------------------------------------------------------
console.log('\n--- Test 2: Four Required Amount Formats ---');

const amountFormatTests = [
  {
    format: 'Rs. 4500',
    text: 'On 5 November 2026, an amount of Rs. 4500 was deducted from my savings account.',
    expected: 4500,
  },
  {
    format: 'Rs 4,500',
    text: 'On 5 November 2026, an amount of Rs 4,500 was deducted from my savings account.',
    expected: 4500,
  },
  {
    format: 'INR 4500',
    text: 'On 5 November 2026, an amount of INR 4500 was deducted from my savings account.',
    expected: 4500,
  },
  {
    format: '₹4,500',
    text: 'On 5 November 2026, an amount of ₹4,500 was deducted from my savings account.',
    expected: 4500,
  },
];

for (const t of amountFormatTests) {
  const extracted = extractFactsFromGrievanceText(t.text);
  assert(
    extracted.disputedAmount === t.expected,
    `Format Support: "${t.format}" -> ${t.expected}`,
    extracted.disputedAmount,
    t.expected
  );
}

// Additional common Indian currency formats
console.log('\n--- Test 3: Additional Common Currency Notations ---');
const additionalFormats = [
  {
    format: '4500 rupees',
    text: 'I lost 4500 rupees due to unauthorized transaction.',
    expected: 4500,
  },
  {
    format: '4,500/-',
    text: 'The total unauthorized deduction was 4,500/-.',
    expected: 4500,
  },
  {
    format: 'deducted 4500',
    text: 'The bank deducted 4500 without OTP confirmation.',
    expected: 4500,
  },
  {
    format: '₹12,499.50 (with decimals)',
    text: 'An unauthorized debit of ₹12,499.50 was made from my card.',
    expected: 12499.5,
  },
];

for (const t of additionalFormats) {
  const extracted = extractFactsFromGrievanceText(t.text);
  assert(
    extracted.disputedAmount === t.expected,
    `Additional Format: "${t.format}" -> ${t.expected}`,
    extracted.disputedAmount,
    t.expected
  );
}

// -------------------------------------------------------------
// Test 4: Absence of Amount (Do NOT Invent)
// -------------------------------------------------------------
console.log('\n--- Test 4: Absence of Amount (Do NOT Invent) ---');
const nonMonetaryComplaints = [
  'My credit card was blocked without any prior notice and customer service is refusing to unblock it.',
  'The broadband fiber cable in our society has been broken for 5 days and internet is not working.',
  'Delivery executive marked my parcel as delivered but I never received the physical shipment.',
];

for (const text of nonMonetaryComplaints) {
  const extracted = extractFactsFromGrievanceText(text);
  assert(
    extracted.disputedAmount === undefined,
    `Amount remains undefined when not stated: "${text.slice(0, 45)}..."`,
    extracted.disputedAmount,
    undefined
  );
}

console.log(`\n======================================================`);
console.log(`Results: ${passedCount} passed, ${failedCount} failed.`);
console.log(`======================================================\n`);

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
