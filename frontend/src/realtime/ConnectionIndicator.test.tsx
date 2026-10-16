import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { websocketUrl } from './config';
import { ConnectionIndicator } from './ConnectionIndicator';
import { useConnectionStore } from './connectionStore';

afterEach(() => {
  useConnectionStore.setState({ active: false, status: 'offline' });
});

describe('ConnectionIndicator', () => {
  it('shows a label for every state, not only a color', () => {
    useConnectionStore.setState({ active: true, status: 'live' });
    render(<ConnectionIndicator />);
    expect(screen.getByRole('status')).toHaveTextContent('En vivo');

    act(() => useConnectionStore.setState({ status: 'connecting' }));
    expect(screen.getByRole('status')).toHaveTextContent('Reconectando…');

    act(() => useConnectionStore.setState({ status: 'offline' }));
    expect(screen.getByRole('status')).toHaveTextContent('Sin conexión');
  });

  it('is hidden while no connection is wanted', () => {
    const { container } = render(<ConnectionIndicator />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('websocketUrl', () => {
  it('uses VITE_WS_URL when set', () => {
    expect(websocketUrl('wss://rt.example.co/ws/branch/', 'https://api.example.co')).toBe('wss://rt.example.co/ws/branch/');
  });

  it('derives the socket URL from the API URL', () => {
    expect(websocketUrl(undefined, 'http://localhost:8000')).toBe('ws://localhost:8000/ws/branch/');
    expect(websocketUrl(undefined, 'https://api.example.co/')).toBe('wss://api.example.co/ws/branch/');
  });

  it('resolves a relative API URL against the page', () => {
    expect(websocketUrl(undefined, '/', 'https://app.example.co/domicilios')).toBe('wss://app.example.co/ws/branch/');
  });
});
