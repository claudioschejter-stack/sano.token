import { LEGAL_CONTACT_PATH, LEGAL_SITE_URL, PRIVACY_POLICY_LAST_UPDATED_EN } from '../../lib/legal/legalConfig';
import type { PrivacyDocument } from './types';

export const privacyEn: PrivacyDocument = {
  title: 'Privacy Policy and Data Protection',
  lastUpdatedLabel: 'Last updated:',
  lastUpdated: PRIVACY_POLICY_LAST_UPDATED_EN,
  intro: `This Privacy Policy describes how **Sanova Global SAS** ("the Company", "we" or "the Platform"), as **initial settlor, fiduciary and technological administrator** of the **Sanova Global RWA Administration Trust**, collects, uses, protects and shares personal information of users and investors ("the User" or "you") when accessing and using ${LEGAL_SITE_URL} and RWA tokenization, marketplace, internal secondary market and collateralized lending services.

Personal data is processed in compliance with **Law No. 25,326 on Personal Data Protection** of the Argentine Republic, **UIF/AML/CFT** regulations, applicable tax obligations and, where relevant, foreign authority requirements linked to **International Compartments**.`,
  sections: [
    {
      title: '1. Information We Collect',
      paragraphs: [
        'To ensure legal security of the Trust, Compartment segregation and regulatory compliance, we collect:'
      ],
      bullets: [
        '**Identity Data (KYC):** Full name, ID/Passport, date of birth, nationality, address, marital status and proof of residence.',
        '**Financial and Tax Data:** Source of funds, CUIT/CUIL, tax status, PEP declarations and subscription supporting documents.',
        '**Subscription and Compartment Data:** Subscribed Compartment, amount, currency, Shares/Tokens, adhesion agreement, subscription records and rent payout preferences (Vault NAV or Cash Yield).',
        '**Technology and Web3 Data:** Base wallet address, associated on-chain history, IP, browser, platform logs, tx hashes, allowlist/whitelist and internal secondary market records.',
        '**International Data (if applicable):** Additional information required by local vehicles (*LLC*, *SL*, *trust*) or foreign regulators when an International Compartment is involved.'
      ]
    },
    {
      title: '2. Public Nature of the Blockchain',
      paragraphs: [
        'You understand that blockchain (such as the Base network) is a public, immutable and transparent ledger.'
      ],
      bullets: [
        '**On-Chain Data:** Your public wallet, USDC amounts, Shares/Tokens acquired or redeemed, vault and loan contract interactions are public.',
        '**Off-Chain Data:** We **never** publish your name, ID or traditional personal data on-chain. The legal identity (KYC) ↔ wallet link is stored encrypted off-chain on Sanova\'s secure servers, as fiduciary/technological administrator.'
      ]
    },
    {
      title: '3. Use of Information',
      paragraphs: ['We use your personal data to:'],
      orderedBullets: [
        '**Legal and Fiduciary Validation:** Approve KYC/AML, register subscribers per Compartment, include wallets on the Whitelist and enable private placement under the Master Trust.',
        '**Financial Operations:** Process subscriptions to Compartment patrimony, USDC rent payments or internal balance, withdrawals, segregated treasury reconciliation and collateralized loan settlements.',
        '**Regulatory Compliance:** Prevent fraud, money laundering and terrorist financing; respond to UIF, AFIP, CNV or other authorities when legally required; document migration to regulated vehicles if a Compartment requires it.',
        '**Document and Registry Management:** Coordinate with notaries, property registries, accountants and local advisors for asset incorporation in Argentina or abroad.',
        '**Communication:** Notifications about subscribed Compartments, yields, contractual changes, wallet security and Platform legal updates.'
      ]
    },
    {
      title: '4. Data Transfer and Sharing',
      paragraphs: [
        'Sanova Global SAS **does not sell** personal data. We only share information under confidentiality with:'
      ],
      bullets: [
        '**KYC/AML and biometrics providers** (e.g. Didit or other enabled vendors).',
        '**Payment gateways and on-ramps** (Stripe, Mercado Pago, Coinbase, Transak or others) only to execute payments authorized by you.',
        '**Technology infrastructure** (hosting, RPC, email, operational analytics) under processing agreements.',
        '**Notaries, registries, banks and custodians** when needed for title transfers, Compartment accounts or international assets.',
        '**Legal, accounting and audit advisors** of the Trust under confidentiality duties.',
        '**Competent authorities** (UIF, AFIP, CNV, courts or foreign bodies) when legally required or upon valid request.',
        '**Destination regulated vehicles** if a Compartment migrates under the Master Trust, limited to what is necessary for regulated exchange or conversion.'
      ]
    },
    {
      title: '5. Segregation, Retention and Security',
      paragraphs: [
        'We implement technical, administrative and cryptographic measures to protect off-chain information. Data is organized by **Compartment** where applicable, without confusing trust patrimony with Sanova\'s corporate patrimony.',
        'We retain data while you maintain active participation in a Compartment and for minimum periods required by accounting, AML and fiduciary regulations, even after the commercial relationship ends.'
      ]
    },
    {
      title: '6. Your Rights (ARCO and Inquiries)',
      paragraphs: ['Under Law 25,326, you may:'],
      bullets: [
        '**Access** your personal data.',
        '**Rectify** inaccurate information.',
        '**Request deletion**, subject to AML/fiduciary legal restrictions and legally required record retention.'
      ]
    }
  ],
  arcoNote: `To exercise ARCO rights or privacy inquiries, use the [Contact](${LEGAL_CONTACT_PATH}) form. Sanova will respond through the indicated channels.

*The Public Information Access Agency, control body of Law No. 25,326, handles complaints regarding personal data protection non-compliance.*`,
  backHome: 'Back to home',
  contactFormPath: LEGAL_CONTACT_PATH
};
