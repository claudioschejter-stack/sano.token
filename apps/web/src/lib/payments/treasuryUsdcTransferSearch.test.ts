import { describe, expect, it, vi } from 'vitest';
import { ethers } from 'ethers';
import {
  amountToleranceMatch,
  findTreasuryTransfersViaAlchemy,
  findTreasuryTransfersViaLogs,
  transferSearchStrategy
} from './treasuryUsdcTransferSearch';

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const TREASURY = '0x1111111111111111111111111111111111111111';
const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');

/** 250 USDC en unidades crudas de 6 decimales. */
const EXPECTED = 250_000_000n;
const matches = (value: bigint) => amountToleranceMatch(value, EXPECTED);

function alchemyTransfer(hash: string, rawValue: bigint) {
  return { hash, rawContract: { value: ethers.toQuantity(rawValue) } };
}

function transferLog(hash: string, value: bigint, from = '0x2222222222222222222222222222222222222222') {
  const iface = new ethers.Interface([
    'event Transfer(address indexed from,address indexed to,uint256 value)'
  ]);
  const encoded = iface.encodeEventLog('Transfer', [from, TREASURY, value]);
  return { topics: encoded.topics, data: encoded.data, transactionHash: hash };
}

describe('amountToleranceMatch', () => {
  it('acepta el monto exacto', () => {
    expect(matches(EXPECTED)).toBe(true);
  });

  it('acepta un centavo de diferencia por el redondeo de la conversión', () => {
    expect(matches(EXPECTED + 10_000n)).toBe(true);
    expect(matches(EXPECTED - 10_000n)).toBe(true);
  });

  it('rechaza más de un centavo', () => {
    expect(matches(EXPECTED + 10_001n)).toBe(false);
  });
});

describe('transferSearchStrategy', () => {
  it('elige Alchemy solo cuando el endpoint es de Alchemy', () => {
    expect(transferSearchStrategy('https://base-mainnet.g.alchemy.com/v2/abc')).toBe('alchemy');
    expect(transferSearchStrategy('https://mainnet.base.org')).toBe('logs');
    expect(transferSearchStrategy(null)).toBe('logs');
  });

  /** Un host hostil no debe hacerse pasar por el proveedor dedicado. */
  it('no se deja engañar por un host que contiene el nombre', () => {
    expect(transferSearchStrategy('https://alchemy.com.attacker.example/v2/k')).toBe('logs');
    expect(transferSearchStrategy('https://attacker.example/?x=alchemy.com')).toBe('logs');
  });
});

const params = { tokenAddress: USDC, treasuryAddress: TREASURY, fromBlock: 1_000, toBlock: 1_296_000 + 1_000 };

describe('findTreasuryTransfersViaAlchemy', () => {
  it('encuentra el pago en una sola llamada', async () => {
    const send = vi.fn(async () => ({
      transfers: [alchemyTransfer('0xaaa', 999_000_000n), alchemyTransfer('0xbbb', EXPECTED)]
    }));

    const found = await findTreasuryTransfersViaAlchemy(send, params, matches);

    expect(found?.map((f) => f.transactionHash)).toEqual(['0xbbb']);
    expect(send).toHaveBeenCalledTimes(1);
    const [method, callParams] = send.mock.calls[0] as [string, Array<Record<string, unknown>>];
    expect(method).toBe('alchemy_getAssetTransfers');
    expect(callParams[0].toAddress).toBe(TREASURY);
    expect(callParams[0].contractAddresses).toEqual([USDC]);
    expect(callParams[0].order).toBe('desc');
  });

  /**
   * Sin soporte del método, la búsqueda no puede concluir "no llegó plata": eso
   * dejaría un pago cobrado sin acreditar. Devolver null hace que el llamador use
   * el camino de logs.
   */
  it('devuelve null cuando el endpoint no soporta el método', async () => {
    const send = vi.fn(async () => {
      throw new Error('method alchemy_getAssetTransfers does not exist');
    });

    expect(await findTreasuryTransfersViaAlchemy(send, params, matches)).toBeNull();
  });

  it('pagina cuando el monto no está en la primera página', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ transfers: [alchemyTransfer('0xaaa', 1n)], pageKey: 'k2' })
      .mockResolvedValueOnce({ transfers: [alchemyTransfer('0xbbb', EXPECTED)] });

    const found = await findTreasuryTransfersViaAlchemy(send, params, matches);

    expect(found?.map((f) => f.transactionHash)).toEqual(['0xbbb']);
    expect(send).toHaveBeenCalledTimes(2);
    const secondCall = send.mock.calls[1] as [string, Array<Record<string, unknown>>];
    expect(secondCall[1][0].pageKey).toBe('k2');
  });

  it('pide failover si falla una página intermedia sin haber encontrado el pago', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ transfers: [alchemyTransfer('0xaaa', 1n)], pageKey: 'k2' })
      .mockRejectedValueOnce(new Error('429 Too Many Requests'));

    expect(await findTreasuryTransfersViaAlchemy(send, params, matches)).toBeNull();
  });

  it('deja de paginar cuando no hay más páginas', async () => {
    const send = vi.fn(async () => ({ transfers: [alchemyTransfer('0xaaa', 1n)] }));
    expect(await findTreasuryTransfersViaAlchemy(send, params, matches)).toEqual([]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  /**
   * El monto viene en hex. Convertirlo con Number pierde precisión arriba de
   * 9.007.199.254.740.991 unidades crudas, o sea 9.007 millones de USDC, y también
   * introduce error en montos mucho menores al pasar por float.
   */
  it('lee el monto con BigInt y no con float', async () => {
    const huge = 10_000_000_000_000_001n;
    const send = vi.fn(async () => ({ transfers: [alchemyTransfer('0xbig', huge)] }));

    const found = await findTreasuryTransfersViaAlchemy(send, params, (value) => value === huge);

    expect(found?.[0]?.value).toBe(huge);
  });

  it('ignora entradas mal formadas en vez de romperse', async () => {
    const send = vi.fn(async () => ({
      transfers: [null, 'nope', { hash: '0xnovalue' }, { rawContract: { value: '0x1' } }, alchemyTransfer('0xok', EXPECTED)]
    }));

    const found = await findTreasuryTransfersViaAlchemy(send, params, matches);

    expect(found?.map((f) => f.transactionHash)).toEqual(['0xok']);
  });
});

describe('findTreasuryTransfersViaLogs', () => {
  it('trocea en ventanas de 9.000 bloques y empieza por el bloque más nuevo', async () => {
    const seen: Array<{ fromBlock: number; toBlock: number }> = [];
    const getLogs = vi.fn(async (filter: { fromBlock: number; toBlock: number }) => {
      seen.push({ fromBlock: filter.fromBlock, toBlock: filter.toBlock });
      return [];
    });

    await findTreasuryTransfersViaLogs(getLogs, { ...params, fromBlock: 1_000, toBlock: 20_000 }, matches);

    expect(seen[0]).toEqual({ fromBlock: 11_001, toBlock: 20_000 });
    expect(seen[1]).toEqual({ fromBlock: 2_001, toBlock: 11_000 });
    expect(seen[2]).toEqual({ fromBlock: 1_000, toBlock: 2_000 });
  });

  it('para en el primer trozo que tiene el pago, sin leer toda la ventana', async () => {
    const getLogs = vi.fn(async () => [transferLog('0xaaa', EXPECTED)]);

    const found = await findTreasuryTransfersViaLogs(getLogs, params, matches);

    expect(found.map((f) => f.transactionHash)).toEqual(['0xaaa']);
    expect(getLogs).toHaveBeenCalledTimes(1);
  });

  /**
   * El número que motiva el camino de Alchemy: una ventana de 30 días recorrida en
   * trozos de 9.000 bloques son 144 llamadas secuenciales, cada una con su chance
   * de volver throttleada.
   */
  it('necesita 144 llamadas para recorrer treinta días sin encontrar nada', async () => {
    const getLogs = vi.fn(async () => []);

    await findTreasuryTransfersViaLogs(
      getLogs,
      { ...params, fromBlock: 0, toBlock: 1_296_000 - 1 },
      matches
    );

    expect(getLogs).toHaveBeenCalledTimes(144);
  });

  it('ignora las transferencias de otro monto', async () => {
    const getLogs = vi
      .fn()
      .mockResolvedValueOnce([transferLog('0xaaa', 1n), transferLog('0xbbb', 5_000_000n)])
      .mockResolvedValue([]);

    const found = await findTreasuryTransfersViaLogs(
      getLogs,
      { ...params, fromBlock: 1_000, toBlock: 11_000 },
      matches
    );

    expect(found).toEqual([]);
  });
});
