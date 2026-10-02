ALTER TABLE `tasks` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `description_version` integer DEFAULT 0 NOT NULL;