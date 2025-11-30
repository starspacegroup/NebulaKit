// Test fixtures and mock data
export const mockUser = {
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: new Date('2024-01-01').toISOString()
};

export const mockUsers = [
  mockUser,
  {
    id: '2',
    email: 'user2@example.com',
    name: 'User Two',
    createdAt: new Date('2024-01-02').toISOString()
  }
];

// Mock Cloudflare platform
export function createMockPlatform() {
  return {
    env: {
      DB: {
        prepare: (query: string) => ({
          bind: (...args: any[]) => ({
            first: async () => mockUser,
            all: async () => ({ results: mockUsers }),
            run: async () => ({ success: true })
          }),
          first: async () => mockUser,
          all: async () => ({ results: mockUsers }),
          run: async () => ({ success: true })
        }),
        batch: async (statements: any[]) => statements.map(() => ({ success: true }))
      },
      KV: {
        get: async (key: string) => null,
        put: async (key: string, value: string) => {},
        delete: async (key: string) => {}
      },
      R2: {
        get: async (key: string) => null,
        put: async (key: string, value: any) => {},
        delete: async (key: string) => {}
      }
    },
    context: {
      waitUntil: async (promise: Promise<any>) => promise
    }
  };
}
