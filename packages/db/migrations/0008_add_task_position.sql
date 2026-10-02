ALTER TABLE `tasks` ADD `position` real DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `tasks` SET `position` = (SELECT `rn` FROM (SELECT `id`, ROW_NUMBER() OVER (ORDER BY CASE WHEN `due_at` IS NULL THEN 1 ELSE 0 END, `due_at`, `created_at` DESC) AS `rn` FROM `tasks`) AS `ranked` WHERE `ranked`.`id` = `tasks`.`id`);
