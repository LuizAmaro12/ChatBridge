// Android's RN transport otherwise synthesizes an HTTP Origin from the WS URL.
// This native client has no browser origin; Mobile API already accepts empty Origin with JWT.
export function createNativeSocket(url: string): WebSocket {
  const NativeWebSocket = WebSocket as unknown as {
    new(url: string, protocols: string[], options: { headers: { Origin: string } }): WebSocket;
  };
  return new NativeWebSocket(url, [], { headers: { Origin: '' } });
}
