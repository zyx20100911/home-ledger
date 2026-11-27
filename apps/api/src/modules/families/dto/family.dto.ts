import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FamilyRole } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateFamilyDto {
  @ApiProperty({ example: '爸妈的家', description: '家庭账本名称' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name: string;

  @ApiPropertyOptional({ example: '日常家用开支账本' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

export class CreateInviteDto {
  @ApiPropertyOptional({
    enum: FamilyRole,
    default: FamilyRole.MEMBER,
    description: '受邀成员角色',
  })
  @IsOptional()
  @IsEnum(FamilyRole)
  role?: FamilyRole = FamilyRole.MEMBER;

  @ApiPropertyOptional({ default: 7, description: '有效天数（1~30 天）' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  expiresInDays?: number = 7;

  @ApiPropertyOptional({ default: 5, description: '最大使用次数（1~50）' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxUses?: number = 5;
}

export class JoinFamilyDto {
  @ApiProperty({ example: 'HL8K2P9Q', description: '家庭邀请码' })
  @IsString()
  @MinLength(4)
  @MaxLength(20)
  code: string;
}
