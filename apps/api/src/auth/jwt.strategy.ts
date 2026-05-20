import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SystemRole } from './roles.decorator';

export type JwtPrincipal = {
  sub: string;
  email: string;
  roles: SystemRole[];
};

type JwtPayload = {
  sub: string;
  email: string;
  roles?: SystemRole[];
  role?: SystemRole;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');

    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET must be configured with at least 32 characters.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret
    });
  }

  validate(payload: JwtPayload): JwtPrincipal {
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Invalid token payload.');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      roles: payload.roles ?? (payload.role ? [payload.role] : ['INVESTOR'])
    };
  }
}
