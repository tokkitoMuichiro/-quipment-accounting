import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto, UpdateWarehouseDto } from './warehouses.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../common/auth-user';

@Controller('warehouses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WarehousesController {
  constructor(private readonly warehouses: WarehousesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.warehouses.list(user);
  }

  @Get(':id')
  get(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('category') category?: string,
  ) {
    return this.warehouses.get(id, user, category);
  }

  @Post()
  @RequirePermissions('manage_warehouses')
  create(@Body() dto: CreateWarehouseDto) {
    return this.warehouses.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('manage_warehouses')
  update(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehouses.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('manage_warehouses')
  remove(@Param('id') id: string) {
    return this.warehouses.remove(id);
  }
}
