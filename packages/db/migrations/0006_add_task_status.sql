ALTER TABLE `tasks` ADD `status` text DEFAULT 'todo' NOT NULL;
--> statement-breakpoint
UPDATE `tasks` SET `status` = 'done' WHERE `completed_at` IS NOT NULL;
