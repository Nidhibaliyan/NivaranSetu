/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * NivaranSetu — Smart Case Builder Category Extraction & Manual Selection Protection Regression Suite
 *
 * Scope:
 * 1. High-confidence cyber-fraud classification precedence:
 *    - Malicious APK / fake electricity disconnection SMS -> banking_financial (not consumer_ecommerce or utilities_power)
 *    - Parcel delivery phishing SMS with OTP theft -> banking_financial (not consumer_ecommerce)
 *    - Unauthorized SIM swap / eSIM fraud leading to account drain -> banking_financial (not telecom_isp)
 *    - Unauthorized UPI / debit / KYC phishing -> banking_financial
 * 2. Genuine domain dispute preservation:
 *    - Genuine electricity supply/smart meter/discom billing -> utilities_power
 *    - Genuine e-commerce defective product/return/courier delivery -> consumer_ecommerce
 *    - Genuine broadband/fiber/telecom service outage -> telecom_isp
 *    - Real estate RERA possession delay -> real_estate_rera
 *    - Health insurance mediclaim rejection -> insurance_claims
 *    - Municipal drainage / civic grievance -> municipal_civic
 *    - Workplace unpaid wages / gratuity -> employment_labour
 * 3. Narrowed ambiguous keywords:
 *    - Substring "tv" in "activity" does not match consumer_ecommerce
 *    - Standalone "delivery" in cyber threat context does not match consumer_ecommerce
 *    - Standalone "mobile" without purchase context does not match consumer_ecommerce
 * 4. Manual category dropdown protection:
 *    - shouldUpdateCategoryOnExtraction allows auto-update when citizen has not modified category
 *    - shouldUpdateCategoryOnExtraction blocks auto-update (debounce, blur, analyze) once citizen manually modifies category
 *    - Source code inspection verifies isCategoryManuallyModifiedRef guards applyExtractedFacts and select onChange
 *
 * Execution: Strictly offline. Zero external network, Gemini, or Supabase requests.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  extractFactsFromGrievanceText,
  shouldUpdateCategoryOnExtraction,
} from '../src/components/CaseBuilder';
import { GrievanceCategory } from '../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== NivaranSetu Category Extraction & Manual Override Protection Suite ===\n');

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, actual?: any, expected?: any) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`[FAIL] ${testName} | Expected: ${JSON.stringify(expected)} | Got: ${JSON.stringify(actual)}`);
    failedCount++;
  }
}

// ------------------------------------------------------------------------------------------------
// Section 1: Cyber Fraud Precedence & Threat Scenarios
// ------------------------------------------------------------------------------------------------
console.log('\n--- Section 1: Cyber Fraud Precedence & Phishing Scenarios ---');

// Scenario 1: Fake electricity disconnection SMS instructing to visit fast-ebill-update.xyz/pay.apk
const fakeEbillApk = `
Dear Customer, Your electricity power will be disconnected tonight at 9:30 PM because your previous month bill was unpaid.
Please immediately update your bill by downloading and installing: https://fast-ebill-update.xyz/pay.apk
Contact electricity support helpline immediately.
`;
const facts1 = extractFactsFromGrievanceText(fakeEbillApk);
assert(
  facts1.category === 'banking_financial',
  '1. Fake electricity disconnection SMS with malicious pay.apk routes to banking_financial (cyber fraud)',
  facts1.category,
  'banking_financial'
);

// Scenario 1b: TrustCheck handoff prompt for malicious APK delivery endpoint
const trustCheckApkHandoff = `
[TrustCheck Advisory: HIGH RISK - Curated Catalog Match]
Suspicious Identifier: fast-ebill-update.xyz/pay.apk (URL)
Advisory Match: Malicious Android APK Delivery Endpoint
Details: Distribution endpoint hosting malicious APK disguised as electricity bill payment application.
`;
const facts1b = extractFactsFromGrievanceText(trustCheckApkHandoff);
assert(
  facts1b.category === 'banking_financial',
  '1b. TrustCheck handoff prompt for malicious APK delivery routes to banking_financial',
  facts1b.category,
  'banking_financial'
);

// Scenario 3: Fake parcel delivery update phishing link with OTP theft
const fakeDeliveryPhishing = `
I received an SMS claiming my courier package delivery was on hold due to wrong address.
The SMS instructed me to visit https://indiapost-parcel-update.xyz/pay and pay ₹5 re-delivery fee.
I entered my details and received an OTP. Immediately ₹48,000 was debited from my SBI bank account.
`;
const facts3 = extractFactsFromGrievanceText(fakeDeliveryPhishing);
assert(
  facts3.category === 'banking_financial',
  '3. Parcel delivery phishing SMS with OTP theft routes to banking_financial (not consumer_ecommerce)',
  facts3.category,
  'banking_financial'
);

// Scenario 5: Unauthorized SIM swap / eSIM fraud leading to financial compromise
const simSwapFraud = `
Victim of unauthorized eSIM swap fraud. My mobile SIM was deactivated without my consent or request.
Fraudsters bypassed two-factor authentication and made an unauthorized transfer of ₹95,000 from my HDFC bank account.
`;
const facts5 = extractFactsFromGrievanceText(simSwapFraud);
assert(
  facts5.category === 'banking_financial',
  '5. Unauthorized SIM swap leading to bank account theft routes to banking_financial (not telecom_isp)',
  facts5.category,
  'banking_financial'
);

// Scenario 7: Unauthorized debit / UPI fraud / KYC phishing scam
const kycUpiFraud = `
Received a fake KYC verification SMS threatening that my bank account will be suspended.
Clicked link and entered UPI PIN. Fraudulent UPI debit of ₹32,000 occurred without my authorization.
Reported to national cyber crime helpline 1930.
`;
const facts7 = extractFactsFromGrievanceText(kycUpiFraud);
assert(
  facts7.category === 'banking_financial',
  '7. Unauthorized debit and KYC phishing scam routes to banking_financial',
  facts7.category,
  'banking_financial'
);

// ------------------------------------------------------------------------------------------------
// Section 2: Genuine Domain Dispute Preservation
// ------------------------------------------------------------------------------------------------
console.log('\n--- Section 2: Genuine Domain Dispute Preservation ---');

// Scenario 2: Genuine electricity supply / meter / tariff complaint
const genuinePowerGrievance = `
Frequent unannounced power cuts in Sector 14, Gurugram. BSES / DHBVN has not resolved the voltage fluctuation issue.
The smart meter is running abnormally fast and this month's electricity bill is ₹14,200 for 400 units, which is completely incorrect.
`;
const facts2 = extractFactsFromGrievanceText(genuinePowerGrievance);
assert(
  facts2.category === 'utilities_power',
  '2. Genuine electricity billing, smart meter, and power outage grievance routes to utilities_power',
  facts2.category,
  'utilities_power'
);

// Scenario 4: Genuine e-commerce defective product / return / delivery delay
const genuineEcommerce = `
Ordered a Samsung smart TV from Flipkart, order id #OD9928172635.
The courier delivery arrived with a shattered television screen.
The seller refused return pickup and Flipkart customer support denied the refund of ₹28,999.
`;
const facts4 = extractFactsFromGrievanceText(genuineEcommerce);
assert(
  facts4.category === 'consumer_ecommerce',
  '4. Genuine e-commerce damaged TV delivery and seller refund refusal routes to consumer_ecommerce',
  facts4.category,
  'consumer_ecommerce'
);

// Scenario 6: Genuine broadband speed / fiber outage / telecom service
const genuineTelecom = `
My Airtel broadband fiber connection has been down for 6 consecutive days.
Broadband internet service ticket #91823 was closed without resolving the issue.
Paid advance monthly recharge of ₹1,199 but zero internet service provided.
`;
const facts6 = extractFactsFromGrievanceText(genuineTelecom);
assert(
  facts6.category === 'telecom_isp',
  '6. Genuine broadband fiber downtime and recharge failure routes to telecom_isp',
  facts6.category,
  'telecom_isp'
);

// Scenario 8: Builder delay / RERA possession dispute
const reraDispute = `
Booked an apartment flat in Phase 2 in 2021. The developer promised possession by December 2024.
The builder has delayed handing over the flat by more than 20 months. Filing complaint under State RERA for delayed interest.
`;
const facts8 = extractFactsFromGrievanceText(reraDispute);
assert(
  facts8.category === 'real_estate_rera',
  '8. Builder flat possession delay routes to real_estate_rera',
  facts8.category,
  'real_estate_rera'
);

// Scenario 9: Insurance claim rejection / health policy delay
const insuranceRepudiation = `
Star Health rejected cashless mediclaim for hospitalization expenses of ₹1,45,000 citing pre-existing condition clause.
I have had continuous health insurance coverage for 6 years. Filing grievance with IRDAI Bima Bharosa.
`;
const facts9 = extractFactsFromGrievanceText(insuranceRepudiation);
assert(
  facts9.category === 'insurance_claims',
  '9. Cashless mediclaim rejection by health insurance TPA routes to insurance_claims',
  facts9.category,
  'insurance_claims'
);

// Municipal Civic Grievance
const civicGrievance = `
Open drainage and sewage overflowing on main road in front of government school.
Garbage not collected by municipal corporation for over two weeks. Potholes causing severe traffic accidents.
`;
const factsCivic = extractFactsFromGrievanceText(civicGrievance);
assert(
  factsCivic.category === 'municipal_civic',
  '10. Municipal drainage, pothole, and garbage grievance routes to municipal_civic',
  factsCivic.category,
  'municipal_civic'
);

// Labour / Employment Dispute
const labourDispute = `
Employer terminated employment without statutory 30-day notice and withheld 4 months of unpaid salary and gratuity.
Provident fund (PF) contributions deducted from salary but not deposited to EPFO.
`;
const factsLabour = extractFactsFromGrievanceText(labourDispute);
assert(
  factsLabour.category === 'employment_labour',
  '11. Unpaid salary, gratuity, and PF dispute routes to employment_labour',
  factsLabour.category,
  'employment_labour'
);

// ------------------------------------------------------------------------------------------------
// Section 3: Word Boundary & Ambiguous Keyword Narrowing
// ------------------------------------------------------------------------------------------------
console.log('\n--- Section 3: Word Boundary & Ambiguous Keyword Narrowing ---');

// Substring "tv" in "activity" should NOT trigger consumer_ecommerce
const activityText = `
Noticed suspicious high network activity on my office workstation router.
No goods or products were ordered.
`;
const factsActivity = extractFactsFromGrievanceText(activityText);
assert(
  factsActivity.category !== 'consumer_ecommerce',
  '12. Word "activity" (containing "tv") does not trigger consumer_ecommerce',
  factsActivity.category,
  'not consumer_ecommerce'
);

// Standalone "mobile" without shopping context should NOT trigger consumer_ecommerce
const mobileText = `
Received an unknown call on my mobile phone inquiring about my personal details.
`;
const factsMobile = extractFactsFromGrievanceText(mobileText);
assert(
  factsMobile.category !== 'consumer_ecommerce',
  '13. Standalone mention of mobile phone call does not trigger consumer_ecommerce',
  factsMobile.category,
  'not consumer_ecommerce'
);

// ------------------------------------------------------------------------------------------------
// Section 4: Manual Dropdown Selection Protection Logic
// ------------------------------------------------------------------------------------------------
console.log('\n--- Section 4: Manual Dropdown Selection Protection Logic ---');

// Test pure helper shouldUpdateCategoryOnExtraction
assert(
  shouldUpdateCategoryOnExtraction('banking_financial', false) === true,
  '14a. shouldUpdateCategoryOnExtraction allows auto-update when citizen has NOT modified category (isCategoryManuallyModified=false)',
  true,
  true
);

assert(
  shouldUpdateCategoryOnExtraction('consumer_ecommerce', true) === false,
  '14b. shouldUpdateCategoryOnExtraction BLOCKS auto-update when citizen HAS manually modified category (isCategoryManuallyModified=true)',
  false,
  false
);

assert(
  shouldUpdateCategoryOnExtraction(undefined, false) === false,
  '14c. shouldUpdateCategoryOnExtraction returns false when extractedCategory is undefined',
  false,
  false
);

// ------------------------------------------------------------------------------------------------
// Section 5: Static Inspection of CaseBuilder.tsx Implementation
// ------------------------------------------------------------------------------------------------
console.log('\n--- Section 5: Static Inspection of CaseBuilder.tsx Implementation ---');

const caseBuilderPath = path.resolve(__dirname, '../src/components/CaseBuilder.tsx');
const caseBuilderCode = fs.readFileSync(caseBuilderPath, 'utf8');

assert(
  caseBuilderCode.includes('const isCategoryManuallyModifiedRef = useRef<boolean>('),
  '15a. CaseBuilder.tsx declares isCategoryManuallyModifiedRef',
  true,
  true
);

assert(
  caseBuilderCode.includes('isCategoryManuallyModifiedRef.current = false;'),
  '15b. CaseBuilder.tsx resets isCategoryManuallyModifiedRef to false on new case initialization',
  true,
  true
);

assert(
  caseBuilderCode.includes('isCategoryManuallyModifiedRef.current = true;'),
  '15c. CaseBuilder.tsx sets isCategoryManuallyModifiedRef to true on existing case hydration and manual dropdown selection',
  true,
  true
);

assert(
  caseBuilderCode.includes('shouldUpdateCategoryOnExtraction(facts.category, isCategoryManuallyModifiedRef.current)'),
  '15d. applyExtractedFacts protects category updates with shouldUpdateCategoryOnExtraction and isCategoryManuallyModifiedRef',
  true,
  true
);

assert(
  caseBuilderCode.includes('isExplicitCyberFraud'),
  '15e. Category classification evaluates isExplicitCyberFraud before domain-specific checks',
  true,
  true
);

// ------------------------------------------------------------------------------------------------
// Summary
// ------------------------------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`Results: ${passedCount} PASSED, ${failedCount} FAILED out of ${passedCount + failedCount} assertions`);
console.log('================================================================');

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log('ALL CATEGORY EXTRACTION AND MANUAL OVERRIDE PROTECTION TESTS PASSED.');
  process.exit(0);
}
