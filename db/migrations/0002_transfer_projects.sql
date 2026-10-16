CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`emoji` text DEFAULT '📁' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`deadline` text,
	`color_hex` text DEFAULT '#1D9E75' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `kind` text DEFAULT 'expense' NOT NULL;
--> statement-breakpoint
ALTER TABLE `transactions` ADD `to_account_id` text REFERENCES accounts(id);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `goal_id` text;
--> statement-breakpoint
ALTER TABLE `transactions` ADD `project_id` text REFERENCES projects(id);
--> statement-breakpoint
UPDATE `transactions` SET `kind` = CASE
  WHEN `amount_cents` > 0 THEN 'income'
  ELSE 'expense'
END;
--> statement-breakpoint
ALTER TABLE `goals` ADD `project_id` text REFERENCES projects(id);
