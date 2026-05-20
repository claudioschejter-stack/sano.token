import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SystemRole } from './roles.decorator';

type LoginInput = {
  email: string;
  password: string;
  role?: SystemRole;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService
  ) {}

  async login(input: LoginInput) {
    await this.validateServiceCredential(input.email, input.password);

    const roles = this.resolveRoles(input.role);
    const payload = {
      sub: input.email,
      email: input.email,
      roles
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: Number(this.configService.get<string>('JWT_EXPIRES_IN_SECONDS') ?? 900),
      roles
    };
  }

  private async validateServiceCredential(email: string, password: string): Promise<void> {
    const adminEmail = this.configService.get<string>('AUTH_ADMIN_EMAIL');
    const passwordHash = this.configService.get<string>('AUTH_ADMIN_PASSWORD_HASH');
    const developmentPassword = this.configService.get<string>('AUTH_DEV_PASSWORD');

    if (!adminEmail || adminEmail.toLowerCase() !== email.toLowerCase()) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (passwordHash) {
      const isValid = await bcrypt.compare(password, passwordHash);
      if (!isValid) {
        throw new UnauthorizedException('Invalid credentials.');
      }
      return;
    }

    const nodeEnv = this.configService.get<string>('NODE_ENV') ?? 'development';

    if (nodeEnv !== 'production' && developmentPassword && password === developmentPassword) {
      return;
    }

    throw new UnauthorizedException('Authentication is not configured.');
  }

  private resolveRoles(requestedRole?: SystemRole): SystemRole[] {
    const allowedRoles = new Set<SystemRole>(['ADMIN', 'TREASURY', 'OPERATOR', 'INVESTOR']);
    const defaultRole = (this.configService.get<SystemRole>('AUTH_DEFAULT_ROLE') ?? 'ADMIN') as SystemRole;
    const role = requestedRole ?? defaultRole;

    if (!allowedRoles.has(role)) {
      throw new UnauthorizedException('Invalid role.');
    }

    return [role];
  }
}
