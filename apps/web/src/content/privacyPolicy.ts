import {
  LEGAL_CONTACT_PATH,
  LEGAL_SITE_URL,
  PRIVACY_POLICY_LAST_UPDATED_EN,
  PRIVACY_POLICY_LAST_UPDATED_ES
} from '../lib/legal/legalConfig';

export type PrivacySection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  orderedBullets?: string[];
};

export type PrivacyDocument = {
  title: string;
  lastUpdatedLabel: string;
  lastUpdated: string;
  intro: string;
  sections: PrivacySection[];
  arcoNote: string;
  backHome: string;
  contactFormPath: string;
};

const privacyEs: PrivacyDocument = {
  title: 'Política de Privacidad y Protección de Datos',
  lastUpdatedLabel: 'Última actualización:',
  lastUpdated: PRIVACY_POLICY_LAST_UPDATED_ES,
  intro: `La presente Política de Privacidad describe cómo **Sanova Global SAS** (en adelante, "la Empresa", "nosotros" o "la Plataforma"), en su carácter de **fideicomitente inicial, fiduciario y administrador tecnológico** del **Fideicomiso de Administración Sanova Global RWA**, recopila, utiliza, protege y comparte la información personal de usuarios e inversores ("el Usuario" o "usted") al acceder y utilizar el sitio web ${LEGAL_SITE_URL} y los servicios de tokenización RWA, marketplace, mercado secundario interno y préstamos colateralizados.

El tratamiento de datos personales se realiza en cumplimiento de la **Ley N° 25.326 de Protección de Datos Personales** de la República Argentina, normativa **UIF/PLA/FT**, obligaciones fiscales aplicables y, cuando corresponda, requisitos de autoridades del exterior vinculados a **Compartimentos Internacionales**.`,
  sections: [
    {
      title: '1. Información que Recopilamos',
      paragraphs: [
        'Para garantizar la seguridad jurídica del Fideicomiso, la segregación por Compartimento y el cumplimiento normativo, recopilamos:'
      ],
      bullets: [
        '**Datos de Identidad (KYC):** Nombre completo, documento (DNI/Pasaporte), fecha de nacimiento, nacionalidad, domicilio, estado civil y comprobantes de residencia.',
        '**Datos Financieros y Fiscales:** Origen de fondos, CUIT/CUIL, situación fiscal, declaraciones PEP y documentación de soporte de suscripciones.',
        '**Datos de Suscripción y Compartimento:** Compartimento suscripto, monto, moneda, Cuotapartes/Tokens, contrato de adhesión, actas de suscripción y preferencias de pago de rentas (Vault NAV o Cash Yield).',
        '**Datos Tecnológicos y Web3:** Dirección de wallet en Base, historial on-chain asociado, IP, navegador, logs de plataforma, tx hashes, allowlist/whitelist y registros de mercado secundario interno.',
        '**Datos Internacionales (si aplica):** Información adicional exigida por vehículos locales (*LLC*, *SL*, *trust*) o reguladores extranjeros cuando participe un Compartimento Internacional.'
      ]
    },
    {
      title: '2. Naturaleza Pública de la Blockchain',
      paragraphs: [
        'Usted comprende que la blockchain (como la red Base) es un registro público, inmutable y transparente.'
      ],
      bullets: [
        '**Datos On-Chain:** Su wallet pública, montos de USDC, Cuotapartes/Tokens adquiridos o rescatados, interacciones con vaults y contratos de préstamo son públicos.',
        '**Datos Off-Chain:** **Nunca** publicamos su nombre, DNI ni datos personales tradicionales on-chain. La vinculación identidad legal (KYC) ↔ wallet se almacena cifrada off-chain en servidores seguros de Sanova, en calidad de fiduciario/administrador tecnológico.'
      ]
    },
    {
      title: '3. Uso de la Información',
      paragraphs: ['Utilizamos sus datos personales para:'],
      orderedBullets: [
        '**Validación Legal y Fiduciaria:** Aprobar KYC/AML, registrar suscriptores por Compartimento, incluir wallets en Whitelist y habilitar colocación privada conforme al Contrato Matriz.',
        '**Operatoria Financiera:** Procesar suscripciones al patrimonio del Compartimento, pagos de rentas en USDC o saldo interno, retiros, conciliación de tesorería segregada y liquidaciones de préstamos colateralizados.',
        '**Cumplimiento Normativo:** Prevenir fraude, lavado de activos y financiamiento del terrorismo; responder a UIF, AFIP, CNV u otras autoridades cuando exista obligación legal; documentar migraciones a vehículos regulados si un Compartimento lo requiriese.',
        '**Gestión Documental y Registral:** Coordinar con escribanos, registros de la propiedad, contadores y asesores locales para incorporación de activos en Argentina o en el exterior.',
        '**Comunicación:** Notificaciones sobre Compartimentos suscriptos, rendimientos, cambios contractuales, seguridad de wallet y actualizaciones legales de la Plataforma.'
      ]
    },
    {
      title: '4. Transferencia y Uso Compartido de Datos',
      paragraphs: [
        'Sanova Global SAS **no vende** datos personales. Solo compartimos información bajo confidencialidad con:'
      ],
      bullets: [
        '**Proveedores KYC/AML y biometría** (ej. Didit u otros habilitados).',
        '**Pasarelas de pago y on-ramps** (Stripe, Mercado Pago, Coinbase, Transak u otros) solo para ejecutar pagos autorizados por usted.',
        '**Infraestructura tecnológica** (hosting, RPC, email, analytics operativo) bajo acuerdos de procesamiento.',
        '**Escribanos, registros, bancos y custodios** cuando sea necesario para traslados de dominio, cuentas del Compartimento o activos internacionales.',
        '**Asesores legales, contables y auditores** del Fideicomiso bajo deber de confidencialidad.',
        '**Autoridades competentes** (UIF, AFIP, CNV, Poder Judicial u organismos extranjeros) cuando exista obligación legal o requerimiento válido.',
        '**Vehículos regulados destino** en caso de migración de un Compartimento conforme al Contrato Matriz, limitado a lo necesario para el canje o conversión regulada.'
      ]
    },
    {
      title: '5. Segregación, Retención y Seguridad',
      paragraphs: [
        'Implementamos medidas técnicas, administrativas y criptográficas para proteger información off-chain. Los datos se organizan por **Compartimento** cuando corresponda, sin confundir patrimonio fiduciario con patrimonio social de Sanova.',
        'Conservamos datos mientras mantenga participación activa en un Compartimento y durante los plazos mínimos exigidos por normativa contable, AML y obligaciones fiduciarias, incluso tras finalizar la relación comercial.'
      ]
    },
    {
      title: '6. Sus Derechos (ARCO y Consultas)',
      paragraphs: ['Conforme a la Ley 25.326, usted puede:'],
      bullets: [
        '**Acceder** a sus datos personales.',
        '**Rectificar** información inexacta.',
        '**Solicitar supresión**, sujeta a restricciones legales AML/fiduciarias y conservación de registros exigidos por ley.'
      ]
    }
  ],
  arcoNote: `Para ejercer derechos ARCO o consultas de privacidad, utilice el formulario de [Contacto](${LEGAL_CONTACT_PATH}). Sanova responderá por los canales indicados.

*La Agencia de Acceso a la Información Pública, órgano de control de la Ley N° 25.326, atiende denuncias por incumplimiento en materia de datos personales.*`,
  backHome: 'Volver al inicio',
  contactFormPath: LEGAL_CONTACT_PATH
};

const privacyEn: PrivacyDocument = {
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

export function getPrivacyPolicy(locale: string): PrivacyDocument {
  return locale === 'en' ? privacyEn : privacyEs;
}
