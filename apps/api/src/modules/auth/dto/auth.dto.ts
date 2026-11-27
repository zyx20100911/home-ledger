import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'demo@home-ledger.local', description: '登录邮箱' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  @ApiProperty({ example: '123456', description: '登录密码（至少 6 位）' })
  @IsString()
  @MinLength(6, { message: '密码长度至少为 6 位' })
  @MaxLength(64)
  password: string;

  @ApiProperty({ example: '爸爸', description: '用户昵称' })
  @IsString()
  @MinLength(1, { message: '请输入昵称' })
  @MaxLength(30)
  nickname: string;

  @ApiPropertyOptional({ example: '幸福小家', description: '初始家庭账本名称（可选）' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  familyName?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'demo@home-ledger.local', description: '登录邮箱' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  @ApiProperty({ example: '123456', description: '登录密码' })
  @IsString()
  @MinLength(1, { message: '请输入密码' })
  password: string;
}
