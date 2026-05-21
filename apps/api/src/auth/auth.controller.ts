import { Body, Controller, Headers, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Roles, SystemRole } from './roles.decorator';
import { RolesGuard } from './roles.guard';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(12)
  password!: string;
}

class OAuthLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  provider!: string;

  @IsString()
  providerAccountId!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  image?: string;
}

const AUTH_ROLES: SystemRole[] = [
  'ADMIN',
  'ADVISOR_MANAGER',
  'ADVISOR',
  'INVESTOR',
  'TREASURY',
  'OPERATOR'
];

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post('oauth')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  oauthLogin(@Body() body: OAuthLoginDto, @Headers('x-auth-internal-secret') internalSecret?: string) {
    const expectedSecret = this.configService.get<string>('AUTH_INTERNAL_SECRET');
    if (!expectedSecret || internalSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid internal auth secret.');
    }

    return this.authService.oauthLogin(body);
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...AUTH_ROLES)
  verify() {
    return { authenticated: true };
  }
}
