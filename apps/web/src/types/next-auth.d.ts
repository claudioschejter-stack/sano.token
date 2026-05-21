import type { DefaultSession } from 'next-auth';
import type { SystemRole } from './lib/auth/roles';

declare module 'next-auth' {
  interface Session {
    authError?: string;
    user: DefaultSession['user'] & {
      role?: SystemRole;
      roles?: SystemRole[];
      accessToken?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    role?: SystemRole;
    roles?: SystemRole[];
    authError?: string;
  }
}
