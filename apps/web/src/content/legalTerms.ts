import {
  LEGAL_CONTACT_PATH,
  LEGAL_SITE_URL,
  LEGAL_TERMS_LAST_UPDATED_EN,
  LEGAL_TERMS_LAST_UPDATED_ES
} from '../lib/legal/legalConfig';

export type LegalTermsSection = {
  id: string;
  title: string;
  summary: string;
  paragraphs?: string[];
  bullets?: string[];
  orderedBullets?: string[];
};

export type LegalTermsDocument = {
  title: string;
  subtitle: string;
  lastUpdatedLabel: string;
  lastUpdated: string;
  intro: string;
  indexTitle: string;
  sections: LegalTermsSection[];
  closingNote: string;
  backHome: string;
  privacyLinkLabel: string;
  contactFormPath: string;
};

const legalTermsEs: LegalTermsDocument = {
  title: 'Términos Legales y Condiciones de Uso',
  subtitle: 'Plataforma de tokenización RWA · Sanova Global SAS',
  lastUpdatedLabel: 'Última actualización:',
  lastUpdated: LEGAL_TERMS_LAST_UPDATED_ES,
  intro: `Los presentes Términos Legales y Condiciones de Uso (en adelante, los "**Términos**") regulan el acceso y la utilización del sitio web ${LEGAL_SITE_URL} y de los servicios digitales de tokenización de activos del mundo real (RWA), bóvedas de rendimiento y préstamos colateralizados operados por **Sanova Global SAS** (en adelante, "**Sanova**", la "**Empresa**" o la "**Plataforma**").

Al registrarse, conectar una billetera digital, completar el proceso KYC/AML o utilizar cualquier funcionalidad de la Plataforma, el Usuario declara haber leído, comprendido y aceptado íntegramente estos Términos, así como la [Política de Privacidad](/privacidad). Si no está de acuerdo, deberá abstenerse de utilizar la Plataforma.`,
  indexTitle: 'Índice',
  sections: [
    {
      id: 'vehiculo-legal',
      title: '1. Naturaleza del Vehículo Legal',
      summary: 'Fideicomiso Máster, Patrimonio de Afectación Específica y rol fiduciario de Sanova Global SAS.',
      paragraphs: [
        'La Plataforma opera como **administrador tecnológico y fiduciario** de un **Fideicomiso Máster de Administración** constituido conforme a la legislación aplicable de la República Argentina, mediante el cual se canalizan inversiones en activos inmobiliarios productivos tokenizados.',
        'Cada inmueble subyacente — incluyendo, a título enunciativo, el complejo hotelero ubicado en **Añelo, Provincia de Neuquén** — constituye un **Patrimonio de Afectación Específica** (en adelante, una "**Serie**" o "**Sub-Fideicomiso**"), segregado patrimonialmente del resto de los activos administrados bajo el Fideicomiso Máster.',
        '**Sanova Global SAS**, sociedad constituida bajo las leyes de la **Provincia de Tierra del Fuego, Antártida e Islas del Atlántico Sur, República Argentina**, actúa en calidad de **fiduciario y administrador tecnológico** del Fideicomiso Máster, responsable de la custodia documental, la operatoria digital, la emisión de cuotapartes tokenizadas, la gestión de flujos de rentas y el cumplimiento normativo aplicable.',
        'Los Usuarios adquieren, mediante la Plataforma, una participación económica vinculada a la Serie correspondiente al activo subyacente, sin que ello implique la transferencia de dominio directo sobre el inmueble ni la adquisición de acciones, cuotas sociales o títulos valores negociables en sentido clásico.'
      ]
    },
    {
      id: 'token-vault',
      title: '2. Naturaleza del Token y Bóveda ERC-4626 (Red Base)',
      summary: 'Cuotapartes digitales en bóveda de rendimiento; cesiones de derechos de cobro sobre alquileres.',
      paragraphs: [
        'La Plataforma implementa contratos inteligentes desplegados en la **red Base** (Layer 2 de Ethereum) que cumplen con el estándar **ERC-4626** de bóvedas tokenizadas de rendimiento (*Tokenized Vault Standard*).',
        'Los tokens emitidos por cada Serie **NO constituyen acciones societarias**, participaciones en el capital social de Sanova Global SAS, valores mobiliarios de oferta pública ni criptoactivos de naturaleza especulativa desvinculados de activos reales. Representan **Cuotapartes digitales** (*Shares*) dentro de una **Bóveda Digital** (*Vault*) que administra las **Cesiones de Derechos de Cobro** originadas en los contratos de locación y explotación hotelera del Patrimonio de Afectación Específica correspondiente.',
        'El estándar **ERC-4626** garantiza que los rendimientos generados por los activos subyacentes — principalmente rentas de alquiler — se acumulen en la bóveda de forma **automatizada, proporcional y auditable on-chain**, incrementando el valor liquidativo por cuotaparte (*Net Asset Value* o NAV) conforme ingresan USDC al vault, sin requerir distribuciones individuales manuales a cada tenedor.',
        'La relación entre la participación off-chain en el Fideicomiso y la billetera on-chain del Usuario queda registrada en bases de datos seguras de Sanova, vinculando la identidad legal verificada (KYC) con la dirección pública de la wallet autorizada.'
      ],
      bullets: [
        '**Cuotaparte (Share):** unidad de participación proporcional en los activos y flujos de la Bóveda Digital de una Serie determinada.',
        '**Vault (Bóveda ERC-4626):** contrato inteligente que custodia USDC y emite/recibe cuotapartes conforme al NAV.',
        '**Cesión de Derechos de Cobro:** instrumento jurídico mediante el cual el Fideicomiso cede al vault el derecho de percibir rentas derivadas del inmueble subyacente.'
      ]
    },
    {
      id: 'colocacion-privada',
      title: '3. Exención de Oferta Pública · Colocación Privada',
      summary: 'Colocación privada de cuotapartes ERC-4626; no constituye oferta pública registrable ante la CNV (Art. 2, Ley 26.831).',
      paragraphs: [
        'La emisión, colocación primaria y transferencias restringidas de **cuotapartes tokenizadas ERC-4626** descritas en estos Términos constituyen una **Colocación Privada** de participaciones vinculadas a activos reales, **destinada exclusivamente a un universo acotado de inversores** que acceden mediante registro habilitado, invitación y cumplimiento KYC/AML, sin convocatoria abierta ni solicitud pública de suscripción.',
        'El Usuario reconoce y acepta que la operatoria de la Plataforma **NO constituye una oferta pública de valores negociables** en los términos del **Artículo 2 de la Ley N° 26.831** ni una emisión sujeta a autorización, registro, prospecto u oferta pública ante la **Comisión Nacional de Valores (CNV)** de la República Argentina. **Sanova Global SAS no actúa como agente de mercado de capitales, agente de bolsa, ALyC, asesor de inversión registrado ni intermediario autorizado por la CNV** en relación con estas cuotapartes.',
        'Sanova Global SAS no realiza promoción masiva, publicidad de colocación dirigida al público en general, ni campañas de captación indiscriminada. El acceso a la Plataforma, al marketplace primario y al mercado secundario interno está condicionado a verificación de identidad, evaluación de elegibilidad y aceptación expresa de estos Términos.',
        'Las cuotapartes ERC-4626 **no son acciones, obligaciones negociables, cuotas de FCI de oferta pública ni criptoactivos de libre comercialización**. Su circulación se limita al ecosistema habilitado por Sanova conforme a políticas de compliance y restricciones on-chain.',
        'El Usuario declara contar con conocimiento, experiencia y patrimonio suficientes para evaluar los riesgos inherentes a inversiones en activos reales tokenizados, incluyendo — sin limitarse a — riesgo de mercado inmobiliario, riesgo de contraparte, riesgo tecnológico de smart contracts, riesgo regulatorio y riesgo de liquidez.'
      ]
    },
    {
      id: 'aml-kyc',
      title: '4. Cumplimiento AML/KYC y Billeteras Autorizadas',
      summary: 'Operaciones restringidas a wallets verificadas e incluidas en la Whitelist.',
      paragraphs: [
        'En cumplimiento de la normativa argentina e internacional sobre **Prevención del Lavado de Activos y Financiamiento del Terrorismo (AML/CFT)**, así como de las políticas internas de Sanova, **únicamente** podrán adquirir, recibir, transferir, rescatar o utilizar cuotapartes como **colateral para préstamos automáticos** las **billeteras digitales (wallets)** cuyos titulares hayan superado exitosamente el proceso de **Conozca a su Cliente (KYC)** y debida diligencia **AML** administrado por la Plataforma y/o sus proveedores especializados.',
        'Toda wallet operativa debe encontrarse incluida en la **Lista Blanca (*Whitelist*)** del contrato inteligente correspondiente a la Serie. Las transacciones originadas desde direcciones no autorizadas serán **revertidas o rechazadas** por el protocolo on-chain.',
        'El **mercado secundario** habilitado en la Plataforma está **estrictamente restringido** a Usuarios previamente aprobados, sin posibilidad de negociación libre con terceros no verificados. Sanova se reserva el derecho de suspender, revocar o no renovar la autorización de cualquier wallet ante incumplimiento normativo, alertas de riesgo, información falsa en el KYC o requerimiento de autoridad competente.',
        'El Usuario se obliga a mantener actualizada su información personal, fiscal y de origen de fondos, notificando cualquier cambio material dentro de los plazos que la Plataforma o la normativa AML exijan.'
      ]
    },
    {
      id: 'moneda-pagos',
      title: '5. Moneda, Pagos y Liquidaciones',
      summary: 'Denominación y liquidación exclusiva en USDC sobre la red Base.',
      paragraphs: [
        'Salvo disposición expresa en contrario aprobada por escrito por Sanova y comunicada al Usuario, **todas las rentas, dividendos, rescates, reembolsos, liquidaciones de préstamos colateralizados y demás flujos económicos** originados en la operatoria del Fideicomiso y de las Bóvedas ERC-4626 se **denominan, acumulan y liquidan exclusivamente en USD Coin (USDC)**, stablecoin emitida conforme a estándares reconocidos, **a través de la red Base**.',
        'El Usuario es responsable de contar con una wallet compatible con Base y de asumir las comisiones de gas, spreads de conversión fiat/on-ramp (cuando aplique) e impuestos que correspondan en su jurisdicción.',
        'Sanova no garantiza la paridad fiat de USDC frente al dólar estadounidense ni la disponibilidad ininterrumpida de puentes (*bridges*) o exchanges externos. Los tiempos de acreditación pueden variar según congestión de red, procesos de conversión off-chain y validaciones AML adicionales.',
        'Las rentas provenientes de inquilinos u operadores hoteleros pueden registrarse inicialmente en moneda fiat en cuentas operativas segregadas por propiedad; su conversión a USDC y acreditación al vault se realizará conforme a los procedimientos operativos y de tesorería publicados por Sanova, priorizando eficiencia de costos y trazabilidad auditables.'
      ]
    },
    {
      id: 'prestamos-colateral',
      title: '6. Préstamos Colateralizados y Riesgos',
      summary: 'Morpho y protocolos DeFi; límites de LTV y riesgos tecnológicos.',
      paragraphs: [
        'La Plataforma puede habilitar funcionalidades de **préstamo colateralizado** mediante protocolos DeFi compatibles (incluyendo, sin limitarse a, **Morpho**), utilizando las cuotapartes de la Bóveda como garantía, siempre dentro de los límites de *Loan-to-Value* (LTV), listas blancas y circuit breakers configurados por Sanova.',
        'El Usuario reconoce que los smart contracts, oráculos de precios, mercados de préstamos y puentes cross-chain pueden presentar vulnerabilidades, fallas técnicas o cambios regulatorios imprevistos. **Toda inversión y operación de crédito conlleva riesgo de pérdida parcial o total del capital.**',
        'Sanova no presta asesoramiento financiero, legal ni impositivo. El Usuario debe consultar a sus propios profesionales antes de tomar decisiones de inversión.'
      ]
    },
    {
      id: 'limitacion-responsabilidad',
      title: '7. Limitación de Responsabilidad y Ley Aplicable',
      summary: 'Jurisdicción argentina; limitaciones conforme a derecho aplicable.',
      paragraphs: [
        'En la máxima medida permitida por la ley aplicable, Sanova Global SAS no será responsable por daños indirectos, lucro cesante, pérdida de datos, fallas de terceros proveedores (KYC, hosting, RPC, exchanges) ni por hechos de fuerza mayor.',
        'Estos Términos se rigen por las **leyes de la República Argentina**. Para cualquier controversia, las partes se someten a la jurisdicción de los **Tribunales Ordinarios de la Ciudad Autónoma de Buenos Aires**, con renuncia a cualquier otro fuero, salvo normas imperativas en contrario.',
        'Sanova podrá modificar estos Términos publicando una versión actualizada en la Plataforma. El uso continuado tras la publicación implicará aceptación de las modificaciones, salvo que la normativa exija consentimiento expreso adicional.'
      ]
    }
  ],
  closingNote: `Para consultas legales, reclamos o ejercicio de derechos relacionados con estos Términos, utilice el formulario de [Contacto](${LEGAL_CONTACT_PATH}).

*Documento informativo de carácter contractual. No constituye oferta pública de valores negociables, emisión registrada ante la CNV ni recomendación personalizada de inversión.*`,
  backHome: 'Volver al inicio',
  privacyLinkLabel: 'Política de Privacidad',
  contactFormPath: LEGAL_CONTACT_PATH
};

const legalTermsEn: LegalTermsDocument = {
  title: 'Legal Terms and Conditions of Use',
  subtitle: 'RWA Tokenization Platform · Sanova Global SAS',
  lastUpdatedLabel: 'Last updated:',
  lastUpdated: LEGAL_TERMS_LAST_UPDATED_EN,
  intro: `These Legal Terms and Conditions of Use (the "**Terms**") govern access to and use of the website ${LEGAL_SITE_URL} and the digital real-world asset (RWA) tokenization, yield vault and collateralized lending services operated by **Sanova Global SAS** ("**Sanova**", the "**Company**" or the "**Platform**").

By registering, connecting a digital wallet, completing the KYC/AML process or using any Platform feature, the User declares that they have read, understood and fully accepted these Terms, as well as the [Privacy Policy](/privacidad). If you do not agree, you must refrain from using the Platform.`,
  indexTitle: 'Index',
  sections: [
    {
      id: 'vehiculo-legal',
      title: '1. Legal Vehicle Structure',
      summary: 'Master Trust, Specific Asset Pool (Series) and Sanova Global SAS as fiduciary.',
      paragraphs: [
        'The Platform operates as **technological administrator and fiduciary** of a **Master Administration Trust** established under applicable law of the Argentine Republic, through which investments in productive tokenized real estate assets are channeled.',
        'Each underlying property — including, by way of example, the hotel complex located in **Añelo, Province of Neuquén** — constitutes a **Specific Asset Pool** (a "**Series**" or "**Sub-Trust**"), segregated from other assets administered under the Master Trust.',
        '**Sanova Global SAS**, a company incorporated under the laws of the **Province of Tierra del Fuego, Antarctica and South Atlantic Islands, Argentine Republic**, acts as **fiduciary and technological administrator** of the Master Trust, responsible for document custody, digital operations, issuance of tokenized shares, rent flow management and applicable regulatory compliance.',
        'Users acquire, through the Platform, an economic participation linked to the Series corresponding to the underlying asset, without implying direct transfer of property ownership or acquisition of shares, equity interests or negotiable securities in the classical sense.'
      ]
    },
    {
      id: 'token-vault',
      title: '2. Token Nature and ERC-4626 Vault (Base Network)',
      summary: 'Digital shares in a yield vault; assignments of collection rights over rents.',
      paragraphs: [
        'The Platform implements smart contracts deployed on the **Base network** (Ethereum Layer 2) complying with the **ERC-4626** tokenized yield vault standard.',
        'Tokens issued for each Series **are NOT corporate shares**, participations in the share capital of Sanova Global SAS, public offering securities or speculative cryptoassets detached from real assets. They represent **Digital Shares** within a **Digital Vault** that administers **Assignments of Collection Rights** arising from lease and hotel operation contracts of the corresponding Specific Asset Pool.',
        'The **ERC-4626** standard ensures that yields generated by underlying assets — primarily rental income — accumulate in the vault in an **automated, proportional and on-chain auditable** manner, increasing net asset value (NAV) per share as USDC flows into the vault, without requiring manual individual distributions to each holder.',
        'The relationship between off-chain participation in the Trust and the User\'s on-chain wallet is recorded in Sanova\'s secure databases, linking verified legal identity (KYC) with the authorized wallet\'s public address.'
      ],
      bullets: [
        '**Share:** proportional participation unit in the assets and flows of the Digital Vault of a given Series.',
        '**Vault (ERC-4626):** smart contract that custodies USDC and mints/burns shares according to NAV.',
        '**Assignment of Collection Rights:** legal instrument by which the Trust assigns the vault the right to collect rents derived from the underlying property.'
      ]
    },
    {
      id: 'colocacion-privada',
      title: '3. Public Offering Exemption · Private Placement',
      summary: 'Private placement of ERC-4626 shares; not a CNV-registrable public offering (Art. 2, Law 26,831).',
      paragraphs: [
        'The issuance, primary placement and restricted transfers of **ERC-4626 tokenized shares** described in these Terms constitute a **Private Placement** of participations linked to real assets, **aimed exclusively at a limited universe of investors** accessing through enabled registration, invitation and KYC/AML compliance, without open solicitation or public subscription.',
        'The User acknowledges and accepts that Platform operations **do NOT constitute a public offering of negotiable securities** under **Article 2 of Law No. 26,831** nor an issuance subject to authorization, registration, prospectus or public offering before the **National Securities Commission (CNV)** of the Argentine Republic. **Sanova Global SAS does not act as a capital markets agent, stock broker, ALyC, registered investment advisor or CNV-authorized intermediary** in relation to these shares.',
        'Sanova Global SAS does not conduct mass promotion, public placement advertising or indiscriminate fundraising campaigns. Access to the Platform, primary marketplace and internal secondary market is conditioned on identity verification, eligibility assessment and express acceptance of these Terms.',
        'ERC-4626 shares **are not shares, negotiable bonds, public mutual fund units or freely tradable cryptoassets**. Their circulation is limited to the ecosystem enabled by Sanova under compliance policies and on-chain restrictions.',
        'The User declares sufficient knowledge, experience and assets to evaluate risks inherent in tokenized real asset investments, including — without limitation — real estate market risk, counterparty risk, smart contract technology risk, regulatory risk and liquidity risk.'
      ]
    },
    {
      id: 'aml-kyc',
      title: '4. AML/KYC Compliance and Authorized Wallets',
      summary: 'Operations restricted to verified wallets on the Whitelist.',
      paragraphs: [
        'In compliance with Argentine and international **Anti-Money Laundering and Counter-Terrorist Financing (AML/CFT)** regulations, as well as Sanova\'s internal policies, **only** **digital wallets** whose holders have successfully completed **Know Your Customer (KYC)** and **AML** due diligence administered by the Platform and/or its specialized providers may acquire, receive, transfer, redeem or use shares as **collateral for automated loans**.',
        'Every operational wallet must be included on the **Whitelist** of the smart contract corresponding to the Series. Transactions from unauthorized addresses will be **reverted or rejected** by the on-chain protocol.',
        'The **secondary market** enabled on the Platform is **strictly restricted** to previously approved Users, with no free trading with unverified third parties. Sanova reserves the right to suspend, revoke or not renew authorization for any wallet upon regulatory non-compliance, risk alerts, false KYC information or competent authority requirement.',
        'The User undertakes to keep personal, tax and source-of-funds information updated, notifying any material change within timeframes required by the Platform or AML regulations.'
      ]
    },
    {
      id: 'moneda-pagos',
      title: '5. Currency, Payments and Settlements',
      summary: 'Exclusive denomination and settlement in USDC on the Base network.',
      paragraphs: [
        'Unless expressly otherwise provided in writing by Sanova and communicated to the User, **all rents, dividends, redemptions, reimbursements, collateralized loan liquidations and other economic flows** arising from Trust and ERC-4626 Vault operations are **denominated, accrued and settled exclusively in USD Coin (USDC)**, a stablecoin issued under recognized standards, **via the Base network**.',
        'The User is responsible for maintaining a Base-compatible wallet and bearing gas fees, fiat/on-ramp conversion spreads (where applicable) and taxes in their jurisdiction.',
        'Sanova does not guarantee USDC fiat parity against the US dollar nor uninterrupted availability of external bridges or exchanges. Credit times may vary according to network congestion, off-chain conversion processes and additional AML validations.',
        'Rents from tenants or hotel operators may initially be recorded in fiat currency in operating accounts segregated by property; conversion to USDC and crediting to the vault will follow operational and treasury procedures published by Sanova, prioritizing cost efficiency and auditable traceability.'
      ]
    },
    {
      id: 'prestamos-colateral',
      title: '6. Collateralized Loans and Risks',
      summary: 'Morpho and DeFi protocols; LTV limits and technology risks.',
      paragraphs: [
        'The Platform may enable **collateralized lending** features through compatible DeFi protocols (including, without limitation, **Morpho**), using Vault shares as collateral, always within Loan-to-Value (LTV) limits, whitelists and circuit breakers configured by Sanova.',
        'The User acknowledges that smart contracts, price oracles, lending markets and cross-chain bridges may present vulnerabilities, technical failures or unforeseen regulatory changes. **All investment and credit operations carry risk of partial or total capital loss.**',
        'Sanova does not provide financial, legal or tax advice. The User should consult their own professionals before making investment decisions.'
      ]
    },
    {
      id: 'limitacion-responsabilidad',
      title: '7. Limitation of Liability and Governing Law',
      summary: 'Argentine jurisdiction; limitations under applicable law.',
      paragraphs: [
        'To the maximum extent permitted by applicable law, Sanova Global SAS shall not be liable for indirect damages, lost profits, data loss, third-party provider failures (KYC, hosting, RPC, exchanges) or force majeure events.',
        'These Terms are governed by the **laws of the Argentine Republic**. For any dispute, the parties submit to the jurisdiction of the **Ordinary Courts of the Autonomous City of Buenos Aires**, waiving any other venue, except mandatory rules to the contrary.',
        'Sanova may amend these Terms by publishing an updated version on the Platform. Continued use after publication shall imply acceptance of amendments, unless regulations require additional express consent.'
      ]
    }
  ],
  closingNote: `For legal inquiries, claims or rights related to these Terms, use the [Contact](${LEGAL_CONTACT_PATH}) form.

*Contractual information document. Does not constitute a public offering of negotiable securities, a CNV-registered issuance or personalized investment advice.*`,
  backHome: 'Back to home',
  privacyLinkLabel: 'Privacy Policy',
  contactFormPath: LEGAL_CONTACT_PATH
};

export function getLegalTerms(locale: string): LegalTermsDocument {
  return locale === 'en' ? legalTermsEn : legalTermsEs;
}
