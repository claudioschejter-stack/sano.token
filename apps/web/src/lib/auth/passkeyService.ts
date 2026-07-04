import { createHash } from 'crypto';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON
} from '@simplewebauthn/server';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '@sanova/database';
import {
  passkeyRpName,
  resolvePasskeyWebContext,
  resolvePasskeyWebContextFromClientOrigin,
  type PasskeyWebContext
} from './passkeyConfig';
import { issueAuthUser, updateUserRoleIfNeeded } from './issueAuthUser';
import { is2faLocked, lockoutRemainingSeconds } from './totpService';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const LOGIN_TOKEN_TTL = '2m';

function passkeyLoginSecret(): Uint8Array {
  const secret =
    process.env.AUTH_INTERNAL_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET_NOT_CONFIGURED');
  }
  return new TextEncoder().encode(secret);
}

function hashLoginToken(loginToken: string): string {
  return createHash('sha256').update(loginToken).digest('hex');
}

async function storeChallenge(input: {
  challenge: string;
  type: 'REGISTER' | 'LOGIN';
  userId?: string | null;
  email?: string | null;
}) {
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  await prisma.webAuthnChallenge.deleteMany({
    where: { expiresAt: { lt: new Date() } }
  });

  await prisma.webAuthnChallenge.create({
    data: {
      challenge: input.challenge,
      type: input.type,
      userId: input.userId ?? null,
      email: input.email?.trim().toLowerCase() ?? null,
      expiresAt
    }
  });
}

function clientOriginFromAuthResponse(response: AuthenticationResponseJSON): string {
  const clientData = JSON.parse(
    Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf8')
  ) as { origin?: string };

  if (!clientData.origin) {
    throw new Error('PASSKEY_ORIGIN_MISSING');
  }

  return clientData.origin;
}

function clientOriginFromRegistrationResponse(response: RegistrationResponseJSON): string {
  const clientData = JSON.parse(
    Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf8')
  ) as { origin?: string };

  if (!clientData.origin) {
    throw new Error('PASSKEY_ORIGIN_MISSING');
  }

  return clientData.origin;
}

export async function createPasskeyRegistrationOptions(userId: string, webContext?: PasskeyWebContext) {
  const ctx = webContext ?? resolvePasskeyWebContext();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      passkeys: { select: { credentialId: true, transports: true } }
    }
  });

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const options = await generateRegistrationOptions({
    rpName: passkeyRpName(),
    rpID: ctx.rpId,
    userName: user.email,
    userDisplayName: user.email,
    userID: new TextEncoder().encode(user.id),
    attestationType: 'none',
    excludeCredentials: user.passkeys.map((passkey) => ({
      id: passkey.credentialId,
      transports: (passkey.transports as AuthenticatorTransportFuture[] | null) ?? undefined
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required'
    }
  });

  await storeChallenge({
    challenge: options.challenge,
    type: 'REGISTER',
    userId: user.id,
    email: user.email
  });

  return options;
}

export async function verifyPasskeyRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  deviceName?: string | null,
  webContext?: PasskeyWebContext
) {
  const clientData = JSON.parse(
    Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf8')
  ) as { challenge?: string; origin?: string };

  const ctx = webContext ?? resolvePasskeyWebContextFromClientOrigin(clientData.origin ?? clientOriginFromRegistrationResponse(response));

  const challengeRecord = clientData.challenge
    ? await prisma.webAuthnChallenge.findUnique({ where: { challenge: clientData.challenge } })
    : null;

  const expectedChallenge = challengeRecord?.challenge;
  if (!expectedChallenge || !challengeRecord || challengeRecord.expiresAt < new Date()) {
    throw new Error('CHALLENGE_EXPIRED');
  }

  if (challengeRecord.userId !== userId || challengeRecord.type !== 'REGISTER') {
    throw new Error('CHALLENGE_EXPIRED');
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ctx.origin,
    expectedRPID: ctx.rpId,
    requireUserVerification: true
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('PASSKEY_REGISTRATION_FAILED');
  }

  const { credential, credentialDeviceType } = verification.registrationInfo;

  await prisma.userPasskey.create({
    data: {
      userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: BigInt(credential.counter),
      deviceName: deviceName?.trim() || (credentialDeviceType === 'singleDevice' ? 'Este dispositivo' : 'Passkey'),
      transports: credential.transports ?? []
    }
  });

  await prisma.webAuthnChallenge.delete({ where: { id: challengeRecord.id } }).catch(() => undefined);

  return { ok: true as const };
}

export async function createPasskeyLoginOptions(
  email?: string | null,
  webContext?: PasskeyWebContext,
  deviceCredentialId?: string | null
) {
  const ctx = webContext ?? resolvePasskeyWebContext();
  let normalizedEmail = email?.trim().toLowerCase() || null;
  let allowCredentials: Array<{ id: string; transports?: AuthenticatorTransportFuture[] }> | undefined;

  const trimmedDeviceCredentialId = deviceCredentialId?.trim() || null;

  if (trimmedDeviceCredentialId) {
    const passkey = await prisma.userPasskey.findUnique({
      where: { credentialId: trimmedDeviceCredentialId },
      include: { user: { select: { email: true } } }
    });

    if (!passkey) {
      throw new Error('PASSKEY_NOT_FOUND');
    }

    if (normalizedEmail && passkey.user.email !== normalizedEmail) {
      throw new Error('PASSKEY_NOT_FOUND');
    }

    normalizedEmail = passkey.user.email;
    allowCredentials = [{ id: passkey.credentialId }];
  } else if (normalizedEmail) {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { passkeys: true }
    });

    if (!user?.passkeys.length) {
      throw new Error('PASSKEY_NOT_FOUND');
    }

    allowCredentials =
      user.passkeys.length === 1
        ? [{ id: user.passkeys[0].credentialId }]
        : user.passkeys.map((passkey) => ({
            id: passkey.credentialId
          }));
  }

  const options = await generateAuthenticationOptions({
    rpID: ctx.rpId,
    allowCredentials,
    userVerification: 'required'
  });

  await storeChallenge({
    challenge: options.challenge,
    type: 'LOGIN',
    email: normalizedEmail
  });

  return options;
}

export async function verifyPasskeyLogin(response: AuthenticationResponseJSON, webContext?: PasskeyWebContext) {
  const clientData = JSON.parse(
    Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf8')
  ) as { challenge?: string; origin?: string };

  const ctx =
    webContext ??
    resolvePasskeyWebContextFromClientOrigin(clientData.origin ?? clientOriginFromAuthResponse(response));

  const challengeRecord = clientData.challenge ?
    await prisma.webAuthnChallenge.findUnique({ where: { challenge: clientData.challenge } })
  : null;

  if (
    !challengeRecord ||
    !challengeRecord.challenge ||
    challengeRecord.type !== 'LOGIN' ||
    challengeRecord.expiresAt < new Date()
  ) {
    throw new Error('CHALLENGE_EXPIRED');
  }

  const expectedChallenge = challengeRecord.challenge;

  const passkey = await prisma.userPasskey.findUnique({
    where: { credentialId: response.id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          systemRole: true,
          totpEnabled: true,
          locked2faUntil: true
        }
      }
    }
  });

  if (!passkey) {
    throw new Error('PASSKEY_NOT_FOUND');
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ctx.origin,
    expectedRPID: ctx.rpId,
    credential: {
      id: passkey.credentialId,
      publicKey: new Uint8Array(passkey.publicKey),
      counter: Number(passkey.counter),
      transports: (passkey.transports as AuthenticatorTransportFuture[] | null) ?? undefined
    },
    requireUserVerification: true
  });

  if (!verification.verified) {
    throw new Error('PASSKEY_LOGIN_FAILED');
  }

  await prisma.userPasskey.update({
    where: { id: passkey.id },
    data: {
      counter: BigInt(verification.authenticationInfo.newCounter),
      lastUsedAt: new Date()
    }
  });

  await prisma.webAuthnChallenge.delete({ where: { id: challengeRecord.id } }).catch(() => undefined);

  const email = passkey.user.email;

  if (is2faLocked(passkey.user)) {
    throw new Error(`CUENTA_BLOQUEADA:${lockoutRemainingSeconds(passkey.user)}`);
  }

  // Passkey login already requires WebAuthn user verification (device possession +
  // biometric/PIN, see `requireUserVerification: true` above), which is equivalent-or-
  // stronger than password+TOTP. So unlike password login, a passkey login never asks
  // for the TOTP code, even when `totpEnabled` is true — TOTP stays required only for
  // the password-based desktop login path.
  const loginToken = await new SignJWT({ sub: passkey.user.id, purpose: 'passkey-login' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(LOGIN_TOKEN_TTL)
    .sign(passkeyLoginSecret());

  await prisma.webAuthnChallenge.create({
    data: {
      challenge: hashLoginToken(loginToken),
      type: 'LOGIN_TOKEN',
      userId: passkey.user.id,
      email: passkey.user.email,
      expiresAt: new Date(Date.now() + 2 * 60 * 1000)
    }
  });

  return { requiresTOTP: false as const, loginToken, email };
}

export async function verifyPasskeyLoginToken(loginToken: string) {
  const { payload } = await jwtVerify(loginToken, passkeyLoginSecret());
  if (payload.purpose !== 'passkey-login' || typeof payload.sub !== 'string') {
    return null;
  }

  const tokenHash = hashLoginToken(loginToken);
  const tokenRecord = await prisma.webAuthnChallenge.findUnique({
    where: { challenge: tokenHash }
  });

  if (
    !tokenRecord ||
    tokenRecord.type !== 'LOGIN_TOKEN' ||
    tokenRecord.expiresAt < new Date() ||
    tokenRecord.userId !== payload.sub
  ) {
    return null;
  }

  await prisma.webAuthnChallenge.delete({ where: { id: tokenRecord.id } }).catch(() => undefined);

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, systemRole: true }
  });

  if (!user) {
    return null;
  }

  const role = await updateUserRoleIfNeeded(
    user.id,
    user.email,
    user.systemRole as import('./roles').SystemRole
  );

  return issueAuthUser(user.id, user.email, role);
}

export async function userHasPasskeys(userId: string): Promise<boolean> {
  const count = await prisma.userPasskey.count({ where: { userId } });
  return count > 0;
}
