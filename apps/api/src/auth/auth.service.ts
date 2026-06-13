import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SystemRole as PrismaSystemRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SystemRole } from './roles.decorator';

type LoginInput = {
  email: string;
  password: string;
};

type OAuthLoginInput = {
  email: string;
  name?: string | null;
  image?: string | null;
  provider: string;
  providerAccountId: string;
};

const ALL_ROLES = new Set<SystemRole>([
  'ADMIN',
  'ADVISOR_MANAGER',
  'ADVISOR',
  'INVESTOR',
  'TREASURY',
  'OPERATOR'
]);

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService
  ) {}

  async login(input: LoginInput) {
    await this.validateServiceCredential(input.email, input.password);

    const roles = await this.resolveRolesForEmail(input.email);

    return this.issueToken(input.email, roles);
  }

  async oauthLogin(input: OAuthLoginInput) {
    this.assertInternalAuthConfigured();

    const email = input.email.trim().toLowerCase();
    const resolvedRole = await this.resolveRolesForEmail(email);
    const role = resolvedRole[0];

    const user = await this.prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: input.name ?? undefined,
        image: input.image ?? undefined,
        oauthProvider: input.provider,
        oauthProviderId: input.providerAccountId,
        systemRole: role as PrismaSystemRole
      },
      update: {
        name: input.name ?? undefined,
        image: input.image ?? undefined,
        oauthProvider: input.provider,
        oauthProviderId: input.providerAccountId,
        systemRole: role as PrismaSystemRole
      }
    });

    return this.issueToken(user.email, [user.systemRole as SystemRole], user.id);
  }

  private async issueToken(email: string, roles: SystemRole[], subject?: string) {
    const payload = {
      sub: subject ?? email,
      email,
      roles
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: Number(this.configService.get<string>('JWT_EXPIRES_IN_SECONDS') ?? 43200),
      roles,
      role: roles[0]
    };
  }

  private assertInternalAuthConfigured() {
    const internalSecret = this.configService.get<string>('AUTH_INTERNAL_SECRET');
    if (!internalSecret || internalSecret.length < 32) {
      throw new UnauthorizedException('OAuth authentication is not configured.');
    }
  }

  private async validateServiceCredential(email: string, password: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const allowedEmails = this.parseEmailList(this.configService.get<string>('AUTH_ADMIN_EMAILS'));
    const legacyAdminEmail = this.configService.get<string>('AUTH_ADMIN_EMAIL')?.trim().toLowerCase();
    if (legacyAdminEmail) {
      allowedEmails.add(legacyAdminEmail);
    }

    if (!allowedEmails.has(normalizedEmail)) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const passwordHash = this.configService.get<string>('AUTH_ADMIN_PASSWORD_HASH');
    if (passwordHash) {
      const isValid = await bcrypt.compare(password, passwordHash);
      if (!isValid) {
        throw new UnauthorizedException('Invalid credentials.');
      }
      return;
    }

    const envPassword = this.configService.get<string>('AUTH_ADMIN_PASSWORD');
    if (envPassword && password === envPassword) {
      return;
    }

    const developmentPassword = this.configService.get<string>('AUTH_DEV_PASSWORD');
    const nodeEnv = this.configService.get<string>('NODE_ENV') ?? 'development';
    if (nodeEnv !== 'production' && developmentPassword && password === developmentPassword) {
      return;
    }

    throw new UnauthorizedException('Authentication is not configured.');
  }

  private async resolveRolesForEmail(email: string): Promise<SystemRole[]> {
    const normalizedEmail = email.trim().toLowerCase();

    const roleFromAllowlist = this.resolveRoleFromAllowlist(normalizedEmail);
    if (roleFromAllowlist) {
      return [roleFromAllowlist];
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { systemRole: true }
    });

    if (existingUser?.systemRole) {
      return [existingUser.systemRole as SystemRole];
    }

    const defaultRole = (this.configService.get<SystemRole>('AUTH_DEFAULT_ROLE') ?? 'INVESTOR') as SystemRole;
    if (!ALL_ROLES.has(defaultRole)) {
      return ['INVESTOR'];
    }

    return [defaultRole];
  }

  private resolveRoleFromAllowlist(email: string): SystemRole | null {
    const roleMaps: Array<{ envKey: string; role: SystemRole }> = [
      { envKey: 'AUTH_ADMIN_EMAILS', role: 'ADMIN' },
      { envKey: 'AUTH_ADVISOR_MANAGER_EMAILS', role: 'ADVISOR_MANAGER' },
      { envKey: 'AUTH_ADVISOR_EMAILS', role: 'ADVISOR' },
      { envKey: 'AUTH_TREASURY_EMAILS', role: 'TREASURY' },
      { envKey: 'AUTH_OPERATOR_EMAILS', role: 'OPERATOR' },
      { envKey: 'AUTH_INVESTOR_EMAILS', role: 'INVESTOR' }
    ];

    for (const { envKey, role } of roleMaps) {
      const emails = this.parseEmailList(this.configService.get<string>(envKey));
      if (emails.has(email)) {
        return role;
      }
    }

    const legacyAdminEmail = this.configService.get<string>('AUTH_ADMIN_EMAIL');
    if (legacyAdminEmail && legacyAdminEmail.toLowerCase() === email) {
      return 'ADMIN';
    }

    return null;
  }

  private parseEmailList(raw?: string | null): Set<string> {
    if (!raw) {
      return new Set();
    }

    return new Set(
      raw
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)
    );
  }
}
