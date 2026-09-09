import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../common/require-permissions.decorator';
import { ALL_PERMISSIONS, PERMISSION_LABELS } from '../common/permissions';

class CreateRoleDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsArray()
  permissions: string[];
}

class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsArray()
  permissions?: string[];
}

@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get('catalog')
  @RequirePermissions('manage_roles')
  catalog() {
    return ALL_PERMISSIONS.map((key) => ({
      key,
      label: PERMISSION_LABELS[key],
    }));
  }

  @Get()
  @RequirePermissions('manage_roles')
  list() {
    return this.roles.list();
  }

  @Post()
  @RequirePermissions('manage_roles')
  create(@Body() dto: CreateRoleDto) {
    return this.roles.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('manage_roles')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.roles.update(id, dto);
  }
}
