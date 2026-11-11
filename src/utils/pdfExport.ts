import jsPDF from 'jspdf';
import { GrievanceCase } from '../types';

export const exportCaseDossierToPDF = (
  c: GrievanceCase,
  options?: { mode?: 'simple' | 'detailed'; citizenName?: string }
): void => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const citizenMode = options?.mode || 'detailed';
  const citizenName = options?.citizenName?.trim() || 'Citizen Complainant';

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Helper to check page break
  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin - 10) {
      doc.addPage();
      y = margin + 5;
      drawHeaderWatermark();
    }
  };

  const drawHeaderWatermark = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`NivaranSetu Grievance Dossier · Ref: ${c.id}`, margin, margin - 6);
    doc.text(
      `Page ${doc.getNumberOfPages()}`,
      pageWidth - margin,
      margin - 6,
      { align: 'right' }
    );
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.3);
    doc.line(margin, margin - 4, pageWidth - margin, margin - 4);
  };

  // 1. BRAND HEADER / LETTERHEAD
  // Top Banner
  doc.setFillColor(9, 9, 11); // Jet Black
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'F');

  // Cerulean Blue accent pill/badge on the left
  doc.setFillColor(0, 127, 255);
  doc.rect(margin, y, 4, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('NIVARANSETU · CITIZEN GRIEVANCE DOSSIER', margin + 8, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(200, 210, 230);
  doc.text(
    'A Bridge to Resolution · Evidence Synthesis & Statutory Routing Package',
    margin + 8,
    y + 15
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 127, 255);
  doc.text(`CASE REF: ${c.id}`, pageWidth - margin - 6, y + 9, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-IN')}`,
    pageWidth - margin - 6,
    y + 15,
    { align: 'right' }
  );

  y += 30;

  // 2. METADATA SUMMARY STRIP (2 columns / cards)
  doc.setFillColor(244, 244, 245);
  doc.roundedRect(margin, y, contentWidth, 26, 1.5, 1.5, 'F');
  doc.setDrawColor(220, 220, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, 26, 1.5, 1.5, 'S');

  // Column 1
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 120);
  doc.text('GRIEVANCE CATEGORY', margin + 4, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 25);
  doc.text(c.category.replace(/_/g, ' ').toUpperCase(), margin + 4, y + 11);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 120);
  doc.text('INVOLVED RESPONDENT / ENTITY', margin + 4, y + 17);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(20, 20, 25);
  doc.text(c.involvedEntity, margin + 4, y + 22);

  // Column 2
  const col2X = margin + contentWidth * 0.52;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 120);
  doc.text('INCIDENT DATE & LOCATION', col2X, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(20, 20, 25);
  doc.text(`${c.incidentDate} · ${c.incidentLocation}`, col2X, y + 11);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 120);
  doc.text('DISPUTED VALUE · READINESS SCORE', col2X, y + 17);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 127, 255);
  const amtStr = c.disputedAmount ? `INR ${c.disputedAmount.toLocaleString('en-IN')}` : 'Non-Monetary';
  doc.text(`${amtStr} · Readiness: ${c.readinessScore}%`, col2X, y + 22);

  y += 32;

  // SECTION HELPER
  const printSectionHeader = (numberStr: string, titleStr: string) => {
    checkPageBreak(14);
    doc.setFillColor(0, 127, 255);
    doc.rect(margin, y, 2.5, 5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(9, 9, 11);
    doc.text(`${numberStr}. ${titleStr}`, margin + 5, y + 4.2);

    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.2);
    doc.line(margin + 5, y + 6.5, pageWidth - margin, y + 6.5);
    y += 10;
  };

  // 3. SECTION 01: EXECUTIVE CASE SUMMARY & NARRATIVE
  printSectionHeader('01', 'Executive Case Narrative');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 25);
  const titleLines = doc.splitTextToSize(c.title, contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 4.5 + 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 70);
  const narrativeText = citizenMode === 'simple' ? c.simpleSummary : c.description;
  const narrativeLines = doc.splitTextToSize(narrativeText, contentWidth);
  doc.text(narrativeLines, margin, y);
  y += narrativeLines.length * 4.2 + 6;

  // 4. SECTION 02: CHRONOLOGICAL FACT TIMELINE
  printSectionHeader('02', 'Chronological Incident Timeline');

  c.timeline.forEach((item, idx) => {
    const descLines = doc.splitTextToSize(item.description, contentWidth - 28);
    const itemHeight = Math.max(14, descLines.length * 4 + 7);
    checkPageBreak(itemHeight);

    // Number bullet
    doc.setFillColor(240, 244, 250);
    doc.roundedRect(margin, y, 6, 6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 127, 255);
    doc.text(`${idx + 1}`, margin + 3, y + 4.2, { align: 'center' });

    // Date
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 110);
    doc.text(item.date, margin + 9, y + 4.2);

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(20, 20, 25);
    doc.text(item.title, margin + 35, y + 4.2);

    // Description
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 80);
    doc.text(descLines, margin + 9, y + 8.5);

    y += itemHeight;
  });

  y += 4;

  // 5. SECTION 03: EVIDENCE EXHIBITS & CUSTODY DIGESTS (TABLE)
  printSectionHeader('03', 'Evidence Exhibit Index (Custody Verified)');

  checkPageBreak(25);
  // Table Header
  doc.setFillColor(244, 244, 245);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 100);
  doc.text('EXHIBIT', margin + 2, y + 4.2);
  doc.text('DOCUMENT / FILE NAME', margin + 20, y + 4.2);
  doc.text('CATEGORY', margin + 85, y + 4.2);
  doc.text('SHA-256 INTEGRITY DIGEST', margin + 115, y + 4.2);
  doc.text('STATUS', pageWidth - margin - 2, y + 4.2, { align: 'right' });
  y += 7;

  c.evidence.forEach((ev, idx) => {
    checkPageBreak(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 127, 255);
    doc.text(`Ex-0${idx + 1}`, margin + 2, y + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(20, 20, 25);
    doc.text(ev.title.slice(0, 35), margin + 20, y + 3.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 130);
    doc.text(`${ev.fileName} (${ev.fileSize})`, margin + 20, y + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(70, 70, 80);
    doc.text(ev.category.toUpperCase(), margin + 85, y + 4);

    // Hash display (truncated monospace style)
    doc.setFont('courier', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(80, 80, 90);
    const hashText = ev.sha256Hash
      ? `${ev.sha256Hash.substring(0, 32)}...`
      : 'Metadata only';
    doc.text(hashText, margin + 115, y + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    if (ev.verifiedOriginal) {
      doc.setTextColor(22, 163, 74); // Emerald Green
      doc.text('Verified', pageWidth - margin - 2, y + 4, { align: 'right' });
    } else {
      doc.setTextColor(150, 150, 160); // Neutral Gray
      doc.text('Unverified', pageWidth - margin - 2, y + 4, { align: 'right' });
    }

    doc.setDrawColor(240, 240, 245);
    doc.setLineWidth(0.2);
    doc.line(margin, y + 9, pageWidth - margin, y + 9);
    y += 10;
  });

  y += 4;

  // 6. SECTION 04: STATUTORY AUTHORITY & FILING INSTRUCTIONS
  printSectionHeader('04', 'Recommended Statutory Authority & Routing');

  checkPageBreak(25);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentWidth, 22, 1.5, 1.5, 'F');
  doc.setDrawColor(210, 225, 245);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, 22, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 127, 255);
  doc.text(`Authority: ${c.recommendedAuthority.name}`, margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 60);
  doc.text(
    `Official Filing Portal: ${c.recommendedAuthority.portalName} (${c.recommendedAuthority.portalUrl})`,
    margin + 4,
    y + 11
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(90, 90, 100);
  doc.text(
    `Statutory Filing Fee: ${c.recommendedAuthority.filingFee}  ·  Expected Benchmark: ${c.recommendedAuthority.averageResolutionTime}`,
    margin + 4,
    y + 16
  );

  y += 28;

  // 7. SECTION 05: FORMAL COMPLAINT DRAFT (READY TO SUBMIT)
  printSectionHeader('05', 'Formal Grievance Complaint Draft');

  checkPageBreak(12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 120);
  doc.text('SUBJECT LINE:', margin, y);
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(20, 20, 25);
  const subjLines = doc.splitTextToSize(c.complaintDraft.subject, contentWidth);
  doc.text(subjLines, margin, y);
  y += subjLines.length * 4.2 + 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 120);
  doc.text('COMPLAINT BODY STATEMENT:', margin, y);
  y += 4;

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 30, 40);
  const draftBody = citizenMode === 'simple' ? c.complaintDraft.simpleBody : c.complaintDraft.formalBody;
  const bodyLines = doc.splitTextToSize(draftBody, contentWidth);

  // Print draft body with proper pagination
  bodyLines.forEach((line: string) => {
    checkPageBreak(5);
    doc.text(line, margin, y);
    y += 4;
  });

  y += 4;
  checkPageBreak(14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 120);
  doc.text('RELIEF / COMPENSATION SOUGHT:', margin, y);
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 127, 255);
  const reliefLines = doc.splitTextToSize(c.complaintDraft.reliefSought, contentWidth);
  doc.text(reliefLines, margin, y);
  y += reliefLines.length * 4.2 + 8;

  // 8. EXTERNAL PORTAL SUBMISSION & SMART CASE MONITORING
  checkPageBreak(30);
  doc.setFillColor(244, 244, 245);
  doc.roundedRect(margin, y, contentWidth, 6, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 127, 255);
  doc.text('08. POST-SUBMISSION STATUS & SMART CASE MONITORING RECORD', margin + 3, y + 4.2);
  y += 9;

  const docketRef = c.monitoring?.docketNumber || c.filingDetails?.referenceNumber || 'Pending Filing';
  const subDate = c.monitoring?.submissionDate || c.filingDetails?.filingDate || 'Not recorded';
  const statusLabel = c.monitoring?.citizenReportedStatus
    ? `${c.monitoring.citizenReportedStatus.replace(/_/g, ' ').toUpperCase()} (CITIZEN-REPORTED)`
    : 'PREPARATION STAGE';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 70);
  doc.text(`Official Docket Ref: ${docketRef}`, margin, y);
  doc.text(`Submission Date: ${subDate}`, margin + 65, y);
  doc.text(`Status: ${statusLabel}`, margin + 120, y);
  y += 5;

  const remindersCount = c.monitoring?.reminders?.length || 0;
  const responsesCount = c.monitoring?.responses?.length || 0;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 100, 110);
  doc.text(
    `In-App Reminders: ${remindersCount} scheduled · Entity Responses Logged: ${responsesCount} (SHA-256 verified in local IndexedDB)`,
    margin,
    y
  );
  y += 8;

  // 9. CITIZEN VERIFICATION SIGN-OFF & LEGAL DISCLAIMER
  checkPageBreak(35);
  doc.setDrawColor(200, 200, 210);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 50);
  doc.text('CITIZEN VERIFICATION & DECLARATION', margin, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 100);
  doc.text(
    'I hereby verify that the facts stated above and documents indexed are true to the best of my knowledge.',
    margin,
    y
  );
  y += 8;

  // Signature Block
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(50, 50, 60);
  doc.text(`Complainant Name: ${citizenName}`, margin, y);
  doc.text(`Signature: __________________________`, pageWidth - margin - 60, y);
  y += 5;
  doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, margin, y);
  doc.text(`Location: ${c.incidentLocation}`, pageWidth - margin - 60, y);
  y += 8;

  // Footer Disclaimer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.8);
  doc.setTextColor(130, 130, 140);
  doc.text(
    'Disclaimer: NivaranSetu is an informational intelligence platform. This dossier assists citizens in organizing evidence and does not constitute a certified legal pleading or guarantee of statutory outcome.',
    margin,
    y
  );

  // Add watermarks to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 150);
    doc.text(`NivaranSetu Dossier · ${c.id}`, margin, pageHeight - 6);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, {
      align: 'right',
    });
  }

  // Save the document with clean formatted filename
  const cleanId = c.id.replace(/[^a-zA-Z0-9-]/g, '_');
  doc.save(`NivaranSetu_Case_Dossier_${cleanId}.pdf`);
};
