# Colateral en Morpho: un mercado por activo

## La pregunta

¿Conviene un vault de Morpho por activo, o uno por inversor para que pueda poner tokens de distintas propiedades como colateral de un mismo préstamo?

## La respuesta corta

**Un mercado por activo.** Un mercado por inversor no es posible en Morpho Blue, y aunque lo fuera, iría en contra del encuadre legal de Sanova.

## Por qué no es posible

Un mercado en Morpho Blue se define por cinco parámetros inmutables: token prestado, **un** token de colateral, oracle, modelo de interés y LLTV. Un mercado acepta exactamente un tipo de colateral. No es una limitación de configuración: es el diseño del protocolo, y de ahí viene su aislamiento de riesgo.

Los vaults MetaMorpho no cambian esto. Operan del **lado del prestamista**: agrupan USDC y lo distribuyen entre varios mercados. Sirven para eficiencia de capital, no para mezclar colaterales.

Si un inversor tiene tokens de dos propiedades, abre dos posiciones en dos mercados. La interfaz puede mostrarle una deuda consolidada; lo que no puede es cruzarlas on-chain.

## Por qué tampoco conviene

La única forma de lograr colateral mixto sería un token canasta: un vault que contenga varios activos RWA y emita una sola participación, que después sea el colateral de un mercado único. Técnicamente se puede. Estratégicamente rompe tres cosas.

**Rompe el aislamiento legal.** Sanova opera bajo un Fideicomiso de Administración Ordinario **Multicompartimentado**, donde cada compartimento es un patrimonio separado. Un colateral cruzado hace que el incumplimiento de una propiedad pueda liquidar participaciones de otra, lo que contradice el aislamiento entre compartimentos que es la base de la estructura.

**Rompe la valuación.** Cada propiedad tiene su NAV y su oracle. Una canasta necesita un NAV agregado, que hay que recalcular y auditar cada vez que entra o sale un activo, y cada cambio afecta la deuda de todos los que usaron esa canasta como garantía.

**Rompe la liquidación limpia.** Liquidar una canasta obliga a vender participaciones de propiedades sanas para cubrir el default de una. Con un mercado por activo, la liquidación toca solo la propiedad en cuestión.

## La arquitectura recomendada

| Capa | Qué es | Cantidad |
|---|---|---|
| Colateral | Vault ERC-4626 del activo | Uno por propiedad |
| Mercado | Morpho Blue: USDC contra ese vault | Uno por propiedad |
| Oracle | NAV de esa propiedad | Uno por propiedad |
| Liquidez | Vault MetaMorpho que reparte USDC entre los mercados | **Uno para toda la plataforma** |

Esa última fila es donde está la eficiencia de capital que buscás. En lugar de fondear cada mercado por separado, el capital entra a un solo vault MetaMorpho y su curador lo asigna entre los mercados según demanda. Un inversor que quiere prestar USDC lo deposita en un lugar; un inversor que quiere pedir prestado lo hace contra su propiedad. Los riesgos siguen aislados, el capital no.

## Qué significa para el inversor

Un inversor con tokens de tres propiedades tiene tres posiciones posibles, cada una con su propio LLTV y su propia tasa según el riesgo de esa propiedad. Eso es una ventaja y conviene presentarlo así: una propiedad conservadora puede habilitar un LLTV más alto que una en desarrollo, algo imposible si comparten canasta.

En la interfaz se puede mostrar la deuda total consolidada y la capacidad de préstamo agregada. La agregación es de presentación; el aislamiento es de protocolo.
