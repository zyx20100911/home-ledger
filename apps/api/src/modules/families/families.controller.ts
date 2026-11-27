import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FamilyDTO, FamilyInviteDTO, FamilyMemberDTO } from '@home-ledger/shared';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '@/modules/auth/types/auth-user.interface';
import { CreateFamilyDto, CreateInviteDto, JoinFamilyDto } from './dto/family.dto';
import { FamiliesService } from './families.service';

@ApiTags('Families')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('families')
export class FamiliesController {
  constructor(private readonly familiesService: FamiliesService) {}

  @Get()
  @ApiOperation({ summary: '获取当前用户的家庭列表' })
  list(@CurrentUser() user: AuthenticatedUser): Promise<FamilyDTO[]> {
    return this.familiesService.listUserFamilies(user.id);
  }

  @Post()
  @ApiOperation({ summary: '创建新的家庭账本' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFamilyDto): Promise<FamilyDTO> {
    return this.familiesService.createFamily(user.id, dto);
  }

  @Post('join')
  @ApiOperation({ summary: '通过邀请码加入家庭账本' })
  join(@CurrentUser() user: AuthenticatedUser, @Body() dto: JoinFamilyDto): Promise<FamilyDTO> {
    return this.familiesService.joinByCode(user.id, dto);
  }

  @Get(':familyId/members')
  @ApiOperation({ summary: '获取指定家庭的成员列表' })
  members(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FamilyMemberDTO[]> {
    return this.familiesService.listMembers(familyId, user.id);
  }

  @Post(':familyId/invites')
  @ApiOperation({ summary: '生成家庭成员邀请码（仅户主/管理员）' })
  createInvite(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInviteDto,
  ): Promise<FamilyInviteDTO> {
    return this.familiesService.createInvite(familyId, user.id, dto);
  }
}
