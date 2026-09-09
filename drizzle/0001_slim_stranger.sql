CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`owner` text NOT NULL,
	`object_key` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`content_type` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_attachments_owner_task` ON `attachments` (`owner`,`task_id`);