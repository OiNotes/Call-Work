export async function enableMocking() {
  const useMockData = import.meta.env.VITE_USE_MOCK_DATA === 'true';

  if (!useMockData) {
    console.log('🔗 Using real backend API');
    return;
  }

  console.log('🎭 Mock mode enabled - using MSW');

  const { worker } = await import('./browser');

  await worker.start({
    onUnhandledRequest: 'bypass',
  });

  console.log('✅ MSW worker started');
}
