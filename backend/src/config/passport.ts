import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import prisma from '../prisma';
import { generateFamilyAuthCode } from '../utils/familyAuthCode';

interface OAuthProfile {
  id: string;
  displayName: string;
  emails?: Array<{ value: string }>;
  photos?: Array<{ value: string }>;
}

async function attachInviteMembership(userId: string, email: string, inviteToken?: string) {
  if (!inviteToken) return;

  const invite = await prisma.familyInvite.findUnique({
    where: { token: inviteToken },
    include: {
      family: {
        select: {
          deletedAt: true,
        },
      },
    },
  });
  if (!invite || invite.usedAt || invite.expiresAt <= new Date()) return;
  if (invite.family.deletedAt) return;
  if (invite.email.toLowerCase() !== email.toLowerCase()) return;

  await prisma.$transaction(async (tx) => {
    await tx.familyMember.upsert({
      where: {
        familyId_userId: {
          familyId: invite.familyId,
          userId,
        },
      },
      update: {
        status: 'active',
        leftAt: null,
        removedAt: null,
      },
      create: {
        familyId: invite.familyId,
        userId,
        role: 'member',
      },
    });

    await tx.familyInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });
  });
}

async function findOrCreateUser(
  provider: 'google' | 'github',
  profile: OAuthProfile,
  inviteToken?: string
) {
  const email = profile.emails?.[0]?.value;
  if (!email) {
    throw new Error('Email not provided by OAuth provider');
  }

  // Prefer provider match, fallback to existing account with same email.
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { oauthProvider: provider, oauthId: profile.id },
        { email },
      ],
    },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: profile.displayName,
        avatarUrl: profile.photos?.[0]?.value,
        oauthProvider: provider,
        oauthId: profile.id,
        authCode: generateFamilyAuthCode(5),
      },
    });

    const family = await prisma.family.create({
      data: {
        name: `${profile.displayName}'s Family`,
        createdByUserId: user.id,
      },
    });

    await prisma.familyMember.create({
      data: {
        familyId: family.id,
        userId: user.id,
        role: 'admin',
      },
    });
  } else {
    // Keep existing account and refresh profile metadata.
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: user.name || profile.displayName,
        avatarUrl: profile.photos?.[0]?.value || user.avatarUrl,
      },
    });
  }

  await attachInviteMembership(user.id, email, inviteToken);

  return user;
}

export function configurePassport() {
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { id } });
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: `${process.env.BACKEND_URL}/auth/google/callback`,
          passReqToCallback: true,
        },
        async (req, accessToken, refreshToken, profile, done) => {
          try {
            const inviteToken = req.session?.inviteToken;
            const user = await findOrCreateUser('google', profile as OAuthProfile, inviteToken);
            delete req.session?.inviteToken;
            done(null, user);
          } catch (error) {
            done(error as Error);
          }
        }
      )
    );
  }

  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
          callbackURL: `${process.env.BACKEND_URL}/auth/github/callback`,
          passReqToCallback: true,
          scope: ['user:email'],
        },
        async (
          req: Express.Request,
          accessToken: string,
          refreshToken: string,
          profile: OAuthProfile,
          done: (error: Error | null, user?: any) => void
        ) => {
          try {
            const inviteToken = req.session?.inviteToken;
            const user = await findOrCreateUser('github', profile, inviteToken);
            delete req.session?.inviteToken;
            done(null, user);
          } catch (error) {
            done(error as Error);
          }
        }
      )
    );
  }
}

declare module 'express-session' {
  interface SessionData {
    inviteToken?: string;
    activeFamilyId?: string;
  }
}
