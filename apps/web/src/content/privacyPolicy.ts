import {
  LEGAL_CONTACT_EMAIL,
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
  contactEmail: string;
};

const privacyEs: PrivacyDocument = {
  title: 'Política de Privacidad y Protección de Datos',
  lastUpdatedLabel: 'Última actualización:',
  lastUpdated: PRIVACY_POLICY_LAST_UPDATED_ES,
  intro: `La presente Política de Privacidad describe cómo **Sanova Global SAS** (en adelante, "la Empresa", "nosotros" o "la Plataforma"), en su rol de administrador tecnológico y fiduciario, recopila, utiliza, protege y comparte la información personal de los usuarios e inversores ("el Usuario" o "usted") al acceder y utilizar el sitio web ${LEGAL_SITE_URL} y los servicios de tokenización de activos del mundo real (RWA) y préstamos colateralizados.

El tratamiento de los datos personales se realiza en estricto cumplimiento con la **Ley N° 25.326 de Protección de Datos Personales** de la República Argentina y normativas internacionales aplicables sobre prevención de lavado de activos (AML/CFT).`,
  sections: [
    {
      title: '1. Información que Recopilamos',
      paragraphs: [
        'Para garantizar la seguridad jurídica del Fideicomiso y cumplir con las normativas financieras, recopilamos diferentes tipos de información:'
      ],
      bullets: [
        '**Datos de Identidad (KYC):** Nombre completo, documento nacional de identidad (DNI/Pasaporte), fecha de nacimiento, nacionalidad, estado civil y comprobantes de domicilio (facturas de servicios o extractos bancarios).',
        '**Datos Financieros y Fiscales:** Información sobre el origen de los fondos, constancias de inscripción impositiva (CUIT/CUIL), situación fiscal y declaración jurada de Persona Expuesta Políticamente (PEP).',
        '**Datos Tecnológicos y Web3:** Dirección de la billetera digital (Wallet Address) conectada a la red Base, historial de transacciones públicas en la blockchain asociadas a dicha billetera, dirección IP, tipo de navegador y datos de uso del sitio web.'
      ]
    },
    {
      title: '2. Naturaleza Pública de la Blockchain',
      paragraphs: [
        'Al utilizar nuestros servicios, usted comprende y acepta que la tecnología blockchain (como la red Base) es un libro mayor público, inmutable y transparente.'
      ],
      bullets: [
        '**Datos On-Chain:** Su dirección de billetera pública, los montos de USDC transferidos, la cantidad de tokens ERC-1155 adquiridos y los contratos de préstamos interactuados son de dominio público.',
        '**Datos Off-Chain:** Nosotros **nunca** publicamos su nombre, DNI ni datos personales tradicionales en la blockchain. La vinculación entre su identidad legal (KYC) y su billetera pública se almacena en nuestros servidores seguros de forma encriptada y fuera de la cadena (*off-chain*).'
      ]
    },
    {
      title: '3. Uso de la Información',
      paragraphs: ['Utilizamos sus datos personales exclusivamente para los siguientes fines:'],
      orderedBullets: [
        '**Validación Legal:** Aprobar su perfil (KYC/AML) para incluir su billetera en la "Lista Blanca" (*Whitelist*), permitiéndole operar en nuestra plataforma y adquirir participaciones del Fideicomiso.',
        '**Operatividad Financiera:** Procesar el pago de rentas mensuales en USDC, gestionar liquidaciones de préstamos colateralizados y emitir reportes fiscales requeridos.',
        '**Cumplimiento Normativo:** Prevenir el fraude, el financiamiento del terrorismo y el lavado de dinero, en cumplimiento con los requerimientos de pasarelas de pago y autoridades competentes.',
        '**Comunicación:** Enviar notificaciones sobre el rendimiento de los inmuebles (ej. actualizaciones del complejo en Añelo), cambios en las tasas de interés de los contratos inteligentes o modificaciones legales.'
      ]
    },
    {
      title: '4. Transferencia y Uso Compartido de Datos',
      paragraphs: [
        'Sanova Global SAS no vende ni comercializa sus datos personales. Solo compartimos su información bajo estricta confidencialidad con:'
      ],
      bullets: [
        '**Proveedores de KYC/AML:** Empresas tecnológicas especializadas en verificación de identidad y biometría.',
        '**Pasarelas de Pago (On-Ramps):** Procesadores de pagos internacionales (ej. Stripe, Transak) estrictamente para ejecutar la conversión de moneda fiat a USDC cuando usted lo solicite.',
        '**Autoridades Gubernamentales y Judiciales:** Cuando exista una obligación legal, requerimiento de la Unidad de Información Financiera (UIF), de la AFIP o una orden judicial válida que nos obligue a revelar la titularidad de los tokens o el flujo de fondos.',
        '**Asesores Financieros (ALyCs):** Si usted ingresó a la plataforma referido por un Agente de Bolsa, compartiremos información sobre su volumen de inversión exclusivamente a los fines de la liquidación de comisiones acordadas con dicho agente.'
      ]
    },
    {
      title: '5. Seguridad y Retención de Datos',
      paragraphs: [
        'Implementamos medidas técnicas, administrativas y criptográficas de nivel institucional para proteger su información off-chain contra accesos no autorizados. Sus datos personales se conservarán durante todo el tiempo que mantenga tokens de la plataforma en su billetera, y por el plazo mínimo legal exigido por la normativa contable y de prevención de lavado de activos tras la finalización de su vínculo comercial.'
      ]
    },
    {
      title: '6. Sus Derechos (Derechos ARCO)',
      paragraphs: ['De conformidad con la Ley 25.326, usted tiene derecho a:'],
      bullets: [
        '**Acceder** a los datos personales que tenemos sobre usted.',
        '**Rectificar** o actualizar información inexacta.',
        '**Solicitar la supresión** de sus datos (sujeto a restricciones legales por normativas AML, ya que no podemos borrar historiales financieros exigidos por ley).'
      ]
    }
  ],
  arcoNote: `Para ejercer estos derechos, o si tiene consultas sobre el manejo de su privacidad, póngase en contacto con nuestro Oficial de Cumplimiento enviando un correo electrónico a: **${LEGAL_CONTACT_EMAIL}**.

*La Agencia de Acceso a la Información Pública, Órgano de Control de la Ley Nº 25.326, tiene la atribución de atender las denuncias y reclamos que se interpongan con relación al incumplimiento de las normas sobre protección de datos personales.*`,
  backHome: 'Volver al inicio',
  contactEmail: LEGAL_CONTACT_EMAIL
};

const privacyEn: PrivacyDocument = {
  title: 'Privacy Policy and Data Protection',
  lastUpdatedLabel: 'Last updated:',
  lastUpdated: PRIVACY_POLICY_LAST_UPDATED_EN,
  intro: `This Privacy Policy describes how **Sanova Global SAS** ("the Company", "we" or "the Platform"), in its role as technological administrator and fiduciary, collects, uses, protects and shares the personal information of users and investors ("the User" or "you") when accessing and using the website ${LEGAL_SITE_URL} and real-world asset (RWA) tokenization and collateralized lending services.

Personal data is processed in strict compliance with **Law No. 25,326 on Personal Data Protection** of the Argentine Republic and applicable international regulations on anti-money laundering and counter-terrorist financing (AML/CFT).`,
  sections: [
    {
      title: '1. Information We Collect',
      paragraphs: [
        'To ensure the legal security of the Trust and comply with financial regulations, we collect different types of information:'
      ],
      bullets: [
        '**Identity Data (KYC):** Full name, national identity document (ID/Passport), date of birth, nationality, marital status and proof of address (utility bills or bank statements).',
        '**Financial and Tax Data:** Information on the source of funds, tax registration certificates (CUIT/CUIL), tax status and Politically Exposed Person (PEP) sworn declaration.',
        '**Technology and Web3 Data:** Connected digital wallet address on the Base network, public blockchain transaction history associated with that wallet, IP address, browser type and website usage data.'
      ]
    },
    {
      title: '2. Public Nature of the Blockchain',
      paragraphs: [
        'By using our services, you understand and accept that blockchain technology (such as the Base network) is a public, immutable and transparent ledger.'
      ],
      bullets: [
        '**On-Chain Data:** Your public wallet address, USDC transfer amounts, ERC-1155 tokens acquired and loan contracts interacted with are public domain.',
        '**Off-Chain Data:** We **never** publish your name, ID number or traditional personal data on the blockchain. The link between your legal identity (KYC) and your public wallet is stored encrypted on our secure servers off-chain.'
      ]
    },
    {
      title: '3. Use of Information',
      paragraphs: ['We use your personal data exclusively for the following purposes:'],
      orderedBullets: [
        '**Legal Validation:** Approve your profile (KYC/AML) to include your wallet on the Whitelist, allowing you to operate on our platform and acquire Trust participations.',
        '**Financial Operations:** Process monthly rent payments in USDC, manage collateralized loan liquidations and issue required tax reports.',
        '**Regulatory Compliance:** Prevent fraud, terrorist financing and money laundering, in compliance with payment gateway requirements and competent authorities.',
        '**Communication:** Send notifications about property performance (e.g. updates on the Añelo complex), changes in smart contract interest rates or legal modifications.'
      ]
    },
    {
      title: '4. Data Transfer and Sharing',
      paragraphs: [
        'Sanova Global SAS does not sell or trade your personal data. We only share your information under strict confidentiality with:'
      ],
      bullets: [
        '**KYC/AML Providers:** Technology companies specialized in identity verification and biometrics.',
        '**Payment Gateways (On-Ramps):** International payment processors (e.g. Stripe, Transak) strictly to execute fiat-to-USDC conversion when you request it.',
        '**Government and Judicial Authorities:** When there is a legal obligation, a requirement from the Financial Information Unit (UIF), AFIP or a valid court order requiring us to disclose token ownership or fund flows.',
        '**Financial Advisors (ALyCs):** If you joined the platform referred by a Stock Broker, we will share information about your investment volume exclusively for settlement of commissions agreed with that agent.'
      ]
    },
    {
      title: '5. Security and Data Retention',
      paragraphs: [
        'We implement institutional-grade technical, administrative and cryptographic measures to protect your off-chain information against unauthorized access. Your personal data will be retained for as long as you hold platform tokens in your wallet, and for the minimum legal period required by accounting and anti-money laundering regulations after the end of your commercial relationship.'
      ]
    },
    {
      title: '6. Your Rights (ARCO Rights)',
      paragraphs: ['In accordance with Law 25,326, you have the right to:'],
      bullets: [
        '**Access** the personal data we hold about you.',
        '**Rectify** or update inaccurate information.',
        '**Request deletion** of your data (subject to legal restrictions under AML regulations, as we cannot erase financial records required by law).'
      ]
    }
  ],
  arcoNote: `To exercise these rights, or if you have questions about how we handle your privacy, contact our Compliance Officer by email at: **${LEGAL_CONTACT_EMAIL}**.

*The Public Information Access Agency, Control Body of Law No. 25,326, is responsible for handling complaints and claims regarding non-compliance with personal data protection regulations.*`,
  backHome: 'Back to home',
  contactEmail: LEGAL_CONTACT_EMAIL
};

export function getPrivacyPolicy(locale: string): PrivacyDocument {
  return locale === 'en' ? privacyEn : privacyEs;
}
