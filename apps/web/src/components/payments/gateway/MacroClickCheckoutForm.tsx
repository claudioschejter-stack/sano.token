'use client';

import { useEffect, useRef } from 'react';

export type MacroClickFormFields = {
  actionUrl: string;
  Comercio: string;
  SucursalComercio: string;
  TransaccionComercioId: string;
  Monto: string;
  Hash: string;
  CallbackSuccess: string;
  CallbackCancel: string;
  CallbackPending?: string;
  Informacion?: string;
  UserId?: string;
  'ClientData.CUIT'?: string;
  'ClientData.NombreApellido'?: string;
  Producto: string[];
  MontoProducto?: string[];
};

type Props = {
  formFields: MacroClickFormFields;
  autoSubmit?: boolean;
};

/**
 * Auto-submits the encrypted Click de Pago hosted checkout form (Botón de Integración).
 */
export function MacroClickCheckoutForm({ formFields, autoSubmit = true }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!autoSubmit) return;
    const t = window.setTimeout(() => formRef.current?.submit(), 50);
    return () => window.clearTimeout(t);
  }, [autoSubmit, formFields.TransaccionComercioId]);

  return (
    <form
      ref={formRef}
      method="post"
      action={formFields.actionUrl}
      acceptCharset="UTF-8"
      style={{ display: autoSubmit ? 'none' : 'block' }}
    >
      <meta name="referrer" content="no-referrer" />
      <input type="hidden" name="Comercio" value={formFields.Comercio} />
      <input type="hidden" name="SucursalComercio" value={formFields.SucursalComercio} />
      <input type="hidden" name="TransaccionComercioId" value={formFields.TransaccionComercioId} />
      <input type="hidden" name="Monto" value={formFields.Monto} />
      <input type="hidden" name="Hash" value={formFields.Hash} />
      <input type="hidden" name="CallbackSuccess" value={formFields.CallbackSuccess} />
      <input type="hidden" name="CallbackCancel" value={formFields.CallbackCancel} />
      {formFields.CallbackPending ? (
        <input type="hidden" name="CallbackPending" value={formFields.CallbackPending} />
      ) : null}
      {formFields.Informacion ? (
        <input type="hidden" name="Informacion" value={formFields.Informacion} />
      ) : null}
      {formFields.UserId ? <input type="hidden" name="UserId" value={formFields.UserId} /> : null}
      {formFields['ClientData.CUIT'] ? (
        <input type="hidden" name="ClientData.CUIT" value={formFields['ClientData.CUIT']} />
      ) : null}
      {formFields['ClientData.NombreApellido'] ? (
        <input
          type="hidden"
          name="ClientData.NombreApellido"
          value={formFields['ClientData.NombreApellido']}
        />
      ) : null}
      {formFields.Producto.map((name, index) => (
        <input key={`p-${index}`} type="hidden" name={`Producto[${index}]`} value={name} />
      ))}
      {(formFields.MontoProducto ?? []).map((amount, index) => (
        <input key={`m-${index}`} type="hidden" name={`MontoProducto[${index}]`} value={amount} />
      ))}
      {!autoSubmit ? <button type="submit">Pagar con Banco Macro</button> : null}
    </form>
  );
}
