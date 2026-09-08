import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const tasks = sqliteTable('tasks', { id: text('id').primaryKey(), owner: text('owner').notNull(), data: text('data').notNull(), version: integer('version').notNull().default(1), deleted: integer('deleted').notNull().default(0) }, table => [index('idx_tasks_owner_deleted').on(table.owner, table.deleted)]);
export const reviews = sqliteTable('reviews', { owner: text('owner').primaryKey(), finishedAt: text('finished_at').notNull() });
