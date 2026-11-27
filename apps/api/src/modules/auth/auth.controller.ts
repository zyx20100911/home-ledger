import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthResponseDTO, FamilyDTO, UserDTO } from '@home-ledger/shared';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedUser } from './types/auth-user.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: '邮箱注册（自动创建默认家庭账本与初始账户）' })
  register(@Body() dto: RegisterDto): Promise<AuthResponseDTO> {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: '邮箱密码登录' })
  login(@Body() dto: LoginDto): Promise<AuthResponseDTO> {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前登录用户信息及所属家庭列表' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<{ user: UserDTO; families: FamilyDTO[] }> {
    return this.authService.getProfile(user.id);
  }
}
