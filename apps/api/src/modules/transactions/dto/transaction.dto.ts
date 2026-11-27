import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination.dto';

export class CreateTransactionDto {
  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ example: '68.50', description: '交易金额（正数，最多两位小数）' })
  @IsString()
  @Matches(/^\d{1,12}(\.\d{1,2})?$/, { message: '金额格式不正确，最多保留两位小数' })
  amount: string;

  @ApiProperty({ description: '主账户 ID（转账时为转出账户）' })
  @IsString()
  @MinLength(1)
  accountId: string;

  @ApiPropertyOptional({ description: '转入账户 ID（仅转账类型必填）' })
  @IsOptional()
  @IsString()
  toAccountId?: string | null;

  @ApiPropertyOptional({ description: '收支分类 ID（支出/收入必填）' })
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @ApiProperty({ example: '2026-11-26T12:00:00.000Z', description: '交易发生时间 (ISO 8601)' })
  @IsDateString()
  occurredAt: string;

  @ApiPropertyOptional({ example: '一家三口晚餐' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string | null;

  @ApiPropertyOptional({ type: [String], example: ['聚餐'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateTransactionDto {
  @ApiPropertyOptional({ enum: TransactionType })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({ example: '72.00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,12}(\.\d{1,2})?$/, { message: '金额格式不正确，最多保留两位小数' })
  amount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  accountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toAccountId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class QueryTransactionsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TransactionType })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({ description: '按账户筛选（含转出与转入）' })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiPropertyOptional({ description: '按分类筛选' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: '起始日期 ISO 字符串' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '结束日期 ISO 字符串' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: '备注关键词搜索' })
  @IsOptional()
  @IsString()
  keyword?: string;
}

export class ExportTransactionsDto {
  @ApiPropertyOptional({ enum: TransactionType })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({ description: '按账户筛选（含转出与转入）' })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiPropertyOptional({ description: '按分类筛选' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: '起始日期 ISO 字符串' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '结束日期 ISO 字符串' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: '备注关键词搜索' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '指定导出的流水 ID 列表（逗号分隔）' })
  @IsOptional()
  @IsString()
  ids?: string;
}

export class BatchDeleteTransactionsDto {
  @ApiProperty({ type: [String], description: '待删除流水 ID 列表（1~200 条）' })
  @IsArray()
  @ArrayMinSize(1, { message: '请至少选择一条流水' })
  @ArrayMaxSize(200, { message: '单次批量删除不能超过 200 条' })
  @IsString({ each: true })
  @MinLength(1, { each: true })
  ids: string[];
}

export class BatchUpdateTransactionsDto {
  @ApiProperty({ type: [String], description: '待修改流水 ID 列表（1~200 条）' })
  @IsArray()
  @ArrayMinSize(1, { message: '请至少选择一条流水' })
  @ArrayMaxSize(200, { message: '单次批量修改不能超过 200 条' })
  @IsString({ each: true })
  @MinLength(1, { each: true })
  ids: string[];

  @ApiPropertyOptional({ description: '统一修改为的分类 ID' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  categoryId?: string;

  @ApiPropertyOptional({ description: '统一修改为的资金账户 ID' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  accountId?: string;
}

export class BatchImportTransactionsDto {
  @ApiProperty({ type: [CreateTransactionDto], description: '批量导入的流水列表（1~500 条）' })
  @IsArray()
  @ArrayMinSize(1, { message: '请至少提供一条待导入流水' })
  @ArrayMaxSize(500, { message: '单次最多导入 500 条流水' })
  @ValidateNested({ each: true })
  @Type(() => CreateTransactionDto)
  items: CreateTransactionDto[];
}
