import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UpsertDeviceInput {
  userId: string;
  deviceId: string;
  platform?: string;
  appVersion?: string;
}

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(input: UpsertDeviceInput): Promise<void> {
    await this.prisma.device.upsert({
      where: {
        userId_deviceId: { userId: input.userId, deviceId: input.deviceId },
      },
      update: {
        platform: input.platform,
        appVersion: input.appVersion,
        lastSeenAt: new Date(),
      },
      create: {
        userId: input.userId,
        deviceId: input.deviceId,
        platform: input.platform,
        appVersion: input.appVersion,
      },
    });
  }
}
