/**
 * Global Prisma module (TKT-foundation-004) — exports the single
 * `PrismaService` to every domain module without repeated imports.
 */
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
