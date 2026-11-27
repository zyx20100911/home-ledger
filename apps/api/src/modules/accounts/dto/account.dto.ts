import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
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

  @ApiPropertyOptional({ example: '中国平安', description: '承保/所属机构' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  institution?: string | null;

  @ApiPropertyOptional({ example: '500000.00', description: '保额（商业保险常用）' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,12}(\.\d{1,2})?$/, { message: '保额格式不正确，最多保留两位小数' })
  coverageAmount?: string | null;

  @ApiPropertyOptional({ example: '2027-06-30T00:00:00.000Z', description: '续保/到期日 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  renewalDate?: string | null;

  @ApiPropertyOptional({ example: '工资卡' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string | null;
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

  @ApiPropertyOptional({ example: '中国平安' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  institution?: string | null;

  @ApiPropertyOptional({ example: '500000.00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,12}(\.\d{1,2})?$/, { message: '保额格式不正确，最多保留两位小数' })
  coverageAmount?: string | null;

  @ApiPropertyOptional({ example: '2027-06-30T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  renewalDate?: string | null;

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

export class BatchImportAccountsDto {
  @ApiPropertyOptional({
    enum: ['update', 'skip'],
    default: 'update',
    description: '同名账户处理策略：update 校准更新余额与信息，skip 跳过同名账户',
  })
  @IsOptional()
  @IsIn(['update', 'skip'])
  duplicateStrategy?: 'update' | 'skip' = 'update';

  @ApiProperty({ type: [CreateAccountDto], description: '待导入资金账户列表（1~200 条）' })
  @IsArray()
  @ArrayMinSize(1, { message: '请至少提供一条待导入账户' })
  @ArrayMaxSize(200, { message: '单次最多导入 200 个账户' })
  @ValidateNested({ each: true })
  @Type(() => CreateAccountDto)
  items: CreateAccountDto[];
}
