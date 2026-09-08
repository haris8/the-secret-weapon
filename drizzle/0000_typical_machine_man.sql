CREATE TABLE `reviews` (
	`owner` text PRIMARY KEY NOT NULL,
	`finished_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_owner_deleted` ON `tasks` (`owner`,`deleted`);