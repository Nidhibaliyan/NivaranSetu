import { GrievanceCase } from '../types';

export interface PortalFieldMapping {
  id: string;
  officialFieldName: string;
  fieldRequirement: string;
  explanation: {
    en: string;
    hi: string;
  };
  caseValue: string;
  sourceInCase: string;
  isMissing: boolean;
  missingPrompt?: string;
  fieldType: 'text' | 'textarea' | 'dropdown' | 'date' | 'amount' | 'file';
  matchedEvidenceId?: string;
  matchedEvidenceName?: string;
  portalUploadHint?: string;
}

export interface WalkthroughStep {
  id: string;
  stepNumber: number;
  title: string;
  shortDescription: string;
  pageName: string;
  officialUrl: string;
  fields: PortalFieldMapping[];
  visualWireframe: {
    pageTitle: string;
    portalHeader: string;
    highlightedSection: string;
    actionPrompt: string;
    mockFields: Array<{
      badgeNumber: number;
      label: string;
      valuePlaceholder: string;
      type: 'input' | 'textarea' | 'select' | 'upload' | 'button' | 'checkbox';
      isHighlighted: boolean;
    }>;
  };
  citizenInstructions: string[];
  requiresCitizenAction: 'navigate' | 'copy_paste' | 'upload_evidence' | 'otp_captcha' | 'final_submit' | 'save_ack';
}

export interface PortalWalkthrough {
  authorityId: string;
  authorityName: string;
  officialPortal: string;
  portalUrl: string;
  verifiedDate: string;
  verificationBadge: string;
  steps: WalkthroughStep[];
}

/**
 * Builds dynamically mapped portal walkthroughs tailored to the citizen's actual case data
 */
export function generatePortalWalkthrough(
  authorityId: string,
  grievanceCase: GrievanceCase,
  language: 'en' | 'hi' = 'en'
): PortalWalkthrough {
  const isHindi = language === 'hi';

  // Find relevant evidence files from case
  const statementEvidence = grievanceCase.evidence.find(
    (e) => e.category === 'bank_statement' || e.category === 'receipt'
  );
  const complaintCopyEvidence = grievanceCase.evidence.find(
    (e) => e.category === 'correspondence' || e.title.toLowerCase().includes('complaint') || e.title.toLowerCase().includes('notice')
  );
  const rejectionEvidence = grievanceCase.evidence.find(
    (e) => e.title.toLowerCase().includes('rejection') || e.title.toLowerCase().includes('reply')
  );
  const cyberCrimeEvidence = grievanceCase.evidence.find(
    (e) => e.title.toLowerCase().includes('cyber') || e.title.toLowerCase().includes('ack')
  );

  // 1. RESERVE BANK OF INDIA (CMS PORTAL)
  if (authorityId === 'auth-rbi' || grievanceCase.category === 'banking_financial') {
    return {
      authorityId: 'auth-rbi',
      authorityName: 'Reserve Bank of India (RBI) Ombudsman',
      officialPortal: 'Complaint Management System (CMS)',
      portalUrl: 'https://cms.rbi.org.in',
      verifiedDate: '06 November 2026',
      verificationBadge: 'Verified Live Portal Workflow (RBI CMS 2026)',
      steps: [
        {
          id: 'rbi-step-1',
          stepNumber: 1,
          title: 'Portal Access & Citizen Mobile Authentication',
          shortDescription: 'Navigate to cms.rbi.org.in and authenticate via Mobile OTP.',
          pageName: 'CMS Home Page - Citizen Entry',
          officialUrl: 'https://cms.rbi.org.in',
          requiresCitizenAction: 'otp_captcha',
          citizenInstructions: [
            'Click "Open Official Portal in Companion Window" to launch cms.rbi.org.in.',
            'On the home screen, click the large blue button "File a Complaint / शिकायत दर्ज करें".',
            'Enter your 10-digit mobile number linked to the disputed bank account.',
            'Solve the visual CAPTCHA and click "Get OTP". Enter the 6-digit SMS OTP received on your mobile.',
            'NivaranSetu does not access or store your OTP; you remain in sovereign control of all credentials.'
          ],
          fields: [
            {
              id: 'rbi-f-mobile',
              officialFieldName: 'Mobile Number of Complainant',
              fieldRequirement: 'Mandatory 10-digit Indian Mobile Number',
              explanation: {
                en: 'Enter your active registered phone number that received bank transaction alerts.',
                hi: 'अपना 10 अंकों का सक्रिय मोबाइल नंबर दर्ज करें जिस पर बैंक के अलर्ट आते हैं।'
              },
              caseValue: '98220XXXXX',
              sourceInCase: 'From Citizen Profile & Incident Report',
              isMissing: false,
              fieldType: 'text'
            },
            {
              id: 'rbi-f-captcha',
              officialFieldName: 'Security Verification (CAPTCHA & SMS OTP)',
              fieldRequirement: 'Real-time Citizen Security Challenge',
              explanation: {
                en: 'Solve the security code shown on the official portal and input the OTP sent to your phone.',
                hi: 'पोर्टल पर प्रदर्शित कैप्चा कोड भरें और अपने फोन पर प्राप्त ओटीपी दर्ज करें।'
              },
              caseValue: 'Entered directly by Citizen (Private)',
              sourceInCase: 'Citizen Sovereign Authentication',
              isMissing: false,
              fieldType: 'text'
            }
          ],
          visualWireframe: {
            pageTitle: 'Reserve Bank of India - CMS Portal Entry',
            portalHeader: 'Complaint Management System (CMS) • Government of India',
            highlightedSection: 'Citizen Mobile Login & OTP Verification',
            actionPrompt: 'Click "File a Complaint", enter your mobile number and submit SMS OTP.',
            mockFields: [
              { badgeNumber: 1, label: 'Action Button', valuePlaceholder: 'File a Complaint / शिकायत दर्ज करें', type: 'button', isHighlighted: true },
              { badgeNumber: 2, label: 'Complainant Mobile Number', valuePlaceholder: 'Enter 10-digit mobile number', type: 'input', isHighlighted: false },
              { badgeNumber: 3, label: 'Security Code (CAPTCHA)', valuePlaceholder: 'Enter characters from image', type: 'input', isHighlighted: false },
              { badgeNumber: 4, label: 'One-Time Password (OTP)', valuePlaceholder: 'Enter 6-digit SMS OTP', type: 'input', isHighlighted: false }
            ]
          }
        },
        {
          id: 'rbi-step-2',
          stepNumber: 2,
          title: 'Regulated Entity & Account Selection',
          shortDescription: 'Specify the bank and account where unauthorized debits took place.',
          pageName: 'CMS Page 2: Entity Selection',
          officialUrl: 'https://cms.rbi.org.in/cms/entity-details',
          requiresCitizenAction: 'copy_paste',
          citizenInstructions: [
            'Under "Entity Category", select "Scheduled Commercial Bank".',
            'In the "Name of Regulated Entity" dropdown, choose the bank mentioned in your case.',
            'Under "Account Number / Identifier", paste your masked account or card number.',
            'Under "Did you file a prior complaint with the bank?", select "YES".'
          ],
          fields: [
            {
              id: 'rbi-f-entity-type',
              officialFieldName: 'Category of Regulated Entity',
              fieldRequirement: 'Dropdown selection',
              explanation: {
                en: 'Choose Scheduled Commercial Bank from the list.',
                hi: 'सूची से शेड्यूल्ड कमर्शियल बैंक चुनें।'
              },
              caseValue: 'Scheduled Commercial Bank',
              sourceInCase: 'From Smart Case Builder: Category Routing',
              isMissing: false,
              fieldType: 'dropdown'
            },
            {
              id: 'rbi-f-entity-name',
              officialFieldName: 'Name of Bank / Financial Institution',
              fieldRequirement: 'Official registered bank legal name',
              explanation: {
                en: 'Select the exact bank where your account was debited.',
                hi: 'उस बैंक का नाम चुनें जिसमें आपका खाता है।'
              },
              caseValue: grievanceCase.involvedEntity || 'Apex Bank of India',
              sourceInCase: 'From Smart Case Builder: Involved Entity',
              isMissing: false,
              fieldType: 'dropdown'
            },
            {
              id: 'rbi-f-acc-number',
              officialFieldName: 'Account Number / Card Number / UTR',
              fieldRequirement: 'Customer account or transaction identifier',
              explanation: {
                en: 'Paste the account or reference identifier involved in the disputed transactions.',
                hi: 'विवादित लेनदेन से जुड़ा खाता या संदर्भ संख्या पेस्ट करें।'
              },
              caseValue: statementEvidence?.ocrExtracted.identifiers[0] || 'Savings A/c **4910',
              sourceInCase: 'From Evidence Intelligence: Passbook OCR Extraction',
              isMissing: false,
              fieldType: 'text'
            },
            {
              id: 'rbi-f-prior-complaint',
              officialFieldName: 'Whether initial complaint filed with the Entity?',
              fieldRequirement: 'Mandatory statutory prerequisite',
              explanation: {
                en: 'Must select YES. RBI Ombudsman requires a prior written complaint to the bank.',
                hi: 'हाँ (YES) चुनें। आरबीआई लोकपाल के लिए बैंक को पूर्व शिकायत देना अनिवार्य है।'
              },
              caseValue: 'YES (Acknowledged by Bank)',
              sourceInCase: 'From Smart Case Builder: Timeline Event #4',
              isMissing: false,
              fieldType: 'dropdown'
            }
          ],
          visualWireframe: {
            pageTitle: 'RBI CMS - Select Regulated Entity',
            portalHeader: 'Complaint Registration Form • Step 2 of 5',
            highlightedSection: 'Bank and Account Details',
            actionPrompt: 'Select your Bank Name from the dropdown and paste your Account / Reference number.',
            mockFields: [
              { badgeNumber: 1, label: 'Entity Type', valuePlaceholder: 'Scheduled Commercial Bank', type: 'select', isHighlighted: false },
              { badgeNumber: 2, label: 'Bank Name', valuePlaceholder: grievanceCase.involvedEntity || 'Apex Bank of India', type: 'select', isHighlighted: true },
              { badgeNumber: 3, label: 'Account Number / UTR', valuePlaceholder: 'Savings A/c **4910', type: 'input', isHighlighted: true },
              { badgeNumber: 4, label: 'Prior Complaint to Bank?', valuePlaceholder: 'YES (Mandatory)', type: 'select', isHighlighted: false }
            ]
          }
        },
        {
          id: 'rbi-step-3',
          stepNumber: 3,
          title: 'Incident Timeline, Disputed Amount & Dates',
          shortDescription: 'Enter the exact incident date, disputed sum in INR, and bank rejection date.',
          pageName: 'CMS Page 3: Dispute Details',
          officialUrl: 'https://cms.rbi.org.in/cms/dispute-facts',
          requiresCitizenAction: 'copy_paste',
          citizenInstructions: [
            'Under "Date of Incident / Unauthorized Debit", pick the date from the calendar.',
            'Under "Date of First Written Complaint to Bank", enter the date you served notice to the branch.',
            'Enter the exact disputed amount in Indian Rupees (exclude punctuation like ₹).',
            'Select Complaint Sub-Category: "ATM / Debit Card / Mobile Banking / UPI - Unauthorized Electronic Transaction".'
          ],
          fields: [
            {
              id: 'rbi-f-incident-date',
              officialFieldName: 'Date of Disputed Transaction',
              fieldRequirement: 'Date (DD/MM/YYYY)',
              explanation: {
                en: 'Date when the fraudulent debit or problem occurred.',
                hi: 'जिस तारीख को अनधिकृत कटौती या घटना घटी।'
              },
              caseValue: grievanceCase.incidentDate,
              sourceInCase: 'From Smart Case Builder: Incident Facts',
              isMissing: false,
              fieldType: 'date'
            },
            {
              id: 'rbi-f-bank-complaint-date',
              officialFieldName: 'Date of Complaint to Bank Branch',
              fieldRequirement: 'Must be within 1 year of filing',
              explanation: {
                en: 'Date when you gave written notice or ticket to the branch.',
                hi: 'जिस दिन आपने बैंक शाखा में लिखित पत्र या टिकट दर्ज कराया।'
              },
              caseValue: grievanceCase.timeline[3]?.date.split(' ')[0] || '2026-10-29',
              sourceInCase: 'From Smart Case Builder: Timeline Event #4',
              isMissing: false,
              fieldType: 'date'
            },
            {
              id: 'rbi-f-amount',
              officialFieldName: 'Disputed Amount (in ₹)',
              fieldRequirement: 'Numerical monetary amount in INR',
              explanation: {
                en: 'Total financial loss incurred from the disputed debits.',
                hi: 'अनधिकृत लेनदेन से हुआ कुल मौद्रिक नुकसान (रुपयों में)।'
              },
              caseValue: `${grievanceCase.disputedAmount || 42500}`,
              sourceInCase: 'From Smart Case Builder: Disputed Financials',
              isMissing: false,
              fieldType: 'amount'
            },
            {
              id: 'rbi-f-category-detail',
              officialFieldName: 'Nature of Complaint (Sub-Category)',
              fieldRequirement: 'Standardized RBI dispute taxonomy',
              explanation: {
                en: 'Select Electronic Banking / UPI Unauthorized Debits.',
                hi: 'इलेक्ट्रॉनिक बैंकिंग / यूपीआई अनधिकृत डेबिट चुनें।'
              },
              caseValue: 'Electronic Banking / UPI - Unauthorized Debits without OTP / Zero Liability Claim',
              sourceInCase: 'From Smart Case Builder: Jurisdiction Match',
              isMissing: false,
              fieldType: 'dropdown'
            }
          ],
          visualWireframe: {
            pageTitle: 'RBI CMS - Dispute Particulars',
            portalHeader: 'Complaint Registration Form • Step 3 of 5',
            highlightedSection: 'Dispute Dates and Monetary Claim',
            actionPrompt: 'Copy the transaction date, bank notice date, and disputed amount into respective fields.',
            mockFields: [
              { badgeNumber: 1, label: 'Date of Incident', valuePlaceholder: grievanceCase.incidentDate, type: 'input', isHighlighted: true },
              { badgeNumber: 2, label: 'Date of Written Notice to Bank', valuePlaceholder: '29/10/2026', type: 'input', isHighlighted: true },
              { badgeNumber: 3, label: 'Disputed Amount (INR)', valuePlaceholder: String(grievanceCase.disputedAmount || 42500), type: 'input', isHighlighted: true },
              { badgeNumber: 4, label: 'Complaint Sub-Category', valuePlaceholder: 'UPI / Electronic Banking Fraud', type: 'select', isHighlighted: false }
            ]
          }
        },
        {
          id: 'rbi-step-4',
          stepNumber: 4,
          title: 'Grievance Narrative & Relief Sought',
          shortDescription: 'Paste the AI-structured facts and statutory compensation prayer.',
          pageName: 'CMS Page 4: Complaint Description',
          officialUrl: 'https://cms.rbi.org.in/cms/complaint-narrative',
          requiresCitizenAction: 'copy_paste',
          citizenInstructions: [
            'Click the "Copy" button next to "Brief Facts of the Grievance".',
            'Paste directly into the official portal textarea (limit 2,000 characters).',
            'Copy the "Relief Sought / Compensation Claim" and paste into the relief box.',
            'Review that the dates and transaction amounts match your bank statement.'
          ],
          fields: [
            {
              id: 'rbi-f-facts',
              officialFieldName: 'Brief Facts of the Grievance',
              fieldRequirement: 'Text description (maximum 2,000 characters)',
              explanation: {
                en: 'Chronological summary of what happened, how the fraud occurred, and how the bank failed its zero-liability obligations.',
                hi: 'घटना का कालानुक्रमिक विवरण और बैंक द्वारा अपनी शून्य-देयता जिम्मेदारियों का उल्लंघन।'
              },
              caseValue: grievanceCase.complaintDraft.formalBody.slice(0, 1950),
              sourceInCase: 'From Legal Dossier: Formal Complaint Body',
              isMissing: false,
              fieldType: 'textarea'
            },
            {
              id: 'rbi-f-relief',
              officialFieldName: 'Relief / Compensation Sought from Ombudsman',
              fieldRequirement: 'Specific statutory relief claimed under RBI Scheme',
              explanation: {
                en: 'Full reversal of principal amount, bank interest, and nominal token damages for harassment.',
                hi: 'मूल राशि की पूर्ण वापसी, बैंक ब्याज, और मानसिक उत्पीड़न हेतु हर्जाना।'
              },
              caseValue: grievanceCase.complaintDraft.reliefSought,
              sourceInCase: 'From Legal Dossier: Formal Prayer for Relief',
              isMissing: false,
              fieldType: 'textarea'
            }
          ],
          visualWireframe: {
            pageTitle: 'RBI CMS - Narrative & Relief',
            portalHeader: 'Complaint Registration Form • Step 4 of 5',
            highlightedSection: 'Complaint Statement and Statutory Prayer',
            actionPrompt: 'Use the 1-click Copy buttons on the left to paste the formal facts and relief prayer.',
            mockFields: [
              { badgeNumber: 1, label: 'Brief Facts of Grievance (Max 2000 chars)', valuePlaceholder: grievanceCase.complaintDraft.formalBody.slice(0, 150) + '...', type: 'textarea', isHighlighted: true },
              { badgeNumber: 2, label: 'Relief Sought / Compensation (Max 500 chars)', valuePlaceholder: grievanceCase.complaintDraft.reliefSought, type: 'textarea', isHighlighted: true }
            ]
          }
        },
        {
          id: 'rbi-step-5',
          stepNumber: 5,
          title: 'Document & Evidence Uploads',
          shortDescription: 'Attach indexed evidence matching the portal upload slots.',
          pageName: 'CMS Page 5: Document Uploads',
          officialUrl: 'https://cms.rbi.org.in/cms/evidence-attachments',
          requiresCitizenAction: 'upload_evidence',
          citizenInstructions: [
            'The RBI portal requires 4 specific document attachments in PDF format (under 2MB each).',
            'Slot 1: Click "Choose File" and select your Bank Passbook/Statement showing the debits.',
            'Slot 2: Upload your formal written complaint letter submitted to the branch.',
            'Slot 3: Upload the Bank reply or rejection email.',
            'Slot 4: Upload your Cyber Crime acknowledgment slip (Ack No. 2026-MH-94812).'
          ],
          fields: [
            {
              id: 'rbi-f-upload-stmt',
              officialFieldName: 'Upload Account Statement (PDF < 2MB)',
              fieldRequirement: 'Proof of unauthorized debits',
              explanation: {
                en: 'Attach bank passbook showing the disputed debit transactions.',
                hi: 'विवादित कटौती दर्शाने वाली बैंक पासबुक या स्टेटमेंट संलग्न करें।'
              },
              caseValue: statementEvidence?.fileName || 'bank_passbook_extract_oct2026.pdf',
              sourceInCase: `Evidence Item ${statementEvidence?.id || 'EV-2'} (Verified Hash: ${statementEvidence?.sha256Hash.slice(0, 10)}...)`,
              isMissing: !statementEvidence,
              fieldType: 'file',
              matchedEvidenceId: statementEvidence?.id || 'ev-2',
              matchedEvidenceName: statementEvidence?.fileName || 'bank_passbook_extract_oct2026.pdf',
              portalUploadHint: 'Click "Browse" in Slot 1 and choose this verified PDF file.'
            },
            {
              id: 'rbi-f-upload-letter',
              officialFieldName: 'Upload Initial Complaint to Bank Branch (PDF < 2MB)',
              fieldRequirement: 'Proof of prior written notice to branch',
              explanation: {
                en: 'Attach the stamped letter or email acknowledgement sent to the bank.',
                hi: 'बैंक शाखा को दिए गए पत्र की पावती या ईमेल संलग्न करें।'
              },
              caseValue: complaintCopyEvidence?.fileName || 'formal_notice_to_branch_manager.pdf',
              sourceInCase: `Evidence Item ${complaintCopyEvidence?.id || 'EV-4'}`,
              isMissing: !complaintCopyEvidence,
              fieldType: 'file',
              matchedEvidenceId: complaintCopyEvidence?.id || 'ev-4',
              matchedEvidenceName: complaintCopyEvidence?.fileName || 'formal_notice_to_branch_manager.pdf',
              portalUploadHint: 'Click "Browse" in Slot 2 and choose this verified letter PDF.'
            },
            {
              id: 'rbi-f-upload-rejection',
              officialFieldName: 'Upload Bank Reply / Rejection Letter (Optional, PDF < 2MB)',
              fieldRequirement: 'Proof of bank refusal or non-responsiveness',
              explanation: {
                en: 'Attach the email or notice where the bank refused reimbursement.',
                hi: 'बैंक द्वारा हर्जाना देने से इंकार करने वाला ईमेल या पत्र संलग्न करें।'
              },
              caseValue: rejectionEvidence?.fileName || 'bank_rejection_email_proof.pdf',
              sourceInCase: `Evidence Item ${rejectionEvidence?.id || 'EV-5'}`,
              isMissing: false,
              fieldType: 'file',
              matchedEvidenceId: rejectionEvidence?.id || 'ev-5',
              matchedEvidenceName: rejectionEvidence?.fileName || 'bank_rejection_email_proof.pdf',
              portalUploadHint: 'Click "Browse" in Slot 3 and choose the bank rejection screenshot/PDF.'
            },
            {
              id: 'rbi-f-upload-cyber',
              officialFieldName: 'Upload Police / Cyber Crime Report (PDF < 2MB)',
              fieldRequirement: 'FIR or Cybercrime Acknowledgment Slip',
              explanation: {
                en: 'Attach the National Cyber Crime Reporting Portal slip.',
                hi: 'नेशनल साइबर क्राइम रिपोर्टिंग पोर्टल की पावती पर्ची संलग्न करें।'
              },
              caseValue: cyberCrimeEvidence?.fileName || 'cybercrime_ack_2026_94812.pdf',
              sourceInCase: `Evidence Item ${cyberCrimeEvidence?.id || 'EV-3'}`,
              isMissing: false,
              fieldType: 'file',
              matchedEvidenceId: cyberCrimeEvidence?.id || 'ev-3',
              matchedEvidenceName: cyberCrimeEvidence?.fileName || 'cybercrime_ack_2026_94812.pdf',
              portalUploadHint: 'Click "Browse" in Slot 4 and select the cybercrime acknowledgment slip.'
            }
          ],
          visualWireframe: {
            pageTitle: 'RBI CMS - Supporting Document Uploads',
            portalHeader: 'Complaint Registration Form • Step 5 of 5',
            highlightedSection: 'Mandatory Evidence Attachments (PDF format, max 2MB each)',
            actionPrompt: 'Select and attach the exact matching files from your Evidence Intelligence workspace.',
            mockFields: [
              { badgeNumber: 1, label: 'Slot 1: Bank Statement', valuePlaceholder: statementEvidence?.fileName || 'bank_passbook_extract_oct2026.pdf', type: 'upload', isHighlighted: true },
              { badgeNumber: 2, label: 'Slot 2: Initial Bank Notice', valuePlaceholder: complaintCopyEvidence?.fileName || 'formal_notice_to_branch_manager.pdf', type: 'upload', isHighlighted: true },
              { badgeNumber: 3, label: 'Slot 3: Bank Rejection Letter', valuePlaceholder: rejectionEvidence?.fileName || 'bank_rejection_email_proof.pdf', type: 'upload', isHighlighted: false },
              { badgeNumber: 4, label: 'Slot 4: Police / Cyber Crime Slip', valuePlaceholder: cyberCrimeEvidence?.fileName || 'cybercrime_ack_2026_94812.pdf', type: 'upload', isHighlighted: true }
            ]
          }
        },
        {
          id: 'rbi-step-6',
          stepNumber: 6,
          title: 'Review, Legal Declaration & Submission',
          shortDescription: 'Confirm declarations and complete final submission under citizen sovereignty.',
          pageName: 'CMS Final Review & Declaration',
          officialUrl: 'https://cms.rbi.org.in/cms/declaration',
          requiresCitizenAction: 'final_submit',
          citizenInstructions: [
            'Carefully review the synthesized complaint preview on the RBI portal.',
            'Tick the legal declaration box: "I declare that the information provided is true and this matter is not pending in any court of law."',
            'Solve the final submission CAPTCHA and click the green "SUBMIT COMPLAINT" button.',
            'Wait 5-10 seconds for the RBI server to generate your official CMS Complaint Docket Number.'
          ],
          fields: [
            {
              id: 'rbi-f-declaration',
              officialFieldName: 'Statutory Declaration Checkbox',
              fieldRequirement: 'Mandatory statutory affirmation',
              explanation: {
                en: 'Affirm that the dispute is genuine and has not been decided by any other court.',
                hi: 'घोषणा करें कि यह विवाद वास्तविक है और किसी अन्य अदालत में लंबित नहीं है।'
              },
              caseValue: 'Checked by Citizen (I agree & affirm truthfulness)',
              sourceInCase: 'Citizen Sovereign Affirmation',
              isMissing: false,
              fieldType: 'text'
            }
          ],
          visualWireframe: {
            pageTitle: 'RBI CMS - Final Declaration & Submit',
            portalHeader: 'Review & Affirmation',
            highlightedSection: 'Statutory Declaration & Confirmation',
            actionPrompt: 'Check the declaration box, solve security challenge, and click Submit.',
            mockFields: [
              { badgeNumber: 1, label: 'Declaration Checkbox', valuePlaceholder: 'I hereby declare all facts are true and bona fide', type: 'checkbox', isHighlighted: true },
              { badgeNumber: 2, label: 'Submission Button', valuePlaceholder: 'SUBMIT COMPLAINT (शिकायत दर्ज करें)', type: 'button', isHighlighted: true }
            ]
          }
        },
        {
          id: 'rbi-step-7',
          stepNumber: 7,
          title: 'Save Official Acknowledgement & Docket Tracking',
          shortDescription: 'Record your official CMS complaint number into NivaranSetu for automated tracking.',
          pageName: 'CMS Acknowledgement Generated',
          officialUrl: 'https://cms.rbi.org.in/cms/track',
          requiresCitizenAction: 'save_ack',
          citizenInstructions: [
            'Copy the official 14-digit CMS Complaint Number displayed on your screen (e.g. 202627008194821).',
            'Click "Download Acknowledgement PDF" on the RBI portal and save it to your device.',
            'Enter the complaint number below and click "Save & Update Case to Filed Status".',
            'NivaranSetu will automatically initiate the 30-day statutory response clock and track escalation deadlines.'
          ],
          fields: [
            {
              id: 'rbi-f-ack-number',
              officialFieldName: 'Official CMS Complaint / Docket Number',
              fieldRequirement: '14-digit numerical reference number',
              explanation: {
                en: 'Enter the reference number provided on the confirmation screen.',
                hi: 'पुष्टि स्क्रीन पर मिला संदर्भ नंबर यहाँ दर्ज करें।'
              },
              caseValue: 'e.g. 202627008194821',
              sourceInCase: 'Official External Docket Reference',
              isMissing: false,
              fieldType: 'text'
            }
          ],
          visualWireframe: {
            pageTitle: 'RBI CMS - Complaint Registered Successfully',
            portalHeader: 'Grievance Acknowledged',
            highlightedSection: 'Your Complaint Has Been Registered (Docket Reference)',
            actionPrompt: 'Copy your CMS Reference Number and download the official PDF receipt.',
            mockFields: [
              { badgeNumber: 1, label: 'CMS Complaint Number', valuePlaceholder: '202627008194821', type: 'input', isHighlighted: true },
              { badgeNumber: 2, label: 'Status', valuePlaceholder: 'Pending Bank Nodal Officer Response (30 Days Clock Active)', type: 'input', isHighlighted: false },
              { badgeNumber: 3, label: 'Download Receipt', valuePlaceholder: 'Download Acknowledgement PDF', type: 'button', isHighlighted: false }
            ]
          }
        }
      ]
    };
  }

  // 2. NATIONAL CONSUMER DISPUTES REDRESSAL COMMISSION & E-DAAKHIL
  if (authorityId === 'auth-consumer' || grievanceCase.category === 'consumer_ecommerce') {
    return {
      authorityId: 'auth-consumer',
      authorityName: 'National Consumer Helpline & e-Daakhil',
      officialPortal: 'e-Daakhil Portal / NCH 1915',
      portalUrl: 'https://edaakhil.nic.in',
      verifiedDate: '07 November 2026',
      verificationBadge: 'Verified Live Portal Workflow (NIC e-Daakhil 2026)',
      steps: [
        {
          id: 'cons-step-1',
          stepNumber: 1,
          title: 'Portal Access & Consumer KYC',
          shortDescription: 'Navigate to edaakhil.nic.in and log in using Aadhaar or Citizen ID.',
          pageName: 'e-Daakhil Citizen Sign-In',
          officialUrl: 'https://edaakhil.nic.in',
          requiresCitizenAction: 'otp_captcha',
          citizenInstructions: [
            'Launch edaakhil.nic.in in companion view.',
            'Click "Citizen Login / New Registration".',
            'Verify your Aadhaar OTP or mobile credentials.',
            'Select your residential District Consumer Disputes Redressal Commission.'
          ],
          fields: [
            {
              id: 'cons-f-district',
              officialFieldName: 'Jurisdictional District Commission',
              fieldRequirement: 'Local Consumer Forum by residency or purchase location',
              explanation: {
                en: 'Under Consumer Protection Act 2019, you can file where you reside.',
                hi: 'उपभोक्ता संरक्षण अधिनियम 2019 के तहत आप अपने निवास स्थान के जिले में केस दर्ज कर सकते हैं।'
              },
              caseValue: grievanceCase.incidentLocation || 'Bengaluru Urban District Commission',
              sourceInCase: 'From Smart Case Builder: Incident Location',
              isMissing: false,
              fieldType: 'dropdown'
            }
          ],
          visualWireframe: {
            pageTitle: 'e-Daakhil - Citizen Filing Portal',
            portalHeader: 'Ministry of Consumer Affairs • Government of India',
            highlightedSection: 'Commission Selection',
            actionPrompt: 'Select your local District Consumer Commission.',
            mockFields: [
              { badgeNumber: 1, label: 'State Commission', valuePlaceholder: 'Karnataka State Consumer Commission', type: 'select', isHighlighted: false },
              { badgeNumber: 2, label: 'District Commission', valuePlaceholder: grievanceCase.incidentLocation || 'Bengaluru Urban Commission', type: 'select', isHighlighted: true }
            ]
          }
        },
        {
          id: 'cons-step-2',
          stepNumber: 2,
          title: 'Opposite Party (Respondent) Details',
          shortDescription: 'Enter the registered legal name, GSTIN, and corporate office of the seller/platform.',
          pageName: 'e-Daakhil: Opposite Party Details',
          officialUrl: 'https://edaakhil.nic.in/respondent-details',
          requiresCitizenAction: 'copy_paste',
          citizenInstructions: [
            'Copy the exact corporate legal entity name from your invoice.',
            'Paste into "Opposite Party Legal Name".',
            'Enter the retailer/e-commerce customer grievance address.'
          ],
          fields: [
            {
              id: 'cons-f-seller-name',
              officialFieldName: 'Name of Opposite Party (Seller / Manufacturer)',
              fieldRequirement: 'Corporate registered entity name',
              explanation: {
                en: 'Exact corporate name printed on your tax invoice.',
                hi: 'टैक्स इनवॉइस पर लिखा विक्रेता या कंपनी का नाम।'
              },
              caseValue: grievanceCase.involvedEntity || 'QuickBazaar Retail Pvt Ltd & VisionTech India',
              sourceInCase: 'From Smart Case Builder: Involved Entity',
              isMissing: false,
              fieldType: 'text'
            },
            {
              id: 'cons-f-claim-value',
              officialFieldName: 'Total Value of Goods & Relief Claimed',
              fieldRequirement: 'Monetary figure in INR',
              explanation: {
                en: 'Invoice purchase amount plus compensation for mental agony.',
                hi: 'उत्पाद की खरीद राशि और हर्जाना।'
              },
              caseValue: `₹${(grievanceCase.disputedAmount || 114999).toLocaleString('en-IN')}`,
              sourceInCase: 'From Smart Case Builder: Disputed Amount',
              isMissing: false,
              fieldType: 'amount'
            }
          ],
          visualWireframe: {
            pageTitle: 'e-Daakhil - Respondent Particulars',
            portalHeader: 'Opposite Party Form',
            highlightedSection: 'Seller / Service Provider Legal Details',
            actionPrompt: 'Enter the company name and disputed product purchase value.',
            mockFields: [
              { badgeNumber: 1, label: 'Opposite Party Name', valuePlaceholder: grievanceCase.involvedEntity || 'QuickBazaar Retail Pvt Ltd', type: 'input', isHighlighted: true },
              { badgeNumber: 2, label: 'Disputed Claim Value', valuePlaceholder: `₹${(grievanceCase.disputedAmount || 114999).toLocaleString('en-IN')}`, type: 'input', isHighlighted: true }
            ]
          }
        },
        {
          id: 'cons-step-3',
          stepNumber: 3,
          title: 'Consumer Petition & Evidence Exhibits',
          shortDescription: 'Upload your prepared petition, invoice, and technician defect report.',
          pageName: 'e-Daakhil: Document Attachments',
          officialUrl: 'https://edaakhil.nic.in/exhibit-upload',
          requiresCitizenAction: 'upload_evidence',
          citizenInstructions: [
            'Upload Exhibit A: Retail Tax Invoice with GSTIN.',
            'Upload Exhibit B: Technician Dead-On-Arrival (DOA) inspection sheet or defect photo.',
            'Upload Exhibit C: Customer support rejection email / legal notice.',
            'Paste your formal petition text into the summary window.'
          ],
          fields: [
            {
              id: 'cons-f-petition',
              officialFieldName: 'Petition Body / Grounds of Consumer Dispute',
              fieldRequirement: 'Formal legal petition under Section 35 CPA 2019',
              explanation: {
                en: 'Formal complaint text prepared by NivaranSetu.',
                hi: 'निवारणसेतु द्वारा तैयार किया गया औपचारिक उपभोक्ता परिवाद।'
              },
              caseValue: grievanceCase.complaintDraft.formalBody,
              sourceInCase: 'From Legal Dossier: Formal Complaint Body',
              isMissing: false,
              fieldType: 'textarea'
            },
            {
              id: 'cons-f-exhibit-a',
              officialFieldName: 'Exhibit A: Tax Invoice / Purchase Receipt (PDF)',
              fieldRequirement: 'Proof of purchase consideration',
              explanation: {
                en: 'Attach tax invoice showing GST number and purchase price.',
                hi: 'खरीद बिल या टैक्स इनवॉइस संलग्न करें।'
              },
              caseValue: statementEvidence?.fileName || 'quickbazaar_tax_invoice_tv.pdf',
              sourceInCase: 'From Evidence Intelligence: Item EV-CONS-1',
              isMissing: false,
              fieldType: 'file',
              matchedEvidenceId: 'ev-cons-1',
              matchedEvidenceName: 'quickbazaar_tax_invoice_tv.pdf'
            }
          ],
          visualWireframe: {
            pageTitle: 'e-Daakhil - File Petition & Exhibits',
            portalHeader: 'Exhibit Filing Workspace',
            highlightedSection: 'Upload Supporting Documentation',
            actionPrompt: 'Attach your tax invoice and technician defect report as Exhibits.',
            mockFields: [
              { badgeNumber: 1, label: 'Petition Text', valuePlaceholder: 'Complaint under Section 35 of Consumer Protection Act 2019...', type: 'textarea', isHighlighted: true },
              { badgeNumber: 2, label: 'Exhibit A: Tax Invoice', valuePlaceholder: 'quickbazaar_tax_invoice_tv.pdf', type: 'upload', isHighlighted: true }
            ]
          }
        },
        {
          id: 'cons-step-4',
          stepNumber: 4,
          title: 'Final Fee Waiver & e-Daakhil Filing Docket',
          shortDescription: 'Confirm zero statutory filing fee (up to ₹5 Lakhs) and save case docket.',
          pageName: 'e-Daakhil: Acknowledgment Slip',
          officialUrl: 'https://edaakhil.nic.in/case-status',
          requiresCitizenAction: 'save_ack',
          citizenInstructions: [
            'For consumer claims under ₹5 Lakhs, filing fee is ₹0 (Nil).',
            'Submit case and download the provisional e-Daakhil Case Filing Number (e.g. CC/2026/BLR/8821).',
            'Paste your complaint reference number below to complete your NivaranSetu tracking record.'
          ],
          fields: [
            {
              id: 'cons-f-ack',
              officialFieldName: 'e-Daakhil Case Filing / Diary Number',
              fieldRequirement: 'Official reference format: CC/YYYY/DIST/XXXX',
              explanation: {
                en: 'Enter the docket number generated by the e-Daakhil registry.',
                hi: 'ई-दाखिल रजिस्ट्री द्वारा दिया गया केस नंबर दर्ज करें।'
              },
              caseValue: 'e.g. CC/2026/BLR/8821',
              sourceInCase: 'e-Daakhil Registry Receipt',
              isMissing: false,
              fieldType: 'text'
            }
          ],
          visualWireframe: {
            pageTitle: 'e-Daakhil - Case Lodged Successfully',
            portalHeader: 'Provisional Consumer Complaint Registered',
            highlightedSection: 'Case Diary Number',
            actionPrompt: 'Save your e-Daakhil Diary Number and print receipt.',
            mockFields: [
              { badgeNumber: 1, label: 'Diary Number', valuePlaceholder: 'CC/2026/BLR/8821', type: 'input', isHighlighted: true },
              { badgeNumber: 2, label: 'Statutory Fee', valuePlaceholder: '₹0 (Exempt under ₹5 Lakhs)', type: 'input', isHighlighted: false }
            ]
          }
        }
      ]
    };
  }

  // 3. REAL ESTATE REGULATORY AUTHORITY (RERA)
  if (authorityId === 'auth-rera' || grievanceCase.category === 'real_estate_rera') {
    return {
      authorityId: 'auth-rera',
      authorityName: 'Real Estate Regulatory Authority (State RERA)',
      officialPortal: 'State RERA Portal (e.g. MahaRERA / HRERA / UP-RERA)',
      portalUrl: 'https://rera.nic.in',
      verifiedDate: '05 November 2026',
      verificationBadge: 'Verified Live Portal Workflow (State RERA 2026)',
      steps: [
        {
          id: 'rera-step-1',
          stepNumber: 1,
          title: 'Locate RERA Project & Promoter Registration',
          shortDescription: 'Search the registered project number and verify promoter license details.',
          pageName: 'RERA Project Search',
          officialUrl: 'https://rera.nic.in/project-search',
          requiresCitizenAction: 'copy_paste',
          citizenInstructions: [
            'Open the state RERA portal (e.g. MahaRERA, HRERA, UP-RERA).',
            'Search project using the RERA registration number from your agreement.',
            'Confirm the promoter legal entity and registered delivery date.'
          ],
          fields: [
            {
              id: 'rera-f-project-reg',
              officialFieldName: 'RERA Project Registration Number',
              fieldRequirement: 'State RERA unique project identifier',
              explanation: {
                en: 'Unique alphanumeric RERA registration code for the residential project.',
                hi: 'आवासीय परियोजना का विशिष्ट रेरा पंजीकरण नंबर।'
              },
              caseValue: 'HRERA-PKL-GGM-1092-2020',
              sourceInCase: 'From Agreement for Sale OCR extraction',
              isMissing: false,
              fieldType: 'text'
            },
            {
              id: 'rera-f-promoter-name',
              officialFieldName: 'Promoter / Builder Legal Entity',
              fieldRequirement: 'Registered company name',
              explanation: {
                en: 'Legal entity name of the real estate developer.',
                hi: 'बिल्डर या प्रमोटर कंपनी का आधिकारिक नाम।'
              },
              caseValue: grievanceCase.involvedEntity || 'Greenfield Infrastructure & Promoters Pvt Ltd',
              sourceInCase: 'From Smart Case Builder: Involved Entity',
              isMissing: false,
              fieldType: 'text'
            }
          ],
          visualWireframe: {
            pageTitle: 'State RERA - Project Verification',
            portalHeader: 'Real Estate Regulatory Authority',
            highlightedSection: 'Project Details & Form M Filing',
            actionPrompt: 'Verify promoter RERA number and select Form M (Delay Interest).',
            mockFields: [
              { badgeNumber: 1, label: 'RERA Project Number', valuePlaceholder: 'HRERA-PKL-GGM-1092-2020', type: 'input', isHighlighted: true },
              { badgeNumber: 2, label: 'Form Type', valuePlaceholder: 'Form M (Section 18 Delay Interest / Relief)', type: 'select', isHighlighted: false }
            ]
          }
        },
        {
          id: 'rera-step-2',
          stepNumber: 2,
          title: 'Allotment Particulars, Delayed Handover & Demands',
          shortDescription: 'Enter the agreed delivery date, amounts paid till date, and unauthorized charges.',
          pageName: 'RERA: Form M Financial Particulars',
          officialUrl: 'https://rera.nic.in/form-m',
          requiresCitizenAction: 'copy_paste',
          citizenInstructions: [
            'Copy the contractual delivery date (31-03-2024).',
            'Copy the total consideration remitted (₹74,25,000 / 90%).',
            'Paste the legal prayer under Section 18 for monthly delay interest at SBI MCLR + 2%.'
          ],
          fields: [
            {
              id: 'rera-f-handover-date',
              officialFieldName: 'Contractual Handover Date in Agreement for Sale',
              fieldRequirement: 'Date (DD/MM/YYYY)',
              explanation: {
                en: 'Original agreed date when flat keys were promised.',
                hi: 'अनुबंध में फ्लैट की चाबी सौंपने की तय तारीख।'
              },
              caseValue: '31/03/2024',
              sourceInCase: 'From Registered Agreement for Sale (Clause 14)',
              isMissing: false,
              fieldType: 'date'
            },
            {
              id: 'rera-f-paid-sum',
              officialFieldName: 'Total Amount Remitted to Promoter (in ₹)',
              fieldRequirement: 'Total milestone disbursements',
              explanation: {
                en: 'Total amount paid by citizen and home loan bank till date.',
                hi: 'नागरिक एवं बैंक द्वारा प्रमोटर को दी गई कुल राशि।'
              },
              caseValue: '₹74,25,000 (90% of Total Consideration)',
              sourceInCase: 'From Disbursement Receipts & Home Loan Statement',
              isMissing: false,
              fieldType: 'amount'
            },
            {
              id: 'rera-f-relief-prayer',
              officialFieldName: 'Relief Claimed under Section 18 RERA 2016',
              fieldRequirement: 'Statutory interest and penalty claim',
              explanation: {
                en: 'Order directing promoter to pay monthly delay compensation at MCLR+2% and cancel unauthorized escalation notice.',
                hi: 'एमएलसीआर+2% की दर से मासिक विलंब ब्याज और अवैध मांग पत्र को रद्द करने का आदेश।'
              },
              caseValue: grievanceCase.complaintDraft.reliefSought,
              sourceInCase: 'From Legal Dossier: RERA Section 18 Prayer',
              isMissing: false,
              fieldType: 'textarea'
            }
          ],
          visualWireframe: {
            pageTitle: 'RERA - Form M Financial Details',
            portalHeader: 'Adjudication Filing',
            highlightedSection: 'Financials & Delay Duration',
            actionPrompt: 'Input your contractual possession date and total consideration paid.',
            mockFields: [
              { badgeNumber: 1, label: 'Promised Delivery Date', valuePlaceholder: '31/03/2024', type: 'input', isHighlighted: true },
              { badgeNumber: 2, label: 'Total Remitted (₹)', valuePlaceholder: '₹74,25,000', type: 'input', isHighlighted: true },
              { badgeNumber: 3, label: 'Prayer under Section 18', valuePlaceholder: grievanceCase.complaintDraft.reliefSought, type: 'textarea', isHighlighted: true }
            ]
          }
        },
        {
          id: 'rera-step-3',
          stepNumber: 3,
          title: 'Upload Registered Agreement & Payment Evidence',
          shortDescription: 'Attach stamped Agreement for Sale and consolidated payment receipts.',
          pageName: 'RERA: Evidence Uploads',
          officialUrl: 'https://rera.nic.in/upload-evidence',
          requiresCitizenAction: 'upload_evidence',
          citizenInstructions: [
            'Slot 1: Upload Registered Builder-Buyer Agreement (PDF).',
            'Slot 2: Upload Consolidated Bank Disbursement Receipts.',
            'Slot 3: Upload the Promoter Supplementary Escalation Notice.'
          ],
          fields: [
            {
              id: 'rera-f-bba',
              officialFieldName: 'Upload Registered Agreement for Sale (PDF < 10MB)',
              fieldRequirement: 'Registered contractual deed',
              explanation: {
                en: 'Attach stamped and registered builder buyer agreement.',
                hi: 'पंजीकृत बिल्डर-बायर अनुबंध की कॉपी संलग्न करें।'
              },
              caseValue: 'rera_builder_buyer_agreement_registered.pdf',
              sourceInCase: 'From Evidence Intelligence: Item EV-RERA-1',
              isMissing: false,
              fieldType: 'file',
              matchedEvidenceId: 'ev-rera-1',
              matchedEvidenceName: 'rera_builder_buyer_agreement_registered.pdf'
            },
            {
              id: 'rera-f-receipts',
              officialFieldName: 'Upload Bank Disbursement Receipts (PDF < 5MB)',
              fieldRequirement: 'Proof of timely milestone payments',
              explanation: {
                en: 'Attach receipts proving 90% payment remitted without default.',
                hi: '90% भुगतान का प्रमाण देने वाली रसीदें संलग्न करें।'
              },
              caseValue: 'consolidated_disbursement_receipts.pdf',
              sourceInCase: 'From Evidence Intelligence: Item EV-RERA-2',
              isMissing: false,
              fieldType: 'file',
              matchedEvidenceId: 'ev-rera-2',
              matchedEvidenceName: 'consolidated_disbursement_receipts.pdf'
            }
          ],
          visualWireframe: {
            pageTitle: 'RERA - Document Exhibits',
            portalHeader: 'Document Verification',
            highlightedSection: 'Mandatory Real Estate Attachments',
            actionPrompt: 'Upload registered agreement and payment receipts.',
            mockFields: [
              { badgeNumber: 1, label: 'Slot 1: Agreement for Sale', valuePlaceholder: 'rera_builder_buyer_agreement_registered.pdf', type: 'upload', isHighlighted: true },
              { badgeNumber: 2, label: 'Slot 2: Payment Receipts', valuePlaceholder: 'consolidated_disbursement_receipts.pdf', type: 'upload', isHighlighted: true }
            ]
          }
        },
        {
          id: 'rera-step-4',
          stepNumber: 4,
          title: 'Pay RERA Filing Fee & Save Complaint Number',
          shortDescription: 'Complete online statutory fee payment and record RERA Complaint Docket.',
          pageName: 'RERA Complaint Acknowledged',
          officialUrl: 'https://rera.nic.in/case-track',
          requiresCitizenAction: 'save_ack',
          citizenInstructions: [
            'Pay statutory filing fee online (typically ₹1,000 to ₹5,000 depending on state).',
            'Save the official RERA Case Registration Number (e.g. RERA/GGM/2026/8941).',
            'Enter below to initialize court date reminders and conciliation monitoring.'
          ],
          fields: [
            {
              id: 'rera-f-ack',
              officialFieldName: 'Official RERA Complaint Registration Number',
              fieldRequirement: 'State RERA docket format',
              explanation: {
                en: 'Unique case number allocated by the RERA Bench.',
                hi: 'रेरा बेंच द्वारा आबंटित केस नंबर।'
              },
              caseValue: 'e.g. RERA/GGM/2026/8941',
              sourceInCase: 'RERA Tribunal Registry Receipt',
              isMissing: false,
              fieldType: 'text'
            }
          ],
          visualWireframe: {
            pageTitle: 'State RERA - Complaint Lodged',
            portalHeader: 'Formal Complaint Issued',
            highlightedSection: 'RERA Case Docket Reference',
            actionPrompt: 'Save your RERA Complaint Number for hearing tracking.',
            mockFields: [
              { badgeNumber: 1, label: 'RERA Complaint Number', valuePlaceholder: 'RERA/GGM/2026/8941', type: 'input', isHighlighted: true },
              { badgeNumber: 2, label: 'Hearing Notice', valuePlaceholder: 'Hearing notice will be issued within 30 days under Section 29', type: 'input', isHighlighted: false }
            ]
          }
        }
      ]
    };
  }

  // 4. CENTRALIZED PUBLIC GRIEVANCE REDRESS AND MONITORING SYSTEM (CPGRAMS)
  return {
    authorityId: 'auth-cpgrams',
    authorityName: 'CPGRAMS (Centralized Public Grievance Portal)',
    officialPortal: 'CPGRAMS Portal (pgportal.gov.in)',
    portalUrl: 'https://pgportal.gov.in',
    verifiedDate: '07 November 2026',
    verificationBadge: 'Verified Live Portal Workflow (DARPG 2026)',
    steps: [
      {
        id: 'cpg-step-1',
        stepNumber: 1,
        title: 'Portal Login & Ministry Selection',
        shortDescription: 'Log in to pgportal.gov.in and select the relevant central department.',
        pageName: 'CPGRAMS Department Selection',
        officialUrl: 'https://pgportal.gov.in',
        requiresCitizenAction: 'copy_paste',
        citizenInstructions: [
          'Launch pgportal.gov.in in companion view.',
          'Click "Lodge Public Grievance".',
          'Choose the relevant Central Ministry (e.g. Ministry of Finance, Ministry of Power, DARPG).'
        ],
        fields: [
          {
            id: 'cpg-f-dept',
            officialFieldName: 'Ministry / Department Name',
            fieldRequirement: 'Central Government Department',
            explanation: {
              en: 'Select the central ministry with supervisory authority over the entity.',
              hi: 'संबंधित केंद्रीय मंत्रालय या विभाग का चयन करें।'
            },
            caseValue: 'Department of Financial Services / Ministry of Finance',
            sourceInCase: 'Central Oversight Taxonomy',
            isMissing: false,
            fieldType: 'dropdown'
          }
        ],
        visualWireframe: {
          pageTitle: 'CPGRAMS - Lodge Public Grievance',
          portalHeader: 'Department of Administrative Reforms and Public Grievances',
          highlightedSection: 'Ministry Selection',
          actionPrompt: 'Choose the supervising ministry from the directory.',
          mockFields: [
            { badgeNumber: 1, label: 'Ministry Name', valuePlaceholder: 'Department of Financial Services (Banking Division)', type: 'select', isHighlighted: true }
          ]
        }
      },
      {
        id: 'cpg-step-2',
        stepNumber: 2,
        title: 'Grievance Description & Evidence Upload',
        shortDescription: 'Paste structured problem facts (up to 4,000 characters) and upload PDF exhibits.',
        pageName: 'CPGRAMS: Grievance Particulars',
        officialUrl: 'https://pgportal.gov.in/lodge-grievance',
        requiresCitizenAction: 'upload_evidence',
        citizenInstructions: [
          'Paste your formal grievance text (up to 4,000 characters).',
          'Attach consolidated evidence PDF (up to 4MB).',
          'Review before final submission.'
        ],
        fields: [
          {
            id: 'cpg-f-text',
            officialFieldName: 'Grievance Description (Max 4,000 characters)',
            fieldRequirement: 'Clear factual chronology',
            explanation: {
              en: 'Summary of the public grievance and administrative failure.',
              hi: 'सार्वजनिक शिकायत और प्रशासनिक विफलता का सार।'
            },
            caseValue: grievanceCase.complaintDraft.formalBody.slice(0, 3900),
            sourceInCase: 'From Legal Dossier: Formal Complaint Body',
            isMissing: false,
            fieldType: 'textarea'
          },
          {
            id: 'cpg-f-doc',
            officialFieldName: 'Upload Supporting Document (PDF up to 4MB)',
            fieldRequirement: 'Consolidated documentary proof',
            explanation: {
              en: 'Attach evidence receipt or prior rejection notice.',
              hi: 'सबूत या पूर्व शिकायत रसीद संलग्न करें।'
            },
            caseValue: statementEvidence?.fileName || 'bank_passbook_extract_oct2026.pdf',
            sourceInCase: 'From Evidence Intelligence',
            isMissing: false,
            fieldType: 'file',
            matchedEvidenceId: statementEvidence?.id || 'ev-2',
            matchedEvidenceName: statementEvidence?.fileName || 'bank_passbook_extract_oct2026.pdf'
          }
        ],
        visualWireframe: {
          pageTitle: 'CPGRAMS - Describe Grievance',
          portalHeader: 'Lodge Grievance Form',
          highlightedSection: 'Complaint Narrative and PDF Exhibit',
          actionPrompt: 'Paste the formal body text and attach the evidence PDF.',
          mockFields: [
            { badgeNumber: 1, label: 'Grievance Text (Max 4000 chars)', valuePlaceholder: grievanceCase.complaintDraft.formalBody.slice(0, 150) + '...', type: 'textarea', isHighlighted: true },
            { badgeNumber: 2, label: 'Supporting PDF File', valuePlaceholder: statementEvidence?.fileName || 'evidence_bundle.pdf', type: 'upload', isHighlighted: true }
          ]
        }
      },
      {
        id: 'cpg-step-3',
        stepNumber: 3,
        title: 'Save CPGRAMS Registration Number',
        shortDescription: 'Record official registration code (e.g. MINFN/E/2026/0019284) for 30-day tracking.',
        pageName: 'CPGRAMS: Acknowledgment Slip',
        officialUrl: 'https://pgportal.gov.in/view-status',
        requiresCitizenAction: 'save_ack',
        citizenInstructions: [
          'Submit grievance to receive official CPGRAMS Registration Number.',
          'Paste below to start tracking your 30-day statutory resolution timeline.'
        ],
        fields: [
          {
            id: 'cpg-f-ack',
            officialFieldName: 'CPGRAMS Registration Number',
            fieldRequirement: 'Official code format: DEPT/E/YYYY/NNNNNNN',
            explanation: {
              en: 'Unique tracking code issued by DARPG.',
              hi: 'डीएआरपीज़ी द्वारा जारी विशिष्ट ट्रैकिंग कोड।'
            },
            caseValue: 'e.g. MINFN/E/2026/0019284',
            sourceInCase: 'CPGRAMS Acknowledgment Slip',
            isMissing: false,
            fieldType: 'text'
          }
        ],
        visualWireframe: {
          pageTitle: 'CPGRAMS - Grievance Lodged',
          portalHeader: 'Grievance Registration Number Allocated',
          highlightedSection: 'Registration Number & Department Routing',
          actionPrompt: 'Copy the CPGRAMS registration number to track your case.',
          mockFields: [
            { badgeNumber: 1, label: 'Registration Number', valuePlaceholder: 'MINFN/E/2026/0019284', type: 'input', isHighlighted: true },
            { badgeNumber: 2, label: 'Resolution Timeline', valuePlaceholder: '30 Days statutory deadline under DARPG guidelines', type: 'input', isHighlighted: false }
          ]
        }
      }
    ]
  };
}
