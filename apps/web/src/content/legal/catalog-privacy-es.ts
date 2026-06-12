import { LEGAL_CONTACT_PATH, LEGAL_SITE_URL, PRIVACY_POLICY_LAST_UPDATED_ES } from '../../lib/legal/legalConfig';
import type { PrivacyDocument } from './types';

export const privacyEs: PrivacyDocument = {
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
