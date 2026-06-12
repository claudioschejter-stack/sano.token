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
  intro: `Los presentes Términos Legales y Condiciones de Uso (en adelante, los "**Términos**") regulan el acceso y la utilización del sitio web ${LEGAL_SITE_URL} y de los servicios digitales de tokenización de activos del mundo real (RWA), bóvedas de rendimiento, marketplace primario, mercado secundario interno y préstamos colateralizados operados por **Sanova Global SAS** (en adelante, "**Sanova**", la "**Empresa**" o la "**Plataforma**") en su carácter de **fiduciario, fideicomitente inicial y administrador tecnológico** del **Fideicomiso de Administración Sanova Global RWA** (Contrato Matriz por Compartimentos Estancos).

Al registrarse, conectar una billetera digital, completar el proceso KYC/AML, suscribir cuotapartes de un Compartimento o utilizar cualquier funcionalidad de la Plataforma, el Usuario declara haber leído, comprendido y aceptado íntegramente estos Términos, el Contrato Matriz y Anexos aplicables del Fideicomiso, así como la [Política de Privacidad](/privacidad). Si no está de acuerdo, deberá abstenerse de utilizar la Plataforma.`,
  indexTitle: 'Índice',
  sections: [
    {
      id: 'vehiculo-legal',
      title: '1. Naturaleza del Vehículo Legal y Compartimentos',
      summary: 'Contrato Matriz Sanova Global RWA, Compartimentos estancos, Sanova como fideicomitente inicial y fiduciario.',
      paragraphs: [
        'La Plataforma opera en nombre del **Fideicomiso de Administración Sanova Global RWA** (en adelante, el "**Fideicomiso**" o "**Contrato Matriz**"), constituido conforme a los artículos 1666 a 1707 del **Código Civil y Comercial de la Nación (CCCN)** de la República Argentina.',
        '**Sanova Global SAS**, sociedad constituida bajo las leyes de la **Provincia de Tierra del Fuego, Antártida e Islas del Atlántico Sur**, interviene como **Fideicomitente Inicial**, **Fiduciario** y **administrador tecnológico**, sin ser beneficiaria principal de las cuotapartes emitidas a inversores, salvo participación residual expresamente indicada en el Anexo de un Compartimento.',
        'Cada activo, proyecto o inmueble subyacente — en Argentina o en el exterior — se administra mediante un **Compartimento estanco** (también denominado "**Serie**" o "**Patrimonio de Afectación Específica**"), segregado patrimonialmente del resto de los Compartimentos y del patrimonio social de Sanova Global SAS.',
        'Los bienes fiduciarios **no integran el patrimonio propio** de Sanova Global SAS. Sanova administra, representa y opera la Plataforma **por cuenta del Fideicomiso** y del Compartimento correspondiente.',
        'Los Usuarios que suscriben cuotapartes adquieren participación económica vinculada al **Compartimento** del activo subyacente, sin transferencia de dominio directo sobre el inmueble ni adquisición de acciones o cuotas sociales de Sanova Global SAS.',
        'La compartimentación se sustenta en el contrato de fideicomiso de administración (arts. **1666 a 1707 CCCN**), el **patrimonio separado** e inembargable por reglas generales (art. **1685**), la **autonomía de la voluntad** para diseñar la estructura (art. **958**), la **individualización de bienes** por sub-patrimonio (art. **1667**) y la **limitación del recurso** de acreedores (art. **1687**). La analogía con series o compartimentos de fideicomisos financieros bajo la **Ley N° 26.831** es meramente estructural; el Fideicomiso opera en modalidad **civil y privada**, sin registro CNV, salvo migración expresa.',
        'El Fideicomiso podrá obtener identificación fiscal (CUIT u equivalente) cuando corresponda. Hasta entonces, la operatoria se documentará con contabilidad segregada por Compartimento, sin confundir fondos fiduciarios con fondos propios de Sanova.'
      ]
    },
    {
      id: 'token-vault',
      title: '2. Cuotapartes, Tokens y Bóveda ERC-4626 (Red Base)',
      summary: 'Representación digital privada; transferibilidad restringida; Vault NAV o distribución cash.',
      paragraphs: [
        'La Plataforma implementa contratos inteligentes desplegados en la **red Base** (Layer 2 de Ethereum) que cumplen con el estándar **ERC-4626** (*Tokenized Vault Standard*), cuando el Anexo del Compartimento así lo prevea.',
        'Las **Cuotapartes Fiduciarias** y los **Tokens** representan derechos de beneficio económico y posición contractual privada vinculados exclusivamente al Compartimento de origen. **NO constituyen** acciones de Sanova Global SAS, obligaciones negociables, cuotas de FCI de oferta pública ni criptoactivos de libre comercialización desvinculados de activos reales.',
        'La emisión y registro digital de Tokens se realiza **por mandato del Fiduciario** en nombre del patrimonio del Compartimento. Sanova Global SAS no emite derechos sobre su propio patrimonio social salvo participación residual expresamente documentada.',
        'Según el Anexo del Compartimento, los rendimientos podrán acumularse en la Bóveda incrementando el **NAV** por cuotaparte, o distribuirse en modalidad **Cash Yield** directamente a Wallets autorizadas, preferentemente en **USDC**.',
        'Las Cuotapartes y/o Tokens son **intranferibles** salvo autorización previa del Fiduciario, verificación KYC/AML e inclusión en la **Lista Blanca (*Whitelist*)** del Smart Contract. Queda prohibida la negociación en mercados abiertos, pools públicos o ante público indeterminado.',
        'La relación entre la participación fiduciaria off-chain, el contrato de suscripción del Compartimento y la wallet on-chain del Usuario queda registrada en bases de datos seguras de Sanova, vinculando identidad legal verificada (KYC) con la dirección pública autorizada.'
      ],
      bullets: [
        '**Cuotaparte / Share:** unidad de participación proporcional en los activos y flujos del Compartimento.',
        '**Vault (ERC-4626):** contrato inteligente que custodia USDC y emite o recibe cuotapartes conforme al NAV, cuando aplique.',
        '**Cesión de Derechos de Cobro:** instrumento jurídico mediante el cual el Fideicomiso cede al vault, cuando corresponda, el derecho de percibir rentas del activo subyacente.'
      ]
    },
    {
      id: 'colocacion-privada',
      title: '3. Colocación Privada · No Oferta Pública · CNV',
      summary: 'Operatoria privada sin registro CNV; prohibición de captación masiva; límites por Compartimento.',
      paragraphs: [
        'La emisión, suscripción primaria y transferencias secundarias autorizadas de Cuotapartes y/o Tokens constituyen una **Colocación Privada** destinada a un **universo acotado, determinado o determinable** de inversores que accedan mediante registro habilitado, invitación, evaluación de elegibilidad y cumplimiento KYC/AML, **sin convocatoria abierta ni solicitud pública de suscripción**.',
        'El Usuario reconoce que la operatoria privada del Fideicomiso y de la Plataforma **NO constituye oferta pública de valores negociables** en los términos del **Artículo 2 de la Ley N° 26.831** ni exige, en su modalidad actual, autorización previa, registro, prospecto u oferta pública ante la **Comisión Nacional de Valores (CNV)** de la República Argentina, **siempre que** se mantengan las restricciones de colocación privada y transferibilidad controlada previstas en el Contrato Matriz y estos Términos.',
        '**Sanova Global SAS no actúa** como agente de mercado de capitales, agente de bolsa, ALyC, asesor de inversión registrado ni intermediario autorizado por la CNV en relación con estas cuotapartes en su modalidad privada.',
        'Queda prohibida la promoción masiva, publicidad de colocación dirigida al público en general, landing pages abiertas de suscripción indiscriminada o cualquier mecanismo que configure convocatoria a **personas indeterminadas**.',
        'Cada Compartimento podrá fijar un número máximo de Beneficiarios y montos máximos de colocación privada en su Anexo. Sanova llevará registro de suscriptores primarios conforme al Contrato Matriz.',
        'Ninguna disposición de estos Términos implica aprobación, fiscalización o supervisión del Fideicomiso, sus Cuotapartes, Tokens o la Plataforma por parte de la CNV. La exclusión de oferta pública depende del **cumplimiento efectivo** de las condiciones de colocación privada.',
        'El Usuario declara contar con conocimiento, experiencia y patrimonio suficientes para evaluar los riesgos inherentes, incluyendo riesgo inmobiliario, de contraparte, tecnológico, regulatorio, cambiario y de liquidez.'
      ]
    },
    {
      id: 'aml-kyc',
      title: '4. AML/KYC, Billeteras Autorizadas y Transferencias',
      summary: 'Whitelist obligatoria; transferencias sujetas a aprobación fiduciaria; mercado secundario cerrado.',
      paragraphs: [
        'En cumplimiento de normativa argentina e internacional sobre **Prevención del Lavado de Activos y Financiamiento del Terrorismo (AML/CFT)**, **únicamente** podrán adquirir, recibir, transferir, rescatar o utilizar Cuotapartes como colateral las **wallets** cuyos titulares hayan superado el proceso **KYC/AML** administrado por la Plataforma y/o proveedores especializados.',
        'Toda wallet operativa debe encontrarse incluida en la **Whitelist** del Smart Contract del Compartimento, cuando exista representación digital. Las transacciones desde direcciones no autorizadas serán **revertidas o rechazadas** on-chain.',
        'Toda cesión o transferencia off-chain también requiere **autorización previa del Fiduciario**, aun cuando exista registro blockchain. El mercado secundario interno de la Plataforma está restringido a Usuarios previamente aprobados.',
        'Sanova podrá suspender, revocar o no renovar la autorización de cualquier wallet ante incumplimiento normativo, alertas UIF/AML, información falsa o requerimiento de autoridad competente.',
        'Ante extravío de claves, compromiso de seguridad o fallecimiento del titular debidamente acreditado, el Fiduciario podrá ejecutar procedimientos de **Burn & Mint** hacia una nueva wallet legitimada, previa verificación KYC/AML.',
        'El Usuario se obliga a mantener actualizada su información personal, fiscal y de origen de fondos.'
      ]
    },
    {
      id: 'moneda-pagos',
      title: '5. Moneda, Pagos, Cuentas del Compartimento y Tesorería',
      summary: 'USDC en Base; cuentas segregadas; suscripciones al patrimonio del Compartimento.',
      paragraphs: [
        'Salvo disposición distinta del Anexo del Compartimento, los flujos económicos del Fideicomiso se denominan preferentemente en **USD Coin (USDC)** sobre la **red Base**, en modalidad Vault (NAV) o Cash Yield según corresponda.',
        'Las suscripciones primarias deben ingresar —directamente o sin demora— a cuentas bancarias (CBU/CVU) y/o **Wallets del Compartimento**, identificadas como patrimonio fiduciario y **no** como patrimonio social de Sanova Global SAS.',
        'Queda prohibida la mezcla o compensación de fondos entre Compartimentos o entre fondos fiduciarios y fondos propios de Sanova, salvo honorarios fiduciarios o comisiones de administración debidamente devengadas.',
        'El Usuario es responsable de contar con wallet compatible con Base, comisiones de gas, spreads de conversión fiat/on-ramp e impuestos en su jurisdicción.',
        'Las rentas pueden registrarse inicialmente en moneda fiat en cuentas operativas segregadas por Compartimento; su conversión a USDC y acreditación al vault o distribución cash se realizará conforme a procedimientos de tesorería publicados por Sanova.',
        'Sanova no garantiza paridad fiat de USDC ni disponibilidad ininterrumpida de puentes o exchanges externos.'
      ]
    },
    {
      id: 'incorporacion-inmuebles',
      title: '6. Incorporación de Inmuebles · Procedimiento Notarial-Registral',
      summary: 'Adenda, escritura fiduciaria e inscripción RPI; Cláusula 38 del Contrato Matriz.',
      paragraphs: [
        'Los inmuebles argentinos —terminados, en construcción o terrenos en desarrollo— se integran al Fideicomiso **sin modificar el Contrato Matriz**, mediante el procedimiento de la **Cláusula 38** y el **Anexo I** de Constitución de Compartimento.',
        'La tokenización, la colocación privada y la publicación en la Plataforma **no sustituyen** las formalidades notariales y registrales exigidas por la ley local de la propiedad inmueble. Sanova no habilitará colocación primaria vinculada a un inmueble argentino hasta contar con la documentación notarial y registral indicada en el Contrato Matriz, salvo reservas condicionadas autorizadas por acta fundada del Fiduciario.',
        'El procedimiento consta de tres pasos esenciales: **(1)** Escritura Pública de Adenda o Acta de Constitución de Sub-Patrimonio; **(2)** Escritura de Aporte de Dominio Fiduciario o Compraventa en Propiedad Fiduciaria a favor del Compartimento; **(3)** Inscripción en el **Registro de la Propiedad Inmueble (RPI)** con leyenda de compartimentación oponible a terceros (Cláusula 26).',
        'La compartimentación será oponible frente a jueces, acreedores y terceros cuando conste en el RPI con leyenda sustancialmente equivalente a la prevista en el Contrato Matriz, fundada en los arts. **1685** y **1687** CCCN.'
      ],
      orderedBullets: [
        '**Paso 1 — Adenda / Acta (escritura pública):** individualización del bien, afectación exclusiva al Compartimento, blindaje patrimonial y remisión al Anexo económico.',
        '**Paso 2 — Dominio fiduciario:** aporte o compraventa con comparecencia de Sanova Global SAS como Fiduciario del Compartimento.',
        '**Paso 3 — RPI:** inscripción con leyenda de titular fiduciario, Compartimento/Serie y limitación de responsabilidad patrimonial.',
        '**Terrenos en desarrollo:** el Anexo debe detallar fases, presupuesto, financiamiento, contratistas y prohibición de mezcla de costos entre Compartimentos.'
      ]
    },
    {
      id: 'activos-internacionales',
      title: '7. Compartimentos Internacionales y Activos en el Exterior',
      summary: 'Inmuebles y participaciones globales vía Compartimentos y vehículos locales.',
      paragraphs: [
        'El Fideicomiso puede integrar **Compartimentos Internacionales** con activos, participaciones societarias o derechos vinculados al exterior, conforme al Anexo Internacional correspondiente.',
        'Los activos ubicados fuera de la República Argentina podrán titularizarse mediante vehículos locales (*LLC*, *Ltd*, *SL*, *trust* u otros lícitos), cuya participación se afecta exclusivamente al Compartimento respectivo.',
        'Cada Compartimento Internacional identificará ley aplicable, jurisdicción, moneda operativa, custodios y obligaciones fiscales y cambiarias pertinentes. Sanova cumplirá la normativa argentina aplicable a operatoria transfronteriza.',
        'La Plataforma podrá mostrar información, documentación y flujos diferenciados por jurisdicción del Compartimento, sin implicar oferta pública en ninguna jurisdicción.'
      ]
    },
    {
      id: 'migracion-regulatoria',
      title: '8. Migración a Vehículos Regulados (CNV y Exterior)',
      summary: 'Puente a FCI, fideicomisos financieros u oferta pública sin contaminar Compartimentos privados.',
      paragraphs: [
        'El Fiduciario podrá, respecto de un Compartimento determinado y mediante acta o Anexo específico, participar en **fideicomisos financieros**, **FCI**, *trusts* u otros vehículos sujetos a regulación de mercado de capitales en Argentina o en el exterior, o ceder activos a dichos vehículos, **solo** para habilitar colocación regulada de ese Compartimento.',
        'La migración de un Compartimento **no convertirá automáticamente** al Fideicomiso Matriz ni a los demás Compartimentos en oferta pública ni en sujetos obligados al mantenimiento regulatorio de aquel vehículo, salvo migración expresa.',
        'La migración podrá implicar conversión, canje o liquidación de Tokens privados por cuotapartes o participaciones del vehículo regulado, con aprobación del Fiduciario y, cuando corresponda, de Beneficiarios conforme al Anexo.',
        'Los costos de registro, mantenimiento, auditoría e informes del vehículo regulado serán soportados por el **Compartimento migrado** o por el vehículo receptor, salvo pacto expreso en contrario.'
      ]
    },
    {
      id: 'prestamos-colateral',
      title: '9. Préstamos Colateralizados y Riesgos',
      summary: 'Morpho y protocolos DeFi; límites de LTV y riesgos tecnológicos.',
      paragraphs: [
        'La Plataforma puede habilitar funcionalidades de **préstamo colateralizado** mediante protocolos DeFi compatibles (incluyendo, sin limitarse a, **Morpho**), utilizando las cuotapartes de la Bóveda como garantía, siempre dentro de los límites de *Loan-to-Value* (LTV), listas blancas y circuit breakers configurados por Sanova.',
        'El Usuario reconoce que los smart contracts, oráculos de precios, mercados de préstamos y puentes cross-chain pueden presentar vulnerabilidades, fallas técnicas o cambios regulatorios imprevistos. **Toda inversión y operación de crédito conlleva riesgo de pérdida parcial o total del capital.**',
        'Sanova no presta asesoramiento financiero, legal ni impositivo. El Usuario debe consultar a sus propios profesionales antes de tomar decisiones de inversión.'
      ]
    },
    {
      id: 'limitacion-responsabilidad',
      title: '10. Limitación de Responsabilidad, Arbitraje y Ley Aplicable',
      summary: 'Ley argentina; arbitraje CAC; alineación con Contrato Matriz.',
      paragraphs: [
        'En la máxima medida permitida por la ley aplicable, Sanova Global SAS no será responsable por daños indirectos, lucro cesante, pérdida de datos, fallas de terceros proveedores (KYC, hosting, RPC, exchanges) ni por hechos de fuerza mayor.',
        'Estos Términos se rigen por las **leyes de la República Argentina** y se interpretan en conjunto con el **Contrato Matriz del Fideicomiso Sanova Global RWA** y los Anexos de Compartimento aplicables. Ante conflicto entre estos Términos y el Contrato Matriz respecto de derechos económicos fiduciarios, prevalecerá el Contrato Matriz.',
        'Toda controversia derivada de estos Términos o de la operatoria de la Plataforma en modalidad privada será resuelta por **arbitraje de derecho** ante el **Tribunal Arbitral de la Cámara Argentina de Comercio**, salvo norma imperativa en contrario o pacto distinto en Anexo de Compartimento Internacional.',
        'Sanova podrá modificar estos Términos publicando una versión actualizada en la Plataforma. El uso continuado tras la publicación implicará aceptación de las modificaciones, salvo que la normativa exija consentimiento expreso adicional.'
      ]
    }
  ],
  closingNote: `Para consultas legales, reclamos o ejercicio de derechos relacionados con estos Términos, utilice el formulario de [Contacto](${LEGAL_CONTACT_PATH}).

*Documento informativo de carácter contractual. No constituye oferta pública de valores negociables, emisión registrada ante la CNV ni recomendación personalizada de inversión. La operatoria privada no requiere autorización CNV mientras se respeten las condiciones de colocación privada del Contrato Matriz.*`,
  backHome: 'Volver al inicio',
  privacyLinkLabel: 'Política de Privacidad',
  contactFormPath: LEGAL_CONTACT_PATH
};

const legalTermsEn: LegalTermsDocument = {
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

/** Spanish is the authoritative legal text; English for international readers. */
export function getLegalTerms(locale: string): LegalTermsDocument {
  return locale === 'es' ? legalTermsEs : legalTermsEn;
}
