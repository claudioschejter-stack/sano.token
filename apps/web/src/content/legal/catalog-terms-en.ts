import { LEGAL_CONTACT_PATH, LEGAL_SITE_URL, LEGAL_TERMS_LAST_UPDATED_EN } from '../../lib/legal/legalConfig';
import type { LegalTermsDocument } from './types';

export const legalTermsEn: LegalTermsDocument = {
  title: 'Legal Terms and Conditions of Use',
  subtitle: 'RWA Tokenization Platform · Sanova Global SAS',
  lastUpdatedLabel: 'Last updated:',
  lastUpdated: LEGAL_TERMS_LAST_UPDATED_EN,
  intro: `These Legal Terms and Conditions of Use (the "**Terms**") govern access to and use of the website ${LEGAL_SITE_URL} and the digital real-world asset (RWA) tokenization, yield vault, primary marketplace, internal secondary market and collateralized lending services operated by **Sanova Global SAS** ("**Sanova**", the "**Company**" or the "**Platform**") as **fiduciary, initial settlor and technological administrator** of the **Sanova Global RWA Administration Trust** (Master Trust with Segregated Compartments).

By registering, connecting a digital wallet, completing KYC/AML, subscribing to shares of a Compartment or using any Platform feature, the User declares that they have read, understood and fully accepted these Terms, the Master Trust and applicable Compartment Annexes, as well as the [Privacy Policy](/privacidad). If you do not agree, you must refrain from using the Platform.`,
  indexTitle: 'Index',
  sections: [
    {
      id: 'vehiculo-legal',
      title: '1. Legal Vehicle and Compartments',
      summary: 'Sanova Global RWA Master Trust, segregated Compartments, Sanova as initial settlor and fiduciary.',
      paragraphs: [
        'The Platform operates on behalf of the **Sanova Global RWA Administration Trust** (the "**Trust**" or "**Master Trust**"), established under Articles 1666 to 1707 of the **Argentine Civil and Commercial Code (CCCN)**.',
        '**Sanova Global SAS**, incorporated under the laws of the **Province of Tierra del Fuego, Antarctica and South Atlantic Islands**, acts as **Initial Settlor**, **Fiduciary** and **technological administrator**, without being the principal beneficiary of shares issued to investors, except residual participation expressly stated in a Compartment Annex.',
        'Each underlying asset, project or property — in Argentina or abroad — is administered through a **segregated Compartment** (also called a "**Series**" or "**Specific Asset Pool**"), patrimonially segregated from other Compartments and from the corporate assets of Sanova Global SAS.',
        'Trust assets **do not form part** of Sanova Global SAS\'s own corporate patrimony. Sanova administers, represents and operates the Platform **on behalf of the Trust** and the relevant Compartment.',
        'Users subscribing shares acquire economic participation linked to the **Compartment** of the underlying asset, without direct transfer of property ownership or acquisition of shares in Sanova Global SAS.',
        'Compartmentalization rests on the administration trust contract (arts. **1666 to 1707 CCCN**), the **separate patrimony** generally unattachable by general rules (art. **1685**), **freedom of contract** to design the structure (art. **958**), **individualization of assets** per sub-patrimony (art. **1667**) and **limitation of creditors\' recourse** (art. **1687**). Analogy with series or compartments of financial trusts under **Law No. 26,831** is merely structural; the Trust operates in a **civil and private** modality, without CNV registration, except express migration.',
        'The Trust may obtain tax identification (CUIT or equivalent) when required. Until then, operations will be documented with segregated accounting per Compartment, without commingling trust funds with Sanova\'s own funds.'
      ]
    },
    {
      id: 'token-vault',
      title: '2. Shares, Tokens and ERC-4626 Vault (Base Network)',
      summary: 'Private digital representation; restricted transferability; Vault NAV or cash yield.',
      paragraphs: [
        'The Platform implements smart contracts on the **Base network** (Ethereum Layer 2) complying with the **ERC-4626** standard when the Compartment Annex so provides.',
        '**Trust Shares** and **Tokens** represent private economic benefit rights and contractual position linked exclusively to the originating Compartment. They **are NOT** shares of Sanova Global SAS, negotiable bonds, public mutual fund units or freely tradable cryptoassets detached from real assets.',
        'Digital issuance and registration of Tokens is performed **under fiduciary mandate** on behalf of the Compartment\'s patrimony. Sanova Global SAS does not issue rights over its own corporate patrimony except expressly documented residual participation.',
        'Depending on the Compartment Annex, yields may accumulate in the Vault increasing **NAV** per share, or be distributed in **Cash Yield** directly to authorized Wallets, preferably in **USDC**.',
        'Shares and/or Tokens are **non-transferable** except with prior Fiduciary authorization, KYC/AML verification and inclusion on the Smart Contract **Whitelist**. Trading on open markets, public pools or to an indeterminate public is prohibited.',
        'The relationship between off-chain trust participation, Compartment subscription agreement and the User\'s on-chain wallet is recorded in Sanova\'s secure databases, linking verified legal identity (KYC) with the authorized public address.'
      ],
      bullets: [
        '**Share:** proportional participation unit in the assets and flows of the Compartment.',
        '**Vault (ERC-4626):** smart contract that custodies USDC and mints or burns shares according to NAV, where applicable.',
        '**Assignment of Collection Rights:** legal instrument by which the Trust assigns the vault, where applicable, the right to collect rents from the underlying asset.'
      ]
    },
    {
      id: 'colocacion-privada',
      title: '3. Private Placement · No Public Offering · CNV',
      summary: 'Private operations without CNV registration; no mass solicitation; Compartment limits.',
      paragraphs: [
        'Issuance, primary subscription and authorized secondary transfers of Shares and/or Tokens constitute a **Private Placement** aimed at a **limited, determined or determinable** universe of investors accessing through enabled registration, invitation, eligibility assessment and KYC/AML compliance, **without open solicitation or public subscription**.',
        'The User acknowledges that private Trust and Platform operations **do NOT constitute a public offering of negotiable securities** under **Article 2 of Law No. 26,831** nor require, in their current private modality, prior authorization, registration, prospectus or public offering before the **National Securities Commission (CNV)** of the Argentine Republic, **provided** private placement and controlled transferability restrictions under the Master Trust and these Terms are maintained.',
        '**Sanova Global SAS does not act** as a capital markets agent, stock broker, ALyC, registered investment advisor or CNV-authorized intermediary in relation to these shares in their private modality.',
        'Mass promotion, public placement advertising, open subscription landing pages or any mechanism constituting solicitation to **indeterminate persons** is prohibited.',
        'Each Compartment may set maximum Beneficiaries and private placement amounts in its Annex. Sanova will maintain primary subscriber records under the Master Trust.',
        'Nothing in these Terms implies approval, supervision or oversight of the Trust, its Shares, Tokens or the Platform by the CNV. Public offering exclusion depends on **effective compliance** with private placement conditions.',
        'The User declares sufficient knowledge, experience and assets to evaluate inherent risks, including real estate, counterparty, technology, regulatory, FX and liquidity risks.'
      ]
    },
    {
      id: 'aml-kyc',
      title: '4. AML/KYC, Authorized Wallets and Transfers',
      summary: 'Mandatory Whitelist; transfers subject to fiduciary approval; closed secondary market.',
      paragraphs: [
        'Under Argentine and international **AML/CFT** regulations, **only** **wallets** whose holders have completed **KYC/AML** administered by the Platform and/or specialized providers may acquire, receive, transfer, redeem or use Shares as collateral.',
        'Every operational wallet must be on the Compartment Smart Contract **Whitelist** when digital representation exists. Transactions from unauthorized addresses will be **reverted or rejected** on-chain.',
        'Off-chain assignments or transfers also require **prior Fiduciary authorization**, even when blockchain registration exists. The Platform\'s internal secondary market is restricted to previously approved Users.',
        'Sanova may suspend, revoke or not renew wallet authorization upon regulatory non-compliance, UIF/AML alerts, false information or competent authority requirement.',
        'Upon loss of keys, security compromise or death of the holder duly evidenced, the Fiduciary may execute **Burn & Mint** procedures to a new legitimized wallet, subject to KYC/AML verification.',
        'The User undertakes to keep personal, tax and source-of-funds information updated.'
      ]
    },
    {
      id: 'moneda-pagos',
      title: '5. Currency, Payments, Compartment Accounts and Treasury',
      summary: 'USDC on Base; segregated accounts; subscriptions to Compartment patrimony.',
      paragraphs: [
        'Unless otherwise stated in the Compartment Annex, economic flows of the Trust are preferably denominated in **USD Coin (USDC)** on the **Base network**, in Vault (NAV) or Cash Yield modality as applicable.',
        'Primary subscriptions must be credited —directly or without delay— to bank accounts (CBU/CVU) and/or **Compartment Wallets**, identified as trust patrimony and **not** as corporate patrimony of Sanova Global SAS.',
        'Commingling or offsetting of funds between Compartments or between trust funds and Sanova\'s own funds is prohibited, except duly accrued fiduciary fees or administration commissions.',
        'The User is responsible for maintaining a Base-compatible wallet, gas fees, fiat/on-ramp spreads and taxes in their jurisdiction.',
        'Rents may initially be recorded in fiat in operating accounts segregated by Compartment; conversion to USDC and crediting to the vault or cash distribution will follow treasury procedures published by Sanova.',
        'Sanova does not guarantee USDC fiat parity or uninterrupted availability of bridges or external exchanges.'
      ]
    },
    {
      id: 'incorporacion-inmuebles',
      title: '6. Property Incorporation · Notarial-Registry Procedure',
      summary: 'Addendum, fiduciary deed and RPI registration; Master Trust Clause 38.',
      paragraphs: [
        'Argentine properties — completed, under construction or development land — are integrated into the Trust **without amending the Master Trust**, through the procedure in **Clause 38** and **Annex I** (Compartment Constitution).',
        'Tokenization, private placement and Platform publication **do not replace** notarial and registry formalities required by local real property law. Sanova will not enable primary placement linked to an Argentine property until notarial and registry documentation under the Master Trust is available, except conditional reservations authorized by reasoned Fiduciary deed.',
        'The procedure comprises three essential steps: **(1)** Public Deed of Addendum or Sub-Patrimony Constitution Act; **(2)** Fiduciary Domain Contribution Deed or Purchase in Fiduciary Ownership for the Compartment; **(3)** registration with the **Real Property Registry (RPI)** with a compartmentalization legend opposable to third parties (Clause 26).',
        'Compartmentalization will be opposable to courts, creditors and third parties when recorded in the RPI with a legend substantially equivalent to that in the Master Trust, based on arts. **1685** and **1687** CCCN.'
      ],
      orderedBullets: [
        '**Step 1 — Addendum / Act (public deed):** asset identification, exclusive allocation to the Compartment, patrimonial ring-fencing and reference to the economic Annex.',
        '**Step 2 — Fiduciary ownership:** contribution or purchase with Sanova Global SAS appearing as Fiduciary of the Compartment.',
        '**Step 3 — RPI:** registration with fiduciary holder legend, Compartment/Series and patrimonial liability limitation.',
        '**Development land:** the Annex must detail phases, budget, financing, contractors and prohibition of cost commingling between Compartments.'
      ]
    },
    {
      id: 'activos-internacionales',
      title: '7. International Compartments and Foreign Assets',
      summary: 'Global properties and participations via Compartments and local vehicles.',
      paragraphs: [
        'The Trust may integrate **International Compartments** with assets, equity participations or rights linked abroad, under the corresponding International Annex.',
        'Assets located outside the Argentine Republic may be held through local vehicles (*LLC*, *Ltd*, *SL*, *trust* or other lawful structures), whose participation is allocated exclusively to the relevant Compartment.',
        'Each International Compartment will identify applicable law, jurisdiction, operating currency, custodians and relevant tax and FX obligations. Sanova will comply with applicable Argentine cross-border regulations.',
        'The Platform may display information, documentation and flows differentiated by Compartment jurisdiction, without implying a public offering in any jurisdiction.'
      ]
    },
    {
      id: 'migracion-regulatoria',
      title: '8. Migration to Regulated Vehicles (CNV and Abroad)',
      summary: 'Bridge to mutual funds, financial trusts or public offering without contaminating private Compartments.',
      paragraphs: [
        'The Fiduciary may, for a given Compartment and through a specific deed or Annex, participate in **financial trusts**, **mutual funds (FCI)**, *trusts* or other capital markets vehicles in Argentina or abroad, or assign assets thereto, **only** to enable regulated placement of that Compartment.',
        'Migration of one Compartment **will not automatically convert** the Master Trust or other Compartments into a public offering or subject them to that vehicle\'s regulatory maintenance, except express migration.',
        'Migration may involve conversion, exchange or liquidation of private Tokens for shares or participations in the regulated vehicle, with Fiduciary approval and, where applicable, Beneficiary approval under the Annex.',
        'Registration, maintenance, audit and reporting costs of the regulated vehicle will be borne by the **migrated Compartment** or receiving vehicle, unless expressly agreed otherwise.'
      ]
    },
    {
      id: 'prestamos-colateral',
      title: '9. Collateralized Loans and Risks',
      summary: 'Morpho and DeFi protocols; LTV limits and technology risks.',
      paragraphs: [
        'The Platform may enable **collateralized lending** through compatible DeFi protocols (including, without limitation, **Morpho**), using Vault shares as collateral, always within Loan-to-Value (LTV) limits, whitelists and circuit breakers configured by Sanova.',
        'The User acknowledges that smart contracts, price oracles, lending markets and cross-chain bridges may present vulnerabilities, technical failures or unforeseen regulatory changes. **All investment and credit operations carry risk of partial or total capital loss.**',
        'Sanova does not provide financial, legal or tax advice. The User should consult their own professionals before making investment decisions.'
      ]
    },
    {
      id: 'limitacion-responsabilidad',
      title: '10. Limitation of Liability, Arbitration and Governing Law',
      summary: 'Argentine law; CAC arbitration; alignment with Master Trust.',
      paragraphs: [
        'To the maximum extent permitted by applicable law, Sanova Global SAS shall not be liable for indirect damages, lost profits, data loss, third-party provider failures (KYC, hosting, RPC, exchanges) or force majeure events.',
        'These Terms are governed by the **laws of the Argentine Republic** and interpreted together with the **Sanova Global RWA Master Trust** and applicable Compartment Annexes. In case of conflict between these Terms and the Master Trust regarding fiduciary economic rights, the Master Trust shall prevail.',
        'Any dispute arising from these Terms or private Platform operations shall be resolved by **binding arbitration** before the **Argentine Chamber of Commerce Arbitral Tribunal**, except mandatory rules to the contrary or a different pact in an International Compartment Annex.',
        'Sanova may amend these Terms by publishing an updated version on the Platform. Continued use after publication shall imply acceptance of amendments, unless regulations require additional express consent.'
      ]
    }
  ],
  closingNote: `For legal inquiries, claims or rights related to these Terms, use the [Contact](${LEGAL_CONTACT_PATH}) form.

*Contractual information document. Does not constitute a public offering of negotiable securities, a CNV-registered issuance or personalized investment advice. Private operations do not require CNV authorization while Master Trust private placement conditions are respected.*`,
  backHome: 'Back to home',
  privacyLinkLabel: 'Privacy Policy',
  contactFormPath: LEGAL_CONTACT_PATH
};
