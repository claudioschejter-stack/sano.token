import { ethers } from 'ethers';
import { isAlchemyBaseRpc } from '../blockchain/baseRpc';

/**
 * Encontrar el USDC que completa un pago fiat, por el camino más corto que dé el
 * endpoint.
 *
 * `eth_getLogs` es lo único que ofrece un RPC común, y el endpoint público de Base
 * lo limita a 10.000 bloques por consulta. Con una ventana de hasta 1.296.000
 * bloques —unos 30 días— eso son hasta 144 llamadas secuenciales para un pago que
 * estuvo esperando mucho, y cada una puede volver throttleada. Justo el pago más
 * viejo, el que más urge acreditar, es el que más frágil resulta de encontrar.
 *
 * Alchemy expone `alchemy_getAssetTransfers`, que filtra por contrato y
 * destinatario sin techo de ventana y pagina del más nuevo al más viejo. Una
 * llamada resuelve lo que antes eran ciento cuarenta y cuatro.
 *
 * El camino de `getLogs` se queda como failover: si el endpoint no es Alchemy, o
 * si el método falla, la búsqueda sigue funcionando. Este es el código que decide
 * si un pago se acredita, así que no puede depender de que un proveedor responda.
 */

const ERC20_TRANSFER_ABI = ['event Transfer(address indexed from,address indexed to,uint256 value)'];
const USDC_TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');

/** El endpoint público de Base limita `eth_getLogs`; quedarse abajo en cualquier proveedor. */
const LOG_RANGE_CHUNK_BLOCKS = 9000;

/** Techo de resultados por página de Alchemy (1000 es su máximo). */
const ALCHEMY_PAGE_SIZE = 1000;
/**
 * Cuántas páginas recorrer antes de rendirse. A 1000 transferencias por página,
 * veinte páginas son veinte mil transferencias entrantes a treasury: si el monto
 * no apareció ahí, el problema no es de paginado.
 */
const ALCHEMY_MAX_PAGES = 20;

export type TreasuryTransferCandidate = {
  transactionHash: string;
  value: bigint;
};

export type TreasuryTransferSearchParams = {
  tokenAddress: string;
  treasuryAddress: string;
  fromBlock: number;
  toBlock: number;
};

/**
 * ±1 centavo de USDC (6 decimales) para el redondeo de la conversión de moneda.
 * Es la misma tolerancia que usaba la búsqueda por logs; cambiarla acá cambiaría
 * qué pagos se acreditan.
 */
export function amountToleranceMatch(actual: bigint, expected: bigint): boolean {
  if (actual === expected) return true;
  const tol = 10_000n;
  const diff = actual > expected ? actual - expected : expected - actual;
  return diff <= tol;
}

type AlchemyAssetTransfer = {
  hash?: unknown;
  rawContract?: { value?: unknown } | null;
};

type AlchemyAssetTransfersResponse = {
  transfers?: unknown;
  pageKey?: unknown;
};

function parseAlchemyTransfer(entry: unknown): TreasuryTransferCandidate | null {
  if (!entry || typeof entry !== 'object') return null;
  const transfer = entry as AlchemyAssetTransfer;
  const hash = transfer.hash;
  const rawValue = transfer.rawContract?.value;
  if (typeof hash !== 'string' || !hash.startsWith('0x')) return null;
  if (typeof rawValue !== 'string' || !rawValue.startsWith('0x')) return null;
  try {
    // El valor viene en hex y en unidades crudas del token. Convertirlo con BigInt
    // y no con Number: 1000 USDC ya no entra exacto en un float.
    return { transactionHash: hash, value: BigInt(rawValue) };
  } catch {
    return null;
  }
}

/**
 * Candidatos por `alchemy_getAssetTransfers`, del más nuevo al más viejo.
 * Devuelve `null` cuando el endpoint no soporta el método, para que el llamador
 * caiga al camino de logs en vez de tratarlo como "no hay transferencias".
 */
export async function findTreasuryTransfersViaAlchemy(
  send: (method: string, params: unknown[]) => Promise<unknown>,
  params: TreasuryTransferSearchParams,
  matches: (value: bigint) => boolean
): Promise<TreasuryTransferCandidate[] | null> {
  const collected: TreasuryTransferCandidate[] = [];
  let pageKey: string | undefined;

  for (let page = 0; page < ALCHEMY_MAX_PAGES; page += 1) {
    let response: unknown;
    try {
      response = await send('alchemy_getAssetTransfers', [
        {
          fromBlock: ethers.toQuantity(params.fromBlock),
          toBlock: ethers.toQuantity(params.toBlock),
          toAddress: params.treasuryAddress,
          contractAddresses: [params.tokenAddress],
          category: ['erc20'],
          order: 'desc',
          excludeZeroValue: true,
          maxCount: ethers.toQuantity(ALCHEMY_PAGE_SIZE),
          ...(pageKey ? { pageKey } : {})
        }
      ]);
    } catch {
      /**
       * Sin soporte, o el proveedor falló. Mientras no haya coincidencia, un fallo
       * es "no pude concluir" y no "no llegó plata": devolver lista vacía acá
       * dejaría un pago cobrado sin acreditar. Con `null` el llamador cae al camino
       * de logs y vuelve a buscar.
       */
      return collected.length > 0 ? collected : null;
    }

    const payload = (response ?? {}) as AlchemyAssetTransfersResponse;
    const transfers = Array.isArray(payload.transfers) ? payload.transfers : [];

    for (const entry of transfers) {
      const candidate = parseAlchemyTransfer(entry);
      if (candidate && matches(candidate.value)) {
        collected.push(candidate);
      }
    }

    // Con un candidato del monto exacto alcanza: la respuesta viene ordenada de
    // más nuevo a más viejo, así que es el más reciente que coincide.
    if (collected.length > 0) return collected;

    pageKey = typeof payload.pageKey === 'string' ? payload.pageKey : undefined;
    if (!pageKey) break;
  }

  return collected;
}

/**
 * Candidatos por `eth_getLogs`, troceado y del bloque más nuevo al más viejo.
 * Es el camino de siempre, y sigue siendo el que corre cuando el endpoint no es
 * Alchemy.
 */
export async function findTreasuryTransfersViaLogs(
  getLogs: (filter: {
    address: string;
    topics: (string | null)[];
    fromBlock: number;
    toBlock: number;
  }) => Promise<ReadonlyArray<{ topics: readonly string[]; data: string; transactionHash: string }>>,
  params: TreasuryTransferSearchParams,
  matches: (value: bigint) => boolean
): Promise<TreasuryTransferCandidate[]> {
  const iface = new ethers.Interface(ERC20_TRANSFER_ABI);
  const topics = [
    USDC_TRANSFER_TOPIC,
    null,
    ethers.zeroPadValue(ethers.getAddress(params.treasuryAddress), 32)
  ];

  let toBlock = params.toBlock;
  while (toBlock >= params.fromBlock) {
    const chunkFrom = Math.max(params.fromBlock, toBlock - LOG_RANGE_CHUNK_BLOCKS + 1);
    const logs = await getLogs({
      address: params.tokenAddress,
      topics,
      fromBlock: chunkFrom,
      toBlock
    });

    const found: TreasuryTransferCandidate[] = [];
    for (const log of [...logs].reverse()) {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (!parsed) continue;
      const value = parsed.args.value as bigint;
      if (!matches(value)) continue;
      found.push({ transactionHash: log.transactionHash, value });
    }
    if (found.length > 0) return found;

    if (chunkFrom === params.fromBlock) break;
    toBlock = chunkFrom - 1;
  }

  return [];
}

/** Cuál de los dos caminos corresponde a este endpoint. */
export function transferSearchStrategy(rpcUrl: string | null | undefined): 'alchemy' | 'logs' {
  return isAlchemyBaseRpc(rpcUrl) ? 'alchemy' : 'logs';
}
