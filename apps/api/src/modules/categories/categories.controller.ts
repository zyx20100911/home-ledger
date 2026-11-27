import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CategoryType } from '@prisma/client';
import type { CategoryDTO } from '@home-ledger/shared';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '@/modules/auth/types/auth-user.interface';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('families/:familyId/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: '获取收支分类（含系统预置与家庭自定义）' })
  @ApiQuery({ name: 'type', required: false, enum: CategoryType })
  list(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('type') type?: CategoryType,
  ): Promise<CategoryDTO[]> {
    return this.categoriesService.list(familyId, user.id, type);
  }

  @Post()
  @ApiOperation({ summary: '新增家庭自定义分类' })
  create(
    @Param('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCategoryDto,
  ): Promise<CategoryDTO> {
    return this.categoriesService.create(familyId, user.id, dto);
  }

  @Patch(':categoryId')
  @ApiOperation({ summary: '修改家庭自定义分类' })
  update(
    @Param('familyId') familyId: string,
    @Param('categoryId') categoryId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryDTO> {
    return this.categoriesService.update(familyId, categoryId, user.id, dto);
  }

  @Delete(':categoryId')
  @ApiOperation({ summary: '删除家庭自定义分类' })
  remove(
    @Param('familyId') familyId: string,
    @Param('categoryId') categoryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ id: string }> {
    return this.categoriesService.remove(familyId, categoryId, user.id);
  }
}
