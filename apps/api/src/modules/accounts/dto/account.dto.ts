import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAccountDto {
  @ApiProperty({ example: '招商银行储蓄卡', description: '账户名称' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name: string;

  @ApiProperty({ enum: AccountType, example: AccountType.BANK_CARD })
  @IsEnum(AccountType)
  type: AccountType;

  @ApiPropertyOptional({ example: '10000.00', description: '初始余额（信用卡欠款可填负数）' })
  @IsOptional()
  @IsString()
  @Matches(/^-?\d{1,12}(\.\d{1,2})?$/, { message: '余额格式不正确，最多保留两位小数' })
  balance?: string = '0.00';

  @ApiPropertyOptional({ default: true, description: '是否计入家庭净资产统计' })
  @IsOptional()
  @IsBoolean()
  includeInNetWorth?: boolean = true;

  @ApiPropertyOptional({ example: '工资卡' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class UpdateAccountDto {
  @ApiPropertyOptional({ example: '招行工资卡' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name?: string;

  @ApiPropertyOptional({ enum: AccountType })
  @IsOptional()
  @IsEnum(AccountType)
  type?: AccountType;

  @ApiPropertyOptional({ example: '12500.00', description: '手动校准当前余额' })
  @IsOptional()
  @IsString()
  @Matches(/^-?\d{1,12}(\.\d{1,2})?$/, { message: '余额格式不正确，最多保留两位小数' })
  balance?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includeInNetWorth?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string | null;

  @ApiPropertyOptional({ description: '是否归档停用' })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
