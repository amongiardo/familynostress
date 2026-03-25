import { randomUUID } from 'crypto';
import prisma from '../prisma';

export interface ApiTokenRecord {
  id: string;
  userId: string;
  name: string;
  tokenHash: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface ApiTokenMetadata {
  id: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
}

function mapTokenRow(row: {
  id: string;
  user_id: string;
  name: string;
  token_hash: string;
  last_used_at: Date | null;
  expires_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}): ApiTokenRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    tokenHash: row.token_hash,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

function mapTokenMetadata(row: {
  id: string;
  name: string;
  created_at: Date;
  last_used_at: Date | null;
  expires_at: Date | null;
}): ApiTokenMetadata {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
  };
}

export async function createApiTokenRecord(userId: string, name: string, tokenHash: string, expiresAt: Date) {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      created_at: Date;
      last_used_at: Date | null;
      expires_at: Date | null;
    }>
  >`
    INSERT INTO api_access_tokens (id, user_id, name, token_hash, expires_at)
    VALUES (${randomUUID()}, ${userId}, ${name}, ${tokenHash}, ${expiresAt})
    RETURNING id, name, created_at, last_used_at, expires_at
  `;

  return mapTokenMetadata(rows[0]);
}

export async function findApiTokenByHash(tokenHash: string): Promise<ApiTokenRecord | null> {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      user_id: string;
      name: string;
      token_hash: string;
      last_used_at: Date | null;
      expires_at: Date | null;
      revoked_at: Date | null;
      created_at: Date;
    }>
  >`
    SELECT id, user_id, name, token_hash, last_used_at, expires_at, revoked_at, created_at
    FROM api_access_tokens
    WHERE token_hash = ${tokenHash}
    LIMIT 1
  `;

  if (!rows.length) return null;
  return mapTokenRow(rows[0]);
}

export async function touchApiTokenLastUsed(id: string) {
  await prisma.$executeRaw`
    UPDATE api_access_tokens
    SET last_used_at = NOW()
    WHERE id = ${id}
  `;
}

export async function listActiveApiTokensForUser(userId: string): Promise<ApiTokenMetadata[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      created_at: Date;
      last_used_at: Date | null;
      expires_at: Date | null;
    }>
  >`
    SELECT id, name, created_at, last_used_at, expires_at
    FROM api_access_tokens
    WHERE user_id = ${userId} AND revoked_at IS NULL
    ORDER BY created_at DESC
  `;

  return rows.map(mapTokenMetadata);
}

export async function revokeApiTokenForUser(tokenId: string, userId: string): Promise<number> {
  return prisma.$executeRaw`
    UPDATE api_access_tokens
    SET revoked_at = NOW()
    WHERE id = ${tokenId} AND user_id = ${userId} AND revoked_at IS NULL
  `;
}
