import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { EquipmentCondition, EquipmentType, OwnerType } from '@prisma/client';

export class CreateEquipmentDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEnum(EquipmentType)
  type: EquipmentType;

  @ValidateIf((o) => o.type === 'SERIAL')
  @IsString()
  @MinLength(1)
  factoryNumber?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsEnum(EquipmentCondition)
  condition: EquipmentCondition;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  conditionNote?: string;

  @IsOptional()
  @IsBoolean()
  hasDocuments?: boolean;

  @IsEnum(OwnerType)
  ownerType: OwnerType;

  @ValidateIf((o) => o.ownerType === 'USER')
  @IsString()
  ownerUserId?: string;

  @ValidateIf((o) => o.ownerType === 'WAREHOUSE')
  @IsString()
  ownerWarehouseId?: string;
}

export class UpdateEquipmentDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEnum(EquipmentType)
  type?: EquipmentType;

  @IsOptional()
  @IsString()
  factoryNumber?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsEnum(EquipmentCondition)
  condition?: EquipmentCondition;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  conditionNote?: string;

  @IsOptional()
  @IsBoolean()
  hasDocuments?: boolean;
}

export class TransferEquipmentDto {
  @IsEnum(OwnerType)
  toOwnerType: OwnerType;

  @ValidateIf((o) => o.toOwnerType === 'USER')
  @IsString()
  toUserId?: string;

  @ValidateIf((o) => o.toOwnerType === 'WAREHOUSE')
  @IsString()
  toWarehouseId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class BulkTransferDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids: string[];

  @IsEnum(OwnerType)
  toOwnerType: OwnerType;

  @ValidateIf((o) => o.toOwnerType === 'USER')
  @IsString()
  toUserId?: string;

  @ValidateIf((o) => o.toOwnerType === 'WAREHOUSE')
  @IsString()
  toWarehouseId?: string;
}

export class FlagFillDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  comment: string;
}
