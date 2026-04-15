import { Injectable } from '@nestjs/common';
import { Session } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateSessionInput {
  userId: string;
  deviceId: string;
  accessJti: string;
  ip?: string;
  userAgent?: string;
  expiresAt: Date;
}

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateSessionInput): Promise<Session> {
    return this.prisma.session.create({ data: input });
  }

  async findActiveByJti(jti: string): Promise<Session | null> {
    const session = await this.prisma.session.findUnique({
      where: { accessJti: jti },
    });
    return this.isActive(session) ? session : null;
  }

  async findActiveById(id: string): Promise<Session | null> {
    const session = await this.prisma.session.findUnique({ where: { id } });
    return this.isActive(session) ? session : null;
  }

  updateJti(sessionId: string, newJti: string): Promise<Session> {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: { accessJti: newJti },
    });
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  listActiveForUser(userId: string): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private isActive(session: Session | null): session is Session {
    return (
      session !== null &&
      session.revokedAt === null &&
      new Date() < session.expiresAt
    );
  }
}
