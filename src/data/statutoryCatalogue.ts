/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// =============================================================================
// NIVARANSETU STATUTORY & REGULATORY CATALOGUE
// Deterministic, immutable catalogue of central Indian criminal, cyber, banking,
// and consumer protection statutes. Sourced directly from official gazetted
// publications (India Code and Reserve Bank of India Master Directions).
// =============================================================================

export interface StatutoryPunishment {
  imprisonmentTerm: string;
  fineAmount: string;
  punishmentType:
    | 'mandatory_imprisonment_and_fine'
    | 'imprisonment_or_fine_or_both'
    | 'civil_regulatory_compensation'
    | 'regulatory_liability_direction';
}

export interface StatutoryCatalogueEntry {
  catalogueId: string;
  actTitle: string;
  actNumberAndYear: string;
  sectionNumber: string;
  provisionTitle: string;
  commencementDate: string; // YYYY-MM-DD
  repealDate?: string;      // YYYY-MM-DD
  versionStatus: 'active' | 'repealed_saved' | 'savings_clause' | 'prospective';
  officialSourceUrl: string;
  sourceAuthority: 'Gazette of India / India Code' | 'Reserve Bank of India';
  summaryPlainLanguage: string;
  prescribedPunishment: StatutoryPunishment;
  statutoryIngredients: string[];
  civilRegulatoryRelief?: string;
  appliesToCapacities?: string[]; // Specific to BNS 316(5) / IPC 409
  isSavingsOrInterpretationProvision?: boolean;
}

export interface RbiParagraphEntry {
  paragraphNumber: number;
  subParagraph?: string;
  title: string;
  effectiveDate: string; // YYYY-MM-DD
  applicableUpToDate: string; // YYYY-MM-DD
  officialSourceUrl: string;
  sourceAuthority: string;
  directionTitle: string;
  directionReferenceNumber: string;
  institutionalScope: {
    included: string[];
    excluded: string[];
  };
  summaryPlainLanguage: string;
  ruleSpecification: string;
}

export interface CatalogueMetadata {
  catalogVersion: string;
  lastVerifiedDate: string;
  isExhaustive: boolean;
  disclaimer: string;
  rbiMasterDirectionUpdatedDate: string;
  rbiAmendmentCommencementDate: string;
}

// -----------------------------------------------------------------------------
// CATALOGUE METADATA & NON-EXHAUSTIVE DISCLAIMER
// -----------------------------------------------------------------------------
export const STATUTORY_CATALOGUE_METADATA: CatalogueMetadata = {
  catalogVersion: '2026.11.2',
  lastVerifiedDate: '2026-11-11',
  isExhaustive: false,
  rbiMasterDirectionUpdatedDate: '2026-10-01',
  rbiAmendmentCommencementDate: '2027-01-01',
  disclaimer:
    'This statutory catalogue provides selective reference data for core central financial crime, cyber fraud, commercial banking liability, and consumer protection provisions. It is explicitly non-exhaustive and does not encompass specialized state enactments (such as State Protection of Interest of Depositors Acts or Money Lenders Acts) or sectoral codes outside banking and consumer law. Formal charge framing rests exclusively with investigating police officers and the competent Court under procedural law.',
};

// -----------------------------------------------------------------------------
// 1. BHARATIYA NYAYA SANHITA, 2023 (Act No. 45 of 2023)
// Commencement: 1 July 2024
// Official India Code: https://www.indiacode.nic.in/handle/123456789/2189
// -----------------------------------------------------------------------------
export const BNS_CATALOGUE: Record<string, StatutoryCatalogueEntry> = {
  'BNS-318-4': {
    catalogueId: 'BNS-318-4',
    actTitle: 'Bharatiya Nyaya Sanhita, 2023',
    actNumberAndYear: 'Act No. 45 of 2023',
    sectionNumber: 'Section 318(4)',
    provisionTitle: 'Cheating and dishonestly inducing delivery of property',
    commencementDate: '2024-07-01',
    versionStatus: 'active',
    officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/2189',
    sourceAuthority: 'Gazette of India / India Code',
    summaryPlainLanguage:
      'Punishes deceptive inducement where the perpetrator dishonestly tricks a victim into transferring money, valuable security, or property. Corresponds to legacy Section 420 of the Indian Penal Code.',
    prescribedPunishment: {
      imprisonmentTerm: 'Imprisonment of either description for a term which may extend to 7 years',
      fineAmount: 'Shall also be liable to fine',
      punishmentType: 'mandatory_imprisonment_and_fine',
    },
    statutoryIngredients: [
      'Deception practiced upon the complainant by false representation or fraudulent trick.',
      'Dishonest or fraudulent inducement by the accused causing the complainant to deliver property or money.',
      'Complainant suffered wrongful loss or delivered property as a direct consequence of the deceptive inducement.',
    ],
  },

  'BNS-319-2': {
    catalogueId: 'BNS-319-2',
    actTitle: 'Bharatiya Nyaya Sanhita, 2023',
    actNumberAndYear: 'Act No. 45 of 2023',
    sectionNumber: 'Section 319(2)',
    provisionTitle: 'Punishment for cheating by personation',
    commencementDate: '2024-07-01',
    versionStatus: 'active',
    officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/2189',
    sourceAuthority: 'Gazette of India / India Code',
    summaryPlainLanguage:
      'Punishes cheating by pretending to be someone else, or representing that one is a person other than who one truly is (e.g. impersonating bank officials, police officers, or trusted organizations). Corresponds to legacy Section 419 IPC.',
    prescribedPunishment: {
      imprisonmentTerm: 'Imprisonment of either description for a term which may extend to 5 years',
      fineAmount: 'Or with fine',
      punishmentType: 'imprisonment_or_fine_or_both',
    },
    statutoryIngredients: [
      'Cheating committed as defined under Section 318.',
      'Accused represented themselves to be another known or fictitious person, or represented that they or another person is someone other than who they truly are.',
      'Deceptive assumption of identity induced the victim to act or deliver property.',
    ],
  },

  'BNS-316-2': {
    catalogueId: 'BNS-316-2',
    actTitle: 'Bharatiya Nyaya Sanhita, 2023',
    actNumberAndYear: 'Act No. 45 of 2023',
    sectionNumber: 'Section 316(2)',
    provisionTitle: 'Criminal breach of trust (General)',
    commencementDate: '2024-07-01',
    versionStatus: 'active',
    officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/2189',
    sourceAuthority: 'Gazette of India / India Code',
    summaryPlainLanguage:
      'Punishes dishonest misappropriation, conversion, or unauthorized disposal of property or money that was entrusted to the accused in any manner, or over which the accused had dominion. Corresponds to legacy Section 406 IPC.',
    prescribedPunishment: {
      imprisonmentTerm: 'Imprisonment of either description for a term which may extend to 5 years',
      fineAmount: 'Or with fine',
      punishmentType: 'imprisonment_or_fine_or_both',
    },
    statutoryIngredients: [
      'Property entrusted in any manner, or with any dominion over property.',
      'Dishonest misappropriation or conversion of that property to the accused’s own use.',
      'Dishonest use or disposal in violation of legal direction or contractual terms.',
    ],
  },

  'BNS-316-5': {
    catalogueId: 'BNS-316-5',
    actTitle: 'Bharatiya Nyaya Sanhita, 2023',
    actNumberAndYear: 'Act No. 45 of 2023',
    sectionNumber: 'Section 316(5)',
    provisionTitle:
      'Criminal breach of trust by public servant, or by banker, merchant, factor, broker, attorney or agent',
    commencementDate: '2024-07-01',
    versionStatus: 'active',
    officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/2189',
    sourceAuthority: 'Gazette of India / India Code',
    summaryPlainLanguage:
      'Imposes severe punishment for criminal breach of trust committed strictly by persons acting in specific fiduciary, professional, or commercial capacities. Corresponds to legacy Section 409 IPC. Does NOT apply to external, anonymous cyber fraudsters.',
    prescribedPunishment: {
      imprisonmentTerm:
        'Imprisonment for life, or with imprisonment of either description for a term which may extend to 10 years',
      fineAmount: 'Shall also be liable to fine',
      punishmentType: 'mandatory_imprisonment_and_fine',
    },
    statutoryIngredients: [
      'Property entrusted in any manner, or with any dominion over property.',
      'Accused was entrusted strictly in their capacity as: (1) Public Servant, (2) Banker, (3) Merchant, (4) Factor, (5) Broker, (6) Attorney, or (7) Agent in the way of their business.',
      'Dishonest misappropriation, conversion, use, or disposal committed in that specific commercial or official capacity in violation of legal direction or contract.',
    ],
    appliesToCapacities: [
      'Public Servant',
      'Banker',
      'Merchant',
      'Factor',
      'Broker',
      'Attorney',
      'Agent',
    ],
  },

  'BNS-336-2': {
    catalogueId: 'BNS-336-2',
    actTitle: 'Bharatiya Nyaya Sanhita, 2023',
    actNumberAndYear: 'Act No. 45 of 2023',
    sectionNumber: 'Section 336(2)',
    provisionTitle: 'Punishment for forgery (General)',
    commencementDate: '2024-07-01',
    versionStatus: 'active',
    officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/2189',
    sourceAuthority: 'Gazette of India / India Code',
    summaryPlainLanguage:
      'Punishes general forgery of documents or electronic records where special aggravated intention (such as cheating) is not separately established. Corresponds to legacy Section 465 IPC.',
    prescribedPunishment: {
      imprisonmentTerm: 'Imprisonment of either description for a term which may extend to 2 years',
      fineAmount: 'Or with fine',
      punishmentType: 'imprisonment_or_fine_or_both',
    },
    statutoryIngredients: [
      'Making of a false document or false electronic record as defined in Section 335.',
      'Intent to cause damage or injury to the public or to any person, or to support any claim or title.',
    ],
  },

  'BNS-336-3': {
    catalogueId: 'BNS-336-3',
    actTitle: 'Bharatiya Nyaya Sanhita, 2023',
    actNumberAndYear: 'Act No. 45 of 2023',
    sectionNumber: 'Section 336(3)',
    provisionTitle: 'Forgery for purpose of cheating',
    commencementDate: '2024-07-01',
    versionStatus: 'active',
    officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/2189',
    sourceAuthority: 'Gazette of India / India Code',
    summaryPlainLanguage:
      'Punishes forging a document or electronic record (e.g. fabricated bank statements, forged authorization receipts, fake payment screenshots) with the specific intent that it shall be used for cheating. Corresponds to legacy Section 468 IPC.',
    prescribedPunishment: {
      imprisonmentTerm: 'Imprisonment of either description for a term which may extend to 7 years',
      fineAmount: 'Shall also be liable to fine',
      punishmentType: 'mandatory_imprisonment_and_fine',
    },
    statutoryIngredients: [
      'Commission of forgery as defined in Section 335 by creating a false document or electronic record.',
      'Specific intent that the forged document or electronic record shall be used for the purpose of cheating.',
    ],
  },

  'BNS-338': {
    catalogueId: 'BNS-338',
    actTitle: 'Bharatiya Nyaya Sanhita, 2023',
    actNumberAndYear: 'Act No. 45 of 2023',
    sectionNumber: 'Section 338',
    provisionTitle: 'Forgery of valuable security, will, etc.',
    commencementDate: '2024-07-01',
    versionStatus: 'active',
    officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/2189',
    sourceAuthority: 'Gazette of India / India Code',
    summaryPlainLanguage:
      'Punishes forgery of documents or electronic records purporting to be a valuable security, a will, an authority to adopt, an authority to make or transfer any valuable security, to receive or deliver money or valuable security, or any document purporting to be an acquittance or receipt acknowledging the payment of money or delivery of movable property or valuable security. Corresponds to legacy Section 467 IPC.',
    prescribedPunishment: {
      imprisonmentTerm:
        'Imprisonment for life, or with imprisonment of either description for a term which may extend to 10 years',
      fineAmount: 'Shall also be liable to fine',
      punishmentType: 'mandatory_imprisonment_and_fine',
    },
    statutoryIngredients: [
      'Commission of forgery under Section 335 by making a false document or false electronic record.',
      'Document or electronic record forged purports to be a valuable security, will, authority to receive or deliver money, or an acquittance or receipt acknowledging payment of money or delivery of property.',
    ],
  },

  'BNS-358': {
    catalogueId: 'BNS-358',
    actTitle: 'Bharatiya Nyaya Sanhita, 2023',
    actNumberAndYear: 'Act No. 45 of 2023',
    sectionNumber: 'Section 358',
    provisionTitle: 'Repeal and savings',
    commencementDate: '2024-07-01',
    versionStatus: 'savings_clause',
    officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/2189',
    sourceAuthority: 'Gazette of India / India Code',
    summaryPlainLanguage:
      'Repeals the Indian Penal Code, 1860, while saving previous operations, liabilities, forfeitures, and penalties accrued under the IPC. This is strictly a statutory savings provision, NOT an offence or charging section.',
    prescribedPunishment: {
      imprisonmentTerm: 'None (Repeal and savings mechanism)',
      fineAmount: 'None',
      punishmentType: 'regulatory_liability_direction',
    },
    statutoryIngredients: [
      'Statutory repeal of Indian Penal Code, 1860.',
      'Saving of previous operation of repealed enactment, rights accrued, liabilities incurred, or proceedings commenced.',
    ],
    isSavingsOrInterpretationProvision: true,
  },
};

// -----------------------------------------------------------------------------
// 2. INDIAN PENAL CODE, 1860 (Act No. 45 of 1860) — Legacy Regime
// In effect until 30 June 2024; saved via BNS Section 358
// Official India Code: https://www.indiacode.nic.in/handle/123456789/2263
// -----------------------------------------------------------------------------
export const IPC_LEGACY_CATALOGUE: Record<string, StatutoryCatalogueEntry> = {
  'IPC-420': {
    catalogueId: 'IPC-420',
    actTitle: 'Indian Penal Code, 1860',
    actNumberAndYear: 'Act No. 45 of 1860',
    sectionNumber: 'Section 420',
    provisionTitle: 'Cheating and dishonestly inducing delivery of property',
    commencementDate: '1862-01-01',
    repealDate: '2024-07-01',
    versionStatus: 'repealed_saved',
    officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/2263',
    sourceAuthority: 'Gazette of India / India Code',
    summaryPlainLanguage:
      'Legacy penal provision for cheating and dishonestly inducing delivery of property for acts committed on or before 30 June 2024.',
    prescribedPunishment: {
      imprisonmentTerm: 'Imprisonment of either description for a term which may extend to 7 years',
      fineAmount: 'Shall also be liable to fine',
      punishmentType: 'mandatory_imprisonment_and_fine',
    },
    statutoryIngredients: [
      'Deception of any person.',
      'Fraudulently or dishonestly inducing delivery of property or alteration of valuable security.',
      'Act occurred on or before 30 June 2024.',
    ],
  },

  'IPC-419': {
    catalogueId: 'IPC-419',
    actTitle: 'Indian Penal Code, 1860',
    actNumberAndYear: 'Act No. 45 of 1860',
    sectionNumber: 'Section 419',
    provisionTitle: 'Punishment for cheating by personation',
    commencementDate: '1862-01-01',
    repealDate: '2024-07-01',
    versionStatus: 'repealed_saved',
    officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/2263',
    sourceAuthority: 'Gazette of India / India Code',
    summaryPlainLanguage:
      'Legacy penal provision for cheating by personation for acts committed on or before 30 June 2024.',
    prescribedPunishment: {
      imprisonmentTerm: 'Imprisonment of either description for a term which may extend to 3 years',
      fineAmount: 'Or with fine',
      punishmentType: 'imprisonment_or_fine_or_both',
    },
    statutoryIngredients: ['Cheating by personation committed on or before 30 June 2024.'],
  },

  'IPC-406': {
    catalogueId: 'IPC-406',
    actTitle: 'Indian Penal Code, 1860',
    actNumberAndYear: 'Act No. 45 of 1860',
    sectionNumber: 'Section 406',
    provisionTitle: 'Punishment for criminal breach of trust',
    commencementDate: '1862-01-01',
    repealDate: '2024-07-01',
    versionStatus: 'repealed_saved',
    officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/2263',
    sourceAuthority: 'Gazette of India / India Code',
    summaryPlainLanguage:
      'Legacy penal provision for criminal breach of trust for acts committed on or before 30 June 2024.',
    prescribedPunishment: {
      imprisonmentTerm: 'Imprisonment of either description for a term which may extend to 3 years',
      fineAmount: 'Or with fine',
      punishmentType: 'imprisonment_or_fine_or_both',
    },
    statutoryIngredients: ['Criminal breach of trust committed on or before 30 June 2024.'],
  },

  'IPC-409': {
    catalogueId: 'IPC-409',
    actTitle: 'Indian Penal Code, 1860',
    actNumberAndYear: 'Act No. 45 of 1860',
    sectionNumber: 'Section 409',
    provisionTitle:
      'Criminal breach of trust by public servant, or by banker, merchant or agent',
    commencementDate: '1862-01-01',
    repealDate: '2024-07-01',
    versionStatus: 'repealed_saved',
    officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/2263',
    sourceAuthority: 'Gazette of India / India Code',
    summaryPlainLanguage:
      'Legacy penal provision for criminal breach of trust by public servant or commercial fiduciary for acts committed on or before 30 June 2024.',
    prescribedPunishment: {
      imprisonmentTerm:
        'Imprisonment for life, or with imprisonment of either description for a term which may extend to 10 years',
      fineAmount: 'Shall also be liable to fine',
      punishmentType: 'mandatory_imprisonment_and_fine',
    },
    statutoryIngredients: [
      'Entrustment in capacity of public servant, banker, merchant, factor, broker, attorney, or agent.',
      'Breach committed on or before 30 June 2024.',
    ],
    appliesToCapacities: [
      'Public Servant',
      'Banker',
      'Merchant',
      'Factor',
      'Broker',
      'Attorney',
      'Agent',
    ],
  },

  'IPC-465': {
    catalogueId: 'IPC-465',
    actTitle: 'Indian Penal Code, 1860',
    actNumberAndYear: 'Act No. 45 of 1860',
    sectionNumber: 'Section 465',
    provisionTitle: 'Punishment for forgery',
    commencementDate: '1862-01-01',
    repealDate: '2024-07-01',
    versionStatus: 'repealed_saved',
    officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/2263',
    sourceAuthority: 'Gazette of India / India Code',
    summaryPlainLanguage: 'Legacy general forgery punishment for acts committed on or before 30 June 2024.',
    prescribedPunishment: {
      imprisonmentTerm: 'Imprisonment of either description for a term which may extend to 2 years',
      fineAmount: 'Or with fine',
      punishmentType: 'imprisonment_or_fine_or_both',
    },
    statutoryIngredients: ['Forgery committed on or before 30 June 2024.'],
  },

  'IPC-468': {
    catalogueId: 'IPC-468',
    actTitle: 'Indian Penal Code, 1860',
    actNumberAndYear: 'Act No. 45 of 1860',
    sectionNumber: 'Section 468',
    provisionTitle: 'Forgery for purpose of cheating',
    commencementDate: '1862-01-01',
    repealDate: '2024-07-01',
    versionStatus: 'repealed_saved',
    officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/2263',
    sourceAuthority: 'Gazette of India / India Code',
    summaryPlainLanguage:
      'Legacy aggravated forgery for cheating for acts committed on or before 30 June 2024.',
    prescribedPunishment: {
      imprisonmentTerm: 'Imprisonment of either description for a term which may extend to 7 years',
      fineAmount: 'Shall also be liable to fine',
      punishmentType: 'mandatory_imprisonment_and_fine',
    },
    statutoryIngredients: [
      'Forgery committed on or before 30 June 2024 with intent to cheat.',
    ],
  },

  'IPC-467': {
    catalogueId: 'IPC-467',
    actTitle: 'Indian Penal Code, 1860',
    actNumberAndYear: 'Act No. 45 of 1860',
    sectionNumber: 'Section 467',
    provisionTitle: 'Forgery of valuable security, will, etc.',
    commencementDate: '1862-01-01',
    repealDate: '2024-07-01',
    versionStatus: 'repealed_saved',
    officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/2263',
    sourceAuthority: 'Gazette of India / India Code',
    summaryPlainLanguage:
      'Legacy forgery of valuable security for acts committed on or before 30 June 2024.',
    prescribedPunishment: {
      imprisonmentTerm:
        'Imprisonment for life, or with imprisonment of either description for a term which may extend to 10 years',
      fineAmount: 'Shall also be liable to fine',
      punishmentType: 'mandatory_imprisonment_and_fine',
    },
    statutoryIngredients: [
      'Forgery of valuable security committed on or before 30 June 2024.',
    ],
  },
};

// -----------------------------------------------------------------------------
// 3. GENERAL CLAUSES ACT, 1897 (Act No. 10 of 1897)
// Official India Code: https://www.indiacode.nic.in/handle/123456789/2262
// -----------------------------------------------------------------------------
export const GENERAL_CLAUSES_CATALOGUE: Record<string, StatutoryCatalogueEntry> = {
  'GCA-6': {
    catalogueId: 'GCA-6',
    actTitle: 'General Clauses Act, 1897',
    actNumberAndYear: 'Act No. 10 of 1897',
    sectionNumber: 'Section 6',
    provisionTitle: 'Effect of repeal',
    commencementDate: '1897-03-11',
    versionStatus: 'savings_clause',
    officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/2262',
    sourceAuthority: 'Gazette of India / India Code',
    summaryPlainLanguage:
      'Statutory rule of interpretation providing that repeal of an enactment shall not affect liabilities accrued, penalties incurred, or legal proceedings in respect of offences committed prior to repeal. Strictly an interpretation provision, NOT a substantive charging section.',
    prescribedPunishment: {
      imprisonmentTerm: 'None (Statutory interpretation provision)',
      fineAmount: 'None',
      punishmentType: 'regulatory_liability_direction',
    },
    statutoryIngredients: [
      'Repeal of any Central Act or Regulation.',
      'Preservation of accrued rights, privileges, obligations, or liabilities unless different intention appears.',
    ],
    isSavingsOrInterpretationProvision: true,
  },
};

// -----------------------------------------------------------------------------
// 4. INFORMATION TECHNOLOGY ACT, 2000 (Act No. 21 of 2000, as amended)
// Official India Code: https://www.indiacode.nic.in/handle/123456789/1999
// -----------------------------------------------------------------------------
export const IT_ACT_CATALOGUE: Record<string, StatutoryCatalogueEntry> = {
  'IT-43-46': {
    catalogueId: 'IT-43-46',
    actTitle: 'Information Technology Act, 2000',
    actNumberAndYear: 'Act No. 21 of 2000',
    sectionNumber: 'Section 43 read with Section 46',
    provisionTitle: 'Penalty and compensation for damage to computer system',
    commencementDate: '2000-10-17',
    versionStatus: 'active',
    officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/1999',
    sourceAuthority: 'Gazette of India / India Code',
    summaryPlainLanguage:
      'Civil and regulatory compensation remedy for unauthorized access, downloading, extraction of data, introduction of malware, or denial of access to a computer system. Adjudicated by the State IT Secretary (Adjudicating Officer), NOT a criminal magistrate.',
    prescribedPunishment: {
      imprisonmentTerm: 'None (Civil / Regulatory Compensation)',
      fineAmount: 'Compensation by way of damages up to ₹5,00,00,000 (Five Crore Rupees)',
      punishmentType: 'civil_regulatory_compensation',
    },
    statutoryIngredients: [
      'Accessing or securing access to computer system without permission of owner.',
      'Downloading, copying, or extracting data.',
      'Introducing or causing to be introduced any computer contaminant or computer virus.',
      'Adjudication application filed before State Adjudicating Officer under Section 46.',
    ],
    civilRegulatoryRelief: 'Statutory compensation to the affected victim up to ₹5 crore.',
  },

  'IT-66': {
    catalogueId: 'IT-66',
    actTitle: 'Information Technology Act, 2000',
    actNumberAndYear: 'Act No. 21 of 2000',
    sectionNumber: 'Section 66',
    provisionTitle: 'Computer related offences',
    commencementDate: '2009-10-27',
    versionStatus: 'active',
    officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/1999',
    sourceAuthority: 'Gazette of India / India Code',
    summaryPlainLanguage:
      'Penalizes committing any of the unauthorized acts listed in Section 43 dishonestly or fraudulently.',
    prescribedPunishment: {
      imprisonmentTerm: 'Imprisonment for a term which may extend to 3 years',
      fineAmount: 'Or with fine which may extend to ₹5,00,000 (Five Lakh Rupees)',
      punishmentType: 'imprisonment_or_fine_or_both',
    },
    statutoryIngredients: [
      'Commission of any act referred to in Section 43.',
      'Mens rea: Act was done dishonestly or fraudulently.',
    ],
  },

  'IT-66C': {
    catalogueId: 'IT-66C',
    actTitle: 'Information Technology Act, 2000',
    actNumberAndYear: 'Act No. 21 of 2000',
    sectionNumber: 'Section 66C',
    provisionTitle: 'Punishment for identity theft',
    commencementDate: '2009-10-27',
    versionStatus: 'active',
    officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/1999',
    sourceAuthority: 'Gazette of India / India Code',
    summaryPlainLanguage:
      'Penalizes an offender fraudulently or dishonestly making use of another person’s electronic signature, password, or unique identification feature (e.g. OTP, netbanking credentials, UPI PIN). Strictly requires the offender to make use of another person’s credentials; does not apply where a victim enters their own credentials on their own device under deception.',
    prescribedPunishment: {
      imprisonmentTerm: 'Imprisonment of either description for a term which may extend to 3 years',
      fineAmount: 'And shall also be liable to fine which may extend to ₹1,00,000 (One Lakh Rupees)',
      punishmentType: 'mandatory_imprisonment_and_fine',
    },
    statutoryIngredients: [
      'Offender fraudulently or dishonestly made use of another person’s electronic signature, password, or unique identification feature.',
      'Distinguished from victim’s own credential entry: Requires unauthorized use of another person’s credential by the offender, not merely the victim entering their own credentials under deception.',
    ],
  },

  'IT-66D': {
    catalogueId: 'IT-66D',
    actTitle: 'Information Technology Act, 2000',
    actNumberAndYear: 'Act No. 21 of 2000',
    sectionNumber: 'Section 66D',
    provisionTitle: 'Punishment for cheating by personation by using computer resource',
    commencementDate: '2009-10-27',
    versionStatus: 'active',
    officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/1999',
    sourceAuthority: 'Gazette of India / India Code',
    summaryPlainLanguage:
      'Penalizes cheating by personation using any computer resource, communication device, or electronic application (e.g. spoofed websites, fraudulent SMS sender IDs, spoofed caller IDs).',
    prescribedPunishment: {
      imprisonmentTerm: 'Imprisonment of either description for a term which may extend to 3 years',
      fineAmount: 'And shall also be liable to fine which may extend to ₹1,00,000 (One Lakh Rupees)',
      punishmentType: 'mandatory_imprisonment_and_fine',
    },
    statutoryIngredients: [
      'Cheating by personation committed through the use of a computer resource or communication device.',
    ],
  },
};

// -----------------------------------------------------------------------------
// 5. CONSUMER PROTECTION ACT, 2019 (Act No. 35 of 2019)
// Official India Code: https://www.indiacode.nic.in/handle/123456789/15256
// -----------------------------------------------------------------------------
export const CPA_CATALOGUE: Record<string, StatutoryCatalogueEntry> = {
  'CPA-2-7': {
    catalogueId: 'CPA-2-7',
    actTitle: 'Consumer Protection Act, 2019',
    actNumberAndYear: 'Act No. 35 of 2019',
    sectionNumber: 'Section 2(7)',
    provisionTitle: 'Definition of "Consumer"',
    commencementDate: '2020-07-20',
    versionStatus: 'active',
    officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/15256',
    sourceAuthority: 'Gazette of India / India Code',
    summaryPlainLanguage:
      'Defines a consumer as any person who buys any goods or hires/avails any services for consideration. Excludes persons obtaining goods or services for commercial purposes.',
    prescribedPunishment: {
      imprisonmentTerm: 'None (Civil / Consumer Forum Definition)',
      fineAmount: 'None',
      punishmentType: 'regulatory_liability_direction',
    },
    statutoryIngredients: [
      'Person hired or availed services for consideration paid or promised.',
      'Transaction not for commercial purpose.',
    ],
    isSavingsOrInterpretationProvision: true,
  },

  'CPA-2-42': {
    catalogueId: 'CPA-2-42',
    actTitle: 'Consumer Protection Act, 2019',
    actNumberAndYear: 'Act No. 35 of 2019',
    sectionNumber: 'Section 2(42)',
    provisionTitle: 'Definition of "Service"',
    commencementDate: '2020-07-20',
    versionStatus: 'active',
    officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/15256',
    sourceAuthority: 'Gazette of India / India Code',
    summaryPlainLanguage:
      'Defines "service" of any description made available to potential users, explicitly including banking, financing, insurance, transport, processing, supply of energy, telecom, boarding/lodging, housing construction, entertainment, and e-commerce platforms. Excludes free services or personal service contracts.',
    prescribedPunishment: {
      imprisonmentTerm: 'None (Civil / Consumer Forum Definition)',
      fineAmount: 'None',
      punishmentType: 'regulatory_liability_direction',
    },
    statutoryIngredients: [
      'Facility in connection with banking, telecom, e-commerce, or other potential-user service.',
      'Rendered for consideration.',
    ],
    isSavingsOrInterpretationProvision: true,
  },

  'CPA-2-11': {
    catalogueId: 'CPA-2-11',
    actTitle: 'Consumer Protection Act, 2019',
    actNumberAndYear: 'Act No. 35 of 2019',
    sectionNumber: 'Section 2(11)',
    provisionTitle: 'Definition of "Deficiency in Service"',
    commencementDate: '2020-07-20',
    versionStatus: 'active',
    officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/15256',
    sourceAuthority: 'Gazette of India / India Code',
    summaryPlainLanguage:
      'Defines deficiency as any fault, imperfection, shortcoming, or inadequacy in quality, nature, or manner of performance required by law or contract, including any act of negligence, omission, or deliberate withholding of relevant information.',
    prescribedPunishment: {
      imprisonmentTerm: 'None (Actionable Ground for Redressal)',
      fineAmount: 'Compensation / Reversal Orders',
      punishmentType: 'civil_regulatory_compensation',
    },
    statutoryIngredients: [
      'Service provider failed to maintain quality or standard required under law or contract.',
      'Act of negligence, omission, or failure to perform legal obligations (e.g. failure to send transaction SMS, defective 2FA, delay in freezing account).',
    ],
  },

  'CPA-35': {
    catalogueId: 'CPA-35',
    actTitle: 'Consumer Protection Act, 2019',
    actNumberAndYear: 'Act No. 35 of 2019',
    sectionNumber: 'Section 35',
    provisionTitle: 'Manner in which complaint shall be made before the District Commission',
    commencementDate: '2020-07-20',
    versionStatus: 'active',
    officialSourceUrl: 'https://www.indiacode.nic.in/handle/123456789/15256',
    sourceAuthority: 'Gazette of India / India Code',
    summaryPlainLanguage:
      'Prescribes the procedure, fee payment, and manner in which a consumer dispute petition is filed before the District Consumer Disputes Redressal Commission (including electronic filing via e-Daakhil). The Commission examines admissibility within 21 days.',
    prescribedPunishment: {
      imprisonmentTerm: 'None (Procedural Filing Provision)',
      fineAmount: 'Orders for refund, compensation, and costs under Section 39',
      punishmentType: 'civil_regulatory_compensation',
    },
    statutoryIngredients: [
      'Complaint filed by consumer or authorized consumer association.',
      'Prescribed fee paid.',
      'Filed before District Commission having territorial and pecuniary jurisdiction.',
    ],
    civilRegulatoryRelief:
      'Direction to remove deficiency, refund amount, pay compensation for loss/injury, and litigation costs.',
  },
};

// -----------------------------------------------------------------------------
// 6. RESERVE BANK OF INDIA DIRECTIONS, 2025 (Commercial Banks Framework)
// Official RBI Master Direction ID: 13140
// URL: https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=13140
// Reference: RBI/DoR/2024-25/119 DoR.MCS.REC.58/01.01.001/2024-25
// Updated: 1 October 2026. In effect through 31 December 2026.
//
// INSTITUTIONAL SCOPE NOTE:
// Applies strictly to Commercial Banks (Scheduled Commercial Banks, excluding
// Regional Rural Banks, Small Finance Banks, Payments Banks, and Local Area Banks).
// SFBs, Payments Banks, RRBs, LABs, and Co-operative Banks are governed by separate
// institutional directions and are NOT covered by this Commercial Banks catalogue entry.
// -----------------------------------------------------------------------------
export const RBI_COMMERCIAL_BANKS_CATALOGUE: Record<string, RbiParagraphEntry> = {
  'RBI-PARA-67': {
    paragraphNumber: 67,
    title: 'Zero Liability of a Customer in Unauthorised Electronic Banking Transactions',
    effectiveDate: '2025-04-01',
    applicableUpToDate: '2026-12-31',
    officialSourceUrl: 'https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=13140',
    sourceAuthority: 'Reserve Bank of India',
    directionTitle:
      'Reserve Bank of India (Responsible Business Conduct — Customer Service and Protection) Directions, 2025',
    directionReferenceNumber: 'RBI/DoR/2024-25/119 DoR.MCS.REC.58/01.01.001/2024-25',
    institutionalScope: {
      included: [
        'Commercial Banks (Scheduled Commercial Banks, excluding Regional Rural Banks, Small Finance Banks, Payments Banks, Local Area Banks)',
      ],
      excluded: [
        'Small Finance Banks (SFBs)',
        'Payments Banks (PBs)',
        'Regional Rural Banks (RRBs)',
        'Local Area Banks (LABs)',
        'Co-operative Banks (UCBs/StCBs/DCCBs)',
        'Non-Banking Financial Companies (NBFCs)',
        'Non-bank Prepaid Payment Instrument (PPI) issuers',
      ],
    },
    summaryPlainLanguage:
      'A customer has zero liability where unauthorized electronic banking transactions occur under either: (a) Contributory fraud, negligence, or deficiency on the part of the bank (irrespective of whether reported or not); or (b) Third-party breach where deficiency lies elsewhere in the system and the customer notifies the bank within 3 working days of receiving bank communication.',
    ruleSpecification:
      'Zero liability applies in cases of: (a) Bank deficiency/fraud; or (b) Third-party breach notified to bank within 3 working days of receiving bank communication.',
  },

  'RBI-PARA-68': {
    paragraphNumber: 68,
    title:
      'Customer Negligence and Limited Liability for Third-Party Breach Reported within 4 to 7 Working Days',
    effectiveDate: '2025-04-01',
    applicableUpToDate: '2026-12-31',
    officialSourceUrl: 'https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=13140',
    sourceAuthority: 'Reserve Bank of India',
    directionTitle:
      'Reserve Bank of India (Responsible Business Conduct — Customer Service and Protection) Directions, 2025',
    directionReferenceNumber: 'RBI/DoR/2024-25/119 DoR.MCS.REC.58/01.01.001/2024-25',
    institutionalScope: {
      included: [
        'Commercial Banks (Scheduled Commercial Banks, excluding Regional Rural Banks, Small Finance Banks, Payments Banks, Local Area Banks)',
      ],
      excluded: [
        'Small Finance Banks (SFBs)',
        'Payments Banks (PBs)',
        'Regional Rural Banks (RRBs)',
        'Local Area Banks (LABs)',
        'Co-operative Banks (UCBs/StCBs/DCCBs)',
        'Non-Banking Financial Companies (NBFCs)',
        'Non-bank PPI issuers',
      ],
    },
    summaryPlainLanguage:
      '(1) In cases where loss is due to customer negligence (where customer has shared payment credentials), the customer bears the entire loss until the unauthorized transaction is reported to the bank; any loss occurring after reporting is borne by the bank. Note that burden of proving negligence lies on the bank under Para 75. (2) Where deficiency lies in a third-party breach and reporting delay is 4 to 7 working days from receipt of communication: BSBD accounts capped at ₹5,000; all other SB accounts, Pre-paid Payment Instruments and Gift Cards, Current / Cash Credit / Overdraft Accounts of MSMEs, Current / Cash Credit / Overdraft Accounts of Individuals with annual average balance (in case of Current Account) / limit (in case of CC/OD Account) up to ₹25 lakh, Credit Cards with limit up to ₹5 lakh capped at ₹10,000; all other Current / Cash Credit / Overdraft Accounts (including individuals with balance/limit above ₹25 lakh and entities other than MSMEs) and Credit Cards with limit above ₹5 lakh capped at ₹25,000.',
    ruleSpecification:
      'Customer negligence: Customer bears loss until reporting. Third-party breach (4-7 working days delay from communication): Capped at ₹5,000 (BSBD), ₹10,000 (SB, PPIs, MSME Current/CC/OD, Individual Current/CC/OD up to ₹25L, Credit Card up to ₹5L), or ₹25,000 (Individual Current/CC/OD above ₹25L, non-MSME Current/CC/OD, Credit Card above ₹5L).',
  },

  'RBI-PARA-69': {
    paragraphNumber: 69,
    title: 'Customer Liability for Reporting Delay Beyond 7 Working Days',
    effectiveDate: '2025-04-01',
    applicableUpToDate: '2026-12-31',
    officialSourceUrl: 'https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=13140',
    sourceAuthority: 'Reserve Bank of India',
    directionTitle:
      'Reserve Bank of India (Responsible Business Conduct — Customer Service and Protection) Directions, 2025',
    directionReferenceNumber: 'RBI/DoR/2024-25/119 DoR.MCS.REC.58/01.01.001/2024-25',
    institutionalScope: {
      included: [
        'Commercial Banks (Scheduled Commercial Banks, excluding Regional Rural Banks, Small Finance Banks, Payments Banks, Local Area Banks)',
      ],
      excluded: [
        'Small Finance Banks (SFBs)',
        'Payments Banks (PBs)',
        'Regional Rural Banks (RRBs)',
        'Local Area Banks (LABs)',
        'Co-operative Banks (UCBs/StCBs/DCCBs)',
        'Non-Banking Financial Companies (NBFCs)',
        'Non-bank PPI issuers',
      ],
    },
    summaryPlainLanguage:
      'Where the customer reports the unauthorized transaction beyond 7 working days of receiving communication from the bank, customer liability is determined in accordance with the bank’s Board-approved policy.',
    ruleSpecification:
      'Reporting delay > 7 working days from communication: Liability determined as per individual bank’s Board-approved policy.',
  },

  'RBI-PARA-70': {
    paragraphNumber: 70,
    title: 'Consolidated Summary of Customer Liability Table',
    effectiveDate: '2025-04-01',
    applicableUpToDate: '2026-12-31',
    officialSourceUrl: 'https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=13140',
    sourceAuthority: 'Reserve Bank of India',
    directionTitle:
      'Reserve Bank of India (Responsible Business Conduct — Customer Service and Protection) Directions, 2025',
    directionReferenceNumber: 'RBI/DoR/2024-25/119 DoR.MCS.REC.58/01.01.001/2024-25',
    institutionalScope: {
      included: [
        'Commercial Banks (Scheduled Commercial Banks, excluding Regional Rural Banks, Small Finance Banks, Payments Banks, Local Area Banks)',
      ],
      excluded: [
        'Small Finance Banks',
        'Payments Banks',
        'Regional Rural Banks',
        'Local Area Banks',
        'Co-operative Banks',
        'NBFCs',
        'Non-bank PPI issuers',
      ],
    },
    summaryPlainLanguage:
      'Consolidates the customer liability table defining entitlements across zero-liability, limited-liability tiers (₹5,000 / ₹10,000 / ₹25,000), and Board-policy determinations.',
    ruleSpecification: 'Reference table for commercial bank customer liability adjudication.',
  },

  'RBI-PARA-71': {
    paragraphNumber: 71,
    title: 'Calculation of Working Days for Customer Reporting',
    effectiveDate: '2025-04-01',
    applicableUpToDate: '2026-12-31',
    officialSourceUrl: 'https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=13140',
    sourceAuthority: 'Reserve Bank of India',
    directionTitle:
      'Reserve Bank of India (Responsible Business Conduct — Customer Service and Protection) Directions, 2025',
    directionReferenceNumber: 'RBI/DoR/2024-25/119 DoR.MCS.REC.58/01.01.001/2024-25',
    institutionalScope: {
      included: [
        'Commercial Banks (Scheduled Commercial Banks, excluding Regional Rural Banks, Small Finance Banks, Payments Banks, Local Area Banks)',
      ],
      excluded: [
        'Small Finance Banks',
        'Payments Banks',
        'Regional Rural Banks',
        'Local Area Banks',
        'Co-operative Banks',
        'NBFCs',
        'Non-bank PPI issuers',
      ],
    },
    summaryPlainLanguage:
      'The number of working days shall be calculated strictly from the date of receipt of communication from the bank (SMS, email, or transaction alert), EXCLUDING the date of receipt. National holidays, regional state holidays, and bank non-business days are excluded.',
    ruleSpecification:
      'Working days calculated from date of receipt of bank communication, excluding date of receipt itself and holidays.',
  },

  'RBI-PARA-72': {
    paragraphNumber: 72,
    title: 'Mandatory Shadow Reversal within 10 Working Days',
    effectiveDate: '2025-04-01',
    applicableUpToDate: '2026-12-31',
    officialSourceUrl: 'https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=13140',
    sourceAuthority: 'Reserve Bank of India',
    directionTitle:
      'Reserve Bank of India (Responsible Business Conduct — Customer Service and Protection) Directions, 2025',
    directionReferenceNumber: 'RBI/DoR/2024-25/119 DoR.MCS.REC.58/01.01.001/2024-25',
    institutionalScope: {
      included: [
        'Commercial Banks (Scheduled Commercial Banks, excluding Regional Rural Banks, Small Finance Banks, Payments Banks, Local Area Banks)',
      ],
      excluded: [
        'Small Finance Banks (SFBs)',
        'Payments Banks (PBs)',
        'Regional Rural Banks (RRBs)',
        'Local Area Banks (LABs)',
        'Co-operative Banks (UCBs/StCBs/DCCBs)',
        'Non-Banking Financial Companies (NBFCs)',
        'Non-bank PPI issuers',
      ],
    },
    summaryPlainLanguage:
      'On customer notification of an unauthorized electronic transaction, the bank must credit the disputed amount involved to the customer’s account within 10 working days from notification (value-dated / shadow reversal), without waiting for insurance claim settlement.',
    ruleSpecification:
      'Mandatory credit of disputed sum within 10 working days of customer notification.',
  },

  'RBI-PARA-73': {
    paragraphNumber: 73,
    title: 'Maximum 90-Day Grievance Resolution Timeline',
    effectiveDate: '2025-04-01',
    applicableUpToDate: '2026-12-31',
    officialSourceUrl: 'https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=13140',
    sourceAuthority: 'Reserve Bank of India',
    directionTitle:
      'Reserve Bank of India (Responsible Business Conduct — Customer Service and Protection) Directions, 2025',
    directionReferenceNumber: 'RBI/DoR/2024-25/119 DoR.MCS.REC.58/01.01.001/2024-25',
    institutionalScope: {
      included: [
        'Commercial Banks (Scheduled Commercial Banks, excluding Regional Rural Banks, Small Finance Banks, Payments Banks, Local Area Banks)',
      ],
      excluded: [
        'Small Finance Banks (SFBs)',
        'Payments Banks (PBs)',
        'Regional Rural Banks (RRBs)',
        'Local Area Banks (LABs)',
        'Co-operative Banks (UCBs/StCBs/DCCBs)',
        'Non-Banking Financial Companies (NBFCs)',
        'Non-bank PPI issuers',
      ],
    },
    summaryPlainLanguage:
      'The bank must resolve the complaint and determine final customer liability, if any, within a maximum period not exceeding 90 days from the date of receipt of the complaint. If customer liability is not established within 90 days, the shadow reversal must be made absolute.',
    ruleSpecification:
      'Maximum 90 calendar days to complete investigation and resolve grievance.',
  },

  'RBI-PARA-75': {
    paragraphNumber: 75,
    title: 'Burden of Proof of Customer Liability Lies on the Bank',
    effectiveDate: '2025-04-01',
    applicableUpToDate: '2026-12-31',
    officialSourceUrl: 'https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=13140',
    sourceAuthority: 'Reserve Bank of India',
    directionTitle:
      'Reserve Bank of India (Responsible Business Conduct — Customer Service and Protection) Directions, 2025',
    directionReferenceNumber: 'RBI/DoR/2024-25/119 DoR.MCS.REC.58/01.01.001/2024-25',
    institutionalScope: {
      included: [
        'Commercial Banks (Scheduled Commercial Banks, excluding Regional Rural Banks, Small Finance Banks, Payments Banks, Local Area Banks)',
      ],
      excluded: [
        'Small Finance Banks (SFBs)',
        'Payments Banks (PBs)',
        'Regional Rural Banks (RRBs)',
        'Local Area Banks (LABs)',
        'Co-operative Banks (UCBs/StCBs/DCCBs)',
        'Non-Banking Financial Companies (NBFCs)',
        'Non-bank PPI issuers',
      ],
    },
    summaryPlainLanguage:
      'The burden of proving customer liability in unauthorized electronic banking transactions lies squarely on the bank, not the customer. Merely asserting credential sharing or app installation does not meet the legal standard of proof.',
    ruleSpecification:
      'Bank carries legal onus to substantiate customer negligence or authorization with technical audit logs.',
  },
};
