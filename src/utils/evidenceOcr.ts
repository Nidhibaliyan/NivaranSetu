/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EvidenceItem, OcrStatus } from '../types';

export interface OcrBoundingBox {
  id: number;
  text: string;
  type: 'header' | 'amount' | 'date' | 'id' | 'body';
  topPercent: number;
  leftPercent: number;
  widthPercent: number;
  heightPercent: number;
}

export interface ExhibitOcrData {
  status: OcrStatus | 'demo' | 'empty';
  hasGenuineOcr: boolean;
  rawText: string;
  confidence: number;
  engine: string;
  dpi: number;
  charCount: number;
  lineCount: number;
  boundingBoxes: OcrBoundingBox[];
}

/**
 * Checks whether an EvidenceItem holds any genuine extracted OCR text or structured entities.
 */
export function hasGenuineOcrContent(item?: EvidenceItem): boolean {
  if (!item) return false;
  if (item.rawOcrText && item.rawOcrText.trim().length > 0) {
    return true;
  }
  const ext = item.ocrExtracted;
  if (!ext) return false;
  return Boolean(
    (Array.isArray(ext.dates) && ext.dates.length > 0) ||
      (Array.isArray(ext.amounts) && ext.amounts.length > 0) ||
      (Array.isArray(ext.identifiers) && ext.identifiers.length > 0) ||
      (Array.isArray(ext.parties) && ext.parties.length > 0) ||
      (typeof ext.summary === 'string' && ext.summary.trim().length > 0)
  );
}

/**
 * Resolves OCR display data for an exhibit.
 *
 * CRITICAL INVARIANTS:
 * 1. Actual uploaded binary files (hasBlob === true) NEVER receive hardcoded SMS, bank statement,
 *    or legal notice demo fixtures, and NEVER receive fabricated threat classifications or bounding boxes.
 * 2. When genuine OCR results are unavailable for an uploaded file, returns an honest
 *    "OCR scan pending" or "No text detected" state with 0 confidence and 0 bounding boxes.
 * 3. Pre-seeded synthetic demonstration exhibits (hasBlob !== true, status not pending/no_text)
 *    preserve their demonstration fixtures for walkthrough scenarios.
 */
export function resolveExhibitOcrData(item?: EvidenceItem): ExhibitOcrData {
  if (!item) {
    return {
      status: 'empty',
      hasGenuineOcr: false,
      rawText: 'NO DOCUMENT SELECTED',
      confidence: 0,
      engine: 'NivaranSetu OCR Pipeline',
      dpi: 300,
      charCount: 0,
      lineCount: 0,
      boundingBoxes: [],
    };
  }

  const effectiveStatus = item.ocrStatus || item.ocrExtracted?.status;
  const hasContent = hasGenuineOcrContent(item);

  // Explicit no-text or failed OCR state (applies to any exhibit)
  if (effectiveStatus === 'no_text') {
    const text = 'No text detected in this exhibit.';
    return {
      status: 'no_text',
      hasGenuineOcr: false,
      rawText: text,
      confidence: 0,
      engine: 'NivaranSetu OCR Pipeline (No Text Detected)',
      dpi: 300,
      charCount: text.length,
      lineCount: 1,
      boundingBoxes: [],
    };
  }

  if (effectiveStatus === 'failed') {
    const text = 'OCR scan failed or could not process this exhibit.';
    return {
      status: 'failed',
      hasGenuineOcr: false,
      rawText: text,
      confidence: 0,
      engine: 'NivaranSetu OCR Pipeline (Unavailable)',
      dpi: 300,
      charCount: text.length,
      lineCount: 1,
      boundingBoxes: [],
    };
  }

  // Real uploaded binary files (hasBlob === true): NEVER run demo fixtures or invent bounding boxes
  if (item.hasBlob === true) {
    if (effectiveStatus === 'pending' || !hasContent) {
      const text = 'OCR scan pending — no extracted text is available for this uploaded file yet.';
      return {
        status: 'pending',
        hasGenuineOcr: false,
        rawText: text,
        confidence: 0,
        engine: 'NivaranSetu OCR Pipeline (Pending)',
        dpi: 300,
        charCount: text.length,
        lineCount: 1,
        boundingBoxes: [],
      };
    }

    // Genuine OCR output exists on the uploaded exhibit (stored via rawOcrText or verified ocrExtracted)
    const genuineText = item.rawOcrText?.trim()
      ? item.rawOcrText.trim()
      : [
          `EXHIBIT: ${item.title}`,
          `FILE: ${item.fileName}`,
          item.ocrExtracted.identifiers.length > 0
            ? `IDENTIFIERS: ${item.ocrExtracted.identifiers.join(', ')}`
            : '',
          item.ocrExtracted.amounts.length > 0
            ? `AMOUNTS: ${item.ocrExtracted.amounts.join(', ')}`
            : '',
          item.ocrExtracted.dates.length > 0
            ? `DATES: ${item.ocrExtracted.dates.join(', ')}`
            : '',
          item.ocrExtracted.parties.length > 0
            ? `PARTIES: ${item.ocrExtracted.parties.join(', ')}`
            : '',
          item.ocrExtracted.summary?.trim()
            ? `SUMMARY: ${item.ocrExtracted.summary.trim()}`
            : '',
        ]
          .filter(Boolean)
          .join('\n');

    return {
      status: 'processed',
      hasGenuineOcr: true,
      rawText: genuineText,
      confidence: 0,
      engine: 'Stored Exhibit OCR Record',
      dpi: 300,
      charCount: genuineText.length,
      lineCount: genuineText.split('\n').length,
      boundingBoxes: [],
    };
  }

  // Non-blob items explicitly marked pending
  if (effectiveStatus === 'pending' || !hasContent) {
    const text = 'OCR scan pending — no extracted text is available.';
    return {
      status: 'pending',
      hasGenuineOcr: false,
      rawText: text,
      confidence: 0,
      engine: 'NivaranSetu OCR Pipeline (Pending)',
      dpi: 300,
      charCount: text.length,
      lineCount: 1,
      boundingBoxes: [],
    };
  }

  // =========================================================================
  // PRE-SEEDED DEMO EXHIBITS ONLY (hasBlob !== true && hasContent === true)
  // Preserves demonstration walkthroughs for sample scenarios in INITIAL_CASES
  // =========================================================================
  const titleLower = item.title.toLowerCase();
  const isSms = titleLower.includes('sms') || item.category === 'screenshot';
  const isStatement =
    titleLower.includes('statement') ||
    titleLower.includes('passbook') ||
    item.category === 'bank_statement';
  const isCyberAck = titleLower.includes('cyber') || titleLower.includes('ack');

  if (isSms) {
    const text = `[SMS HEADER: VM-POWURG]
TIMESTAMP: 2026-10-28 17:42:10 IST
FROM: VM-POWURG
TO: Complainant Mobile

Dear Consumer,
Your Electricity power connection will be disconnected tonight
at 9.30 pm from power office because your previous month bill was
not updated. Please immediately update your bill by calling our
power officer or install the Discom bill verification utility:
http://quick-bill-pay.apk/verify?bill=12.00
Threat level: Urgent / Action required before 21:30 hrs.
Electricity Department Helpline.`;

    return {
      status: 'demo',
      hasGenuineOcr: false,
      rawText: text,
      confidence: 99.1,
      engine: 'NivaranSetu Demo Fixture (Sample Exhibit)',
      dpi: 300,
      charCount: text.length,
      lineCount: text.split('\n').length,
      boundingBoxes: [
        { id: 1, text: 'VM-POWURG Header', type: 'header', topPercent: 8, leftPercent: 12, widthPercent: 45, heightPercent: 9 },
        { id: 2, text: 'Timestamp: 2026-10-28 17:42', type: 'date', topPercent: 20, leftPercent: 12, widthPercent: 65, heightPercent: 8 },
        { id: 3, text: 'Threat Message Body', type: 'body', topPercent: 32, leftPercent: 12, widthPercent: 78, heightPercent: 26 },
        { id: 4, text: 'quick-bill-pay.apk URL', type: 'id', topPercent: 62, leftPercent: 12, widthPercent: 60, heightPercent: 10 },
        { id: 5, text: 'Disconnection 21:30 Warning', type: 'amount', topPercent: 76, leftPercent: 12, widthPercent: 70, heightPercent: 12 },
      ],
    };
  }

  if (isStatement) {
    const text = `======================================================
APEX BANK OF INDIA - SHIVAJINAGAR PUNE BRANCH
STATEMENT OF ACCOUNT: SAVINGS BANK (INR)
A/C NO: **********4910 | IFSC: APEX0001082
NAME: RAJESH M. JOSHI
STATEMENT PERIOD: 01-OCT-2026 TO 31-OCT-2026
------------------------------------------------------
DATE        PARTICULARS                   CHQ/REF        DEBIT (INR)    CREDIT (INR)   BALANCE (INR)
2026-10-28  UPI/42890128912/ref-collect92 42890128912    15,000.00      -              82,410.50
2026-10-28  UPI/42890128955/ref-collect92 42890128955    15,000.00      -              67,410.50
2026-10-28  UPI/42890129001/ref-collect92 42890129001    12,500.00      -              54,910.50
------------------------------------------------------
TOTAL DEBITS: INR 42,500.00 [3 TRANSACTIONS]
CHANNEL: MOBILE BANKING UPI / BENEFICIARY: ref-collect92@okaxis
IP ADDRESS OF TRANSACTION: 198.51.100.24 (UNRECOGNIZED LOCATION)
======================================================`;

    return {
      status: 'demo',
      hasGenuineOcr: false,
      rawText: text,
      confidence: 98.7,
      engine: 'NivaranSetu Demo Fixture (Sample Exhibit)',
      dpi: 300,
      charCount: text.length,
      lineCount: text.split('\n').length,
      boundingBoxes: [
        { id: 1, text: 'Apex Bank of India Header', type: 'header', topPercent: 6, leftPercent: 10, widthPercent: 80, heightPercent: 10 },
        { id: 2, text: 'A/c No: **********4910', type: 'id', topPercent: 18, leftPercent: 10, widthPercent: 45, heightPercent: 8 },
        { id: 3, text: 'Debit 1: ₹15,000.00 (Ref 42890128912)', type: 'amount', topPercent: 38, leftPercent: 8, widthPercent: 84, heightPercent: 11 },
        { id: 4, text: 'Debit 2: ₹15,000.00 (Ref 42890128955)', type: 'amount', topPercent: 50, leftPercent: 8, widthPercent: 84, heightPercent: 11 },
        { id: 5, text: 'Debit 3: ₹12,500.00 (Ref 42890129001)', type: 'amount', topPercent: 62, leftPercent: 8, widthPercent: 84, heightPercent: 11 },
        { id: 6, text: 'Total Disputed: INR 42,500.00', type: 'amount', topPercent: 76, leftPercent: 10, widthPercent: 78, heightPercent: 10 },
      ],
    };
  }

  if (isCyberAck) {
    const text = `GOVERNMENT OF INDIA - MINISTRY OF HOME AFFAIRS
NATIONAL CYBER CRIME REPORTING PORTAL (cybercrime.gov.in)
OFFICIAL ACKNOWLEDGEMENT SLIP
------------------------------------------------------
Acknowledgement Number: 2026-MH-94812
Date & Time of Registration: 28-10-2026 19:15:33 IST
Complainant Name: Rajesh M. Joshi
Incident Category: Financial Fraud - UPI / Remote Access Malware
Disputed Amount Debited: ₹42,500.00
Suspect Payment Handle: ref-collect92@okaxis
Bank Remittance Account: Apex Bank of India Savings A/c **4910
Police Jurisdiction: Cyber Crime Cell, Shivajinagar Police Station
Legal Statute: Section 66D IT Act 2008 & Section 420 IPC
Status: Assigned to Investigating Officer (IO)`;

    return {
      status: 'demo',
      hasGenuineOcr: false,
      rawText: text,
      confidence: 99.4,
      engine: 'NivaranSetu Demo Fixture (Sample Exhibit)',
      dpi: 300,
      charCount: text.length,
      lineCount: text.split('\n').length,
      boundingBoxes: [
        { id: 1, text: 'National Cyber Crime Reporting Portal', type: 'header', topPercent: 7, leftPercent: 10, widthPercent: 80, heightPercent: 12 },
        { id: 2, text: 'Ack No: 2026-MH-94812', type: 'id', topPercent: 22, leftPercent: 10, widthPercent: 55, heightPercent: 9 },
        { id: 3, text: 'Date: 28-10-2026 19:15:33', type: 'date', topPercent: 33, leftPercent: 10, widthPercent: 60, heightPercent: 9 },
        { id: 4, text: 'Amount: ₹42,500.00', type: 'amount', topPercent: 54, leftPercent: 10, widthPercent: 50, heightPercent: 9 },
        { id: 5, text: 'Section 66D IT Act / 420 IPC', type: 'id', topPercent: 75, leftPercent: 10, widthPercent: 70, heightPercent: 10 },
      ],
    };
  }

  const genericText = `EXHIBIT TITLE: ${item.title.toUpperCase()}
FILENAME: ${item.fileName}
DATE RECORDED: ${item.uploadDate}
HASH (SHA-256): ${item.sha256Hash || 'Metadata only (Demo exhibit)'}
------------------------------------------------------
EXTRACTED IDENTIFIERS:
${item.ocrExtracted.identifiers.map((id) => `• ${id}`).join('\n') || '• None detected'}

EXTRACTED MONETARY AMOUNTS:
${item.ocrExtracted.amounts.map((am) => `• ${am}`).join('\n') || '• None detected'}

EXTRACTED DATES & TIMESTAMPS:
${item.ocrExtracted.dates.map((d) => `• ${d}`).join('\n') || '• None detected'}

PARTIES NAMED:
${item.ocrExtracted.parties.map((p) => `• ${p}`).join('\n') || '• None detected'}

DOCUMENT SUMMARY:
${item.ocrExtracted.summary || 'None'}`;

  return {
    status: 'demo',
    hasGenuineOcr: false,
    rawText: genericText,
    confidence: 97.5,
    engine: 'NivaranSetu Demo Fixture (Sample Exhibit)',
    dpi: 300,
    charCount: genericText.length,
    lineCount: genericText.split('\n').length,
    boundingBoxes: [
      { id: 1, text: 'Document Title Header', type: 'header', topPercent: 8, leftPercent: 10, widthPercent: 80, heightPercent: 10 },
      { id: 2, text: 'Document Date & Hash', type: 'date', topPercent: 22, leftPercent: 10, widthPercent: 75, heightPercent: 12 },
      { id: 3, text: 'Extracted Amounts & Figures', type: 'amount', topPercent: 42, leftPercent: 10, widthPercent: 80, heightPercent: 20 },
      { id: 4, text: 'Summary of Evidentiary Content', type: 'body', topPercent: 68, leftPercent: 10, widthPercent: 80, heightPercent: 22 },
    ],
  };
}
