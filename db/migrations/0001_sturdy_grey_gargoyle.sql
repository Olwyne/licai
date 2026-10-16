CREATE TABLE `contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`insurer` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`value_cents` integer DEFAULT 0 NOT NULL,
	`monthly_premium_cents` integer DEFAULT 0 NOT NULL,
	`start_date` text,
	`end_date` text,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `goal_pockets` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`account_id` text NOT NULL,
	`pct` integer DEFAULT 100 NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`emoji` text DEFAULT '🎯' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`target_cents` integer NOT NULL,
	`current_cents` integer DEFAULT 0 NOT NULL,
	`deadline` text,
	`kind` text DEFAULT 'court' NOT NULL,
	`color_hex` text DEFAULT '#1D9E75' NOT NULL,
	`linked_account_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`linked_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `investments` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`ticker` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`quantity` real NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`purchase_price_cents` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `loans` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`principal_cents` integer NOT NULL,
	`remaining_cents` integer NOT NULL,
	`monthly_payment_cents` integer NOT NULL,
	`rate_percent` real NOT NULL,
	`end_date` text,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `properties` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`value_cents` integer NOT NULL,
	`purchase_price_cents` integer NOT NULL,
	`purchase_date` text,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`surface_sqm` real,
	`lots` text DEFAULT '[]' NOT NULL,
	`taxe_fonciere_cents` integer DEFAULT 0 NOT NULL,
	`last_estimated_at` text,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `property_owners` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`member_id` text NOT NULL,
	`share_percent` real DEFAULT 100 NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
