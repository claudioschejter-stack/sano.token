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
import { passkeyOrigin, passkeyRpId, passkeyRpName } from './passkeyConfig';
import { issueAuthUserById, updateUserRoleIfNeeded } from './issueAuthUser';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const LOGIN_TOKEN_TTL = '2m';

function passkeyLoginSecret(): Uint8Array {
  const secret = process.env.AUTH_INTERNAL_SECRET?.trim() || process.env.JWT_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET_NOT_CONFIGURED');
  }
  return new TextEncoder().encode(secret);
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

export async function createPasskeyRegistrationOptions(userId: string) {
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
    rpID: passkeyRpId(),
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
      userVerification: 'preferred',
      authenticatorAttachment: 'platform'
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
  deviceName?: string | null
) {
  const latest = await prisma.webAuthnChallenge.findFirst({
    where: { userId, type: 'REGISTER', expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' }
  });

  const expectedChallenge = latest?.challenge;
  if (!expectedChallenge) {
    throw new Error('CHALLENGE_EXPIRED');
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: passkeyOrigin(),
    expectedRPID: passkeyRpId(),
    requireUserVerification: false
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

  if (latest) {
    await prisma.webAuthnChallenge.delete({ where: { id: latest.id } }).catch(() => undefined);
  }

  return { ok: true as const };
}

export async function createPasskeyLoginOptions(email?: string | null) {
  const normalizedEmail = email?.trim().toLowerCase() || null;
  let allowCredentials: Array<{ id: string; transports?: AuthenticatorTransportFuture[] }> | undefined;

  if (normalizedEmail) {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { passkeys: true }
    });

    if (!user?.passkeys.length) {
      throw new Error('PASSKEY_NOT_FOUND');
    }

    allowCredentials = user.passkeys.map((passkey) => ({
      id: passkey.credentialId,
      transports: (passkey.transports as AuthenticatorTransportFuture[] | null) ?? undefined
    }));
  }

  const options = await generateAuthenticationOptions({
    rpID: passkeyRpId(),
    allowCredentials,
    userVerification: 'preferred'
  });

  await storeChallenge({
    challenge: options.challenge,
    type: 'LOGIN',
    email: normalizedEmail
  });

  return options;
}

export async function verifyPasskeyLogin(response: AuthenticationResponseJSON) {
  const clientData = JSON.parse(
    Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf8')
  ) as { challenge?: string };

  const challengeRecord = clientData.challenge ?
    await prisma.webAuthnChallenge.findUnique({ where: { challenge: clientData.challenge } })
  : null;

  const expectedChallenge = challengeRecord?.challenge;
  if (!expectedChallenge || challengeRecord.expiresAt < new Date()) {
    throw new Error('CHALLENGE_EXPIRED');
  }

  const passkey = await prisma.userPasskey.findUnique({
    where: { credentialId: response.id },
    include: { user: { select: { id: true, email: true, systemRole: true } } }
  });

  if (!passkey) {
    throw new Error('PASSKEY_NOT_FOUND');
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: passkeyOrigin(),
    expectedRPID: passkeyRpId(),
    credential: {
      id: passkey.credentialId,
      publicKey: new Uint8Array(passkey.publicKey),
      counter: Number(passkey.counter),
      transports: (passkey.transports as AuthenticatorTransportFuture[] | null) ?? undefined
    },
    requireUserVerification: false
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

  const role = await updateUserRoleIfNeeded(
    passkey.user.id,
    passkey.user.email,
    passkey.user.systemRole as import('./roles').SystemRole
  );

  const authUser = await issueAuthUserById(passkey.user.id);
  if (!authUser) {
    throw new Error('USER_NOT_FOUND');
  }

  const loginToken = await new SignJWT({ sub: passkey.user.id, purpose: 'passkey-login' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(LOGIN_TOKEN_TTL)
    .sign(passkeyLoginSecret());

  return { loginToken, authUser: { ...authUser, role } };
}

export async function verifyPasskeyLoginToken(loginToken: string) {
  const { payload } = await jwtVerify(loginToken, passkeyLoginSecret());
  if (payload.purpose !== 'passkey-login' || typeof payload.sub !== 'string') {
    return null;
  }

  return issueAuthUserById(payload.sub);
}

export async function userHasPasskeys(userId: string): Promise<boolean> {
  const count = await prisma.userPasskey.count({ where: { userId } });
  return count > 0;
}
