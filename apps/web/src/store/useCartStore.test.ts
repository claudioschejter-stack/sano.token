import { beforeEach, describe, expect, it } from 'vitest';
import { useCartStore } from './useCartStore';

const anelo = {
  projectId: 'proj-anelo',
  title: 'AÑELO',
  location: 'Vaca Muerta',
  imageUrl: '',
  pricePerTokenUsd: 20,
  availableTokens: 5000
};

const otro = { ...anelo, projectId: 'proj-otro', title: 'Otro' };

beforeEach(() => {
  useCartStore.setState({ items: [], committedBatch: null });
});

describe('el carrito después de pagar', () => {
  it('un lote confirmado saca lo que ese lote pagó', () => {
    const store = useCartStore.getState();
    store.addItem(anelo);
    useCartStore.getState().commitBatch('batch-1', ['proj-anelo']);

    useCartStore.getState().settleCommittedBatch('batch-1');

    expect(useCartStore.getState().items).toHaveLength(0);
    expect(useCartStore.getState().committedBatch).toBeNull();
  });

  it('lo agregado después del pago sobrevive, porque comprar otro es normal', () => {
    useCartStore.getState().addItem(anelo);
    useCartStore.getState().commitBatch('batch-1', ['proj-anelo']);
    // Added while the first batch was still settling.
    useCartStore.getState().addItem(otro);

    useCartStore.getState().settleCommittedBatch('batch-1');

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].projectId).toBe('proj-otro');
  });

  it('un lote que no es el registrado no toca nada', () => {
    useCartStore.getState().addItem(anelo);
    useCartStore.getState().commitBatch('batch-1', ['proj-anelo']);

    useCartStore.getState().settleCommittedBatch('batch-otro');

    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().committedBatch?.batchId).toBe('batch-1');
  });

  it('vaciar el carrito también olvida el lote entregado', () => {
    useCartStore.getState().addItem(anelo);
    useCartStore.getState().commitBatch('batch-1', ['proj-anelo']);

    useCartStore.getState().clearCart();

    expect(useCartStore.getState().items).toHaveLength(0);
    expect(useCartStore.getState().committedBatch).toBeNull();
  });

  it('sin lote registrado, liquidar cualquiera es inocuo', () => {
    useCartStore.getState().addItem(anelo);

    useCartStore.getState().settleCommittedBatch('batch-1');

    expect(useCartStore.getState().items).toHaveLength(1);
  });
});
