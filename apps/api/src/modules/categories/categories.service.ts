import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CategoryType } from '@prisma/client';
import type { CategoryDTO } from '@home-ledger/shared';
import { PrismaService } from '@/prisma/prisma.service';
import { FamilyAccessService } from '@/modules/families/family-access.service';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FamilyAccessService,
  ) {}

  async list(familyId: string, userId: string, type?: CategoryType): Promise<CategoryDTO[]> {
    await this.access.assertMember(familyId, userId);

    const rows = await this.prisma.category.findMany({
      where: {
        OR: [{ isSystem: true }, { familyId }],
        ...(type ? { type } : {}),
      },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return rows.map((row) => ({
      id: row.id,
      familyId: row.familyId,
      parentId: row.parentId,
      name: row.name,
      type: row.type,
      icon: row.icon,
      color: row.color,
      sortOrder: row.sortOrder,
      isSystem: row.isSystem,
    }));
  }

  async create(familyId: string, userId: string, dto: CreateCategoryDto): Promise<CategoryDTO> {
    await this.access.assertCanWrite(familyId, userId);

    const created = await this.prisma.category.create({
      data: {
        familyId,
        name: dto.name.trim(),
        type: dto.type,
        color: dto.color ?? '#10b981',
        icon: dto.icon ?? 'tag',
        sortOrder: dto.sortOrder ?? 50,
        isSystem: false,
      },
    });

    return {
      id: created.id,
      familyId: created.familyId,
      parentId: created.parentId,
      name: created.name,
      type: created.type,
      icon: created.icon,
      color: created.color,
      sortOrder: created.sortOrder,
      isSystem: created.isSystem,
    };
  }

  async update(
    familyId: string,
    categoryId: string,
    userId: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryDTO> {
    await this.access.assertCanWrite(familyId, userId);

    const existing = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!existing || (existing.familyId !== familyId && !existing.isSystem)) {
      throw new NotFoundException('分类不存在');
    }
    if (existing.isSystem) {
      throw new ForbiddenException('系统预置分类不支持修改');
    }

    const updated = await this.prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });

    return {
      id: updated.id,
      familyId: updated.familyId,
      parentId: updated.parentId,
      name: updated.name,
      type: updated.type,
      icon: updated.icon,
      color: updated.color,
      sortOrder: updated.sortOrder,
      isSystem: updated.isSystem,
    };
  }

  async remove(familyId: string, categoryId: string, userId: string): Promise<{ id: string }> {
    await this.access.assertCanWrite(familyId, userId);

    const existing = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!existing || (existing.familyId !== familyId && !existing.isSystem)) {
      throw new NotFoundException('分类不存在');
    }
    if (existing.isSystem) {
      throw new ForbiddenException('系统预置分类不支持删除');
    }

    await this.prisma.category.delete({ where: { id: categoryId } });
    return { id: categoryId };
  }
}
