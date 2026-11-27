import { CategoryType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES: Array<{
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  sortOrder: number;
}> = [
  // 支出分类
  {
    id: 'sys-exp-dining',
    name: '餐饮美食',
    type: CategoryType.EXPENSE,
    icon: 'utensils',
    color: '#f97316',
    sortOrder: 10,
  },
  {
    id: 'sys-exp-groceries',
    name: '买菜日用',
    type: CategoryType.EXPENSE,
    icon: 'shopping-basket',
    color: '#10b981',
    sortOrder: 20,
  },
  {
    id: 'sys-exp-housing',
    name: '居家物业',
    type: CategoryType.EXPENSE,
    icon: 'home',
    color: '#3b82f6',
    sortOrder: 30,
  },
  {
    id: 'sys-exp-transport',
    name: '交通出行',
    type: CategoryType.EXPENSE,
    icon: 'car',
    color: '#06b6d4',
    sortOrder: 40,
  },
  {
    id: 'sys-exp-shopping',
    name: '服饰购物',
    type: CategoryType.EXPENSE,
    icon: 'shopping-bag',
    color: '#ec4899',
    sortOrder: 50,
  },
  {
    id: 'sys-exp-medical',
    name: '医疗健康',
    type: CategoryType.EXPENSE,
    icon: 'heart-pulse',
    color: '#ef4444',
    sortOrder: 60,
  },
  {
    id: 'sys-exp-education',
    name: '教育育儿',
    type: CategoryType.EXPENSE,
    icon: 'graduation-cap',
    color: '#8b5cf6',
    sortOrder: 70,
  },
  {
    id: 'sys-exp-entertainment',
    name: '休闲娱乐',
    type: CategoryType.EXPENSE,
    icon: 'gamepad-2',
    color: '#eab308',
    sortOrder: 80,
  },
  {
    id: 'sys-exp-other',
    name: '其他支出',
    type: CategoryType.EXPENSE,
    icon: 'ellipsis',
    color: '#64748b',
    sortOrder: 99,
  },

  // 收入分类
  {
    id: 'sys-inc-salary',
    name: '工资薪金',
    type: CategoryType.INCOME,
    icon: 'briefcase',
    color: '#16a34a',
    sortOrder: 10,
  },
  {
    id: 'sys-inc-bonus',
    name: '奖金补贴',
    type: CategoryType.INCOME,
    icon: 'award',
    color: '#22c55e',
    sortOrder: 20,
  },
  {
    id: 'sys-inc-investment',
    name: '理财收益',
    type: CategoryType.INCOME,
    icon: 'trending-up',
    color: '#0ea5e9',
    sortOrder: 30,
  },
  {
    id: 'sys-inc-other',
    name: '其他收入',
    type: CategoryType.INCOME,
    icon: 'coins',
    color: '#64748b',
    sortOrder: 99,
  },
];

async function main() {
  console.log('Seeding default system categories...');

  for (const category of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: {
        name: category.name,
        icon: category.icon,
        color: category.color,
        sortOrder: category.sortOrder,
      },
      create: {
        ...category,
        isSystem: true,
      },
    });
  }

  console.log(`Seeded ${DEFAULT_CATEGORIES.length} system categories.`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
