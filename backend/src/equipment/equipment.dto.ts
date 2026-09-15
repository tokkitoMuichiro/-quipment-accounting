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
import {
  AssetCategory,
  CardKind,
  EquipmentCondition,
  EquipmentType,
  OwnerType,
  VehicleKind,
} from '@prisma/client';

export class CreateEquipmentDto {
  @IsOptional()
  @IsEnum(AssetCategory)
  category?: AssetCategory;

  @ValidateIf(
    (o) =>
      (o.category || 'EQUIPMENT') !== 'CARD' ||
      o.cardKind === 'TRANSPONDER' ||
      (o.name != null && String(o.name).trim() !== ''),
  )
  @IsString()
  @MinLength(2)
  name?: string;

  @ValidateIf((o) => (o.category || 'EQUIPMENT') === 'EQUIPMENT')
  @IsEnum(EquipmentType)
  type?: EquipmentType;

  @ValidateIf(
    (o) =>
      (o.category || 'EQUIPMENT') === 'EQUIPMENT' && o.type === 'SERIAL',
  )
  @IsString()
  @MinLength(1)
  factoryNumber?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ValidateIf((o) => (o.category || 'EQUIPMENT') !== 'CARD')
  @IsEnum(EquipmentCondition)
  condition?: EquipmentCondition;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  conditionNote?: string;

  @IsOptional()
  @IsBoolean()
  hasDocuments?: boolean;

  @ValidateIf((o) => (o.category || 'EQUIPMENT') === 'VEHICLE')
  @IsString()
  @MinLength(5)
  plateNumber?: string;

  @ValidateIf((o) => (o.category || 'EQUIPMENT') === 'VEHICLE')
  @IsEnum(VehicleKind)
  vehicleKind?: VehicleKind;

  @ValidateIf((o) => (o.category || 'EQUIPMENT') === 'CARD')
  @IsEnum(CardKind)
  cardKind?: CardKind;

  @ValidateIf((o) => (o.category || 'EQUIPMENT') === 'CARD')
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  cardNumber?: string;

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

  @IsOptional()
  @IsString()
  @MinLength(5)
  plateNumber?: string;

  @IsOptional()
  @IsEnum(VehicleKind)
  vehicleKind?: VehicleKind;

  @IsOptional()
  @IsEnum(CardKind)
  cardKind?: CardKind;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  cardNumber?: string;
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
