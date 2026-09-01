import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BitrixModule } from './bitrix/bitrix.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { EquipmentModule } from './equipment/equipment.module';
import { ExcelModule } from './excel/excel.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    BitrixModule,
    RolesModule,
    UsersModule,
    WarehousesModule,
    EquipmentModule,
    ExcelModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
