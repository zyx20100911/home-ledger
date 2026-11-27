import { ForbiddenException, Injectable } from '@nestjs/common';
import { FamilyRole } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

const WRITE_ROLES: FamilyRole[] = [FamilyRole.OWNER, FamilyRole.ADMIN, FamilyRole.MEMBER];
const MANAGE_ROLES: FamilyRole[] = [FamilyRole.OWNER, FamilyRole.ADMIN];

@Injectable()
export class FamilyAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertMember(familyId: string, userId: string): Promise<FamilyRole> {
    const member = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId } },
      select: { role: true },
    });

    if (!member) {
      throw new ForbiddenException('无权访问该家庭账本');
    }
    return member.role;
  }

  async assertCanWrite(familyId: string, userId: string): Promise<FamilyRole> {
    const role = await this.assertMember(familyId, userId);
    if (!WRITE_ROLES.includes(role)) {
      throw new ForbiddenException('当前角色仅支持只读查看，无写入权限');
    }
    return role;
  }

  async assertCanManage(familyId: string, userId: string): Promise<FamilyRole> {
    const role = await this.assertMember(familyId, userId);
    if (!MANAGE_ROLES.includes(role)) {
      throw new ForbiddenException('仅户主或管理员可执行此操作');
    }
    return role;
  }
}
