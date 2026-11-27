import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: '宠物开销', description: '分类名称' })
  @IsString()
  @MinLength(1)
  @MaxLength(24)
  name: string;

  @ApiProperty({ enum: CategoryType, example: CategoryType.EXPENSE })
  @IsEnum(CategoryType)
  type: CategoryType;

  @ApiPropertyOptional({ example: '#10b981' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: '颜色需为十六进制格式，如 #10b981' })
  color?: string = '#10b981';

  @ApiPropertyOptional({ example: 'tag' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @IsInt()
  sortOrder?: number = 50;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: '宠物医疗' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(24)
  name?: string;

  @ApiPropertyOptional({ example: '#f97316' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: '颜色需为十六进制格式，如 #f97316' })
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
