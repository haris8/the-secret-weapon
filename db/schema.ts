import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const tasks = sqliteTable('tasks', { id: text('id').primaryKey(), owner: text('owner').notNull(), data: text('data').notNull(), version: integer('version').notNull().default(1), deleted: integer('deleted').notNull().default(0) }, table => [index('idx_tasks_owner_deleted').on(table.owner, table.deleted)]);
export const reviews = sqliteTable('reviews', { owner: text('owner').primaryKey(), finishedAt: text('finished_at').notNull() });
export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id),
  owner: text('owner').notNull(),
  objectKey: text('object_key').notNull(),
  name: text('name').notNull(),
  size: integer('size').notNull(),
  contentType: text('content_type').notNull(),
  createdAt: text('created_at').notNull(),
}, table => [index('idx_attachments_owner_task').on(table.owner, table.taskId)]);
