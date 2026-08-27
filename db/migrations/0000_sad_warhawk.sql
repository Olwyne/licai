CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`bank_id` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`balance_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`iban` text,
	`color_hex` text,
	`owner_ids` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bank_id`) REFERENCES `banks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`tone` text NOT NULL,
	`date` text NOT NULL,
	`resolved` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `banks` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`color_hex` text NOT NULL,
	`csv_separator` text DEFAULT ';' NOT NULL,
	`csv_decimal` text DEFAULT ',' NOT NULL,
	`csv_date_format` text DEFAULT 'DD/MM/YYYY' NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`category_id` text NOT NULL,
	`limit_cents` integer NOT NULL,
	`month` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`label` text NOT NULL,
	`icon` text NOT NULL,
	`color_hex` text NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `households` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`city` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`short` text NOT NULL,
	`role` text NOT NULL,
	`color_hex` text NOT NULL,
	`monthly_income_cents` integer DEFAULT 0 NOT NULL,
	`birth_year` integer,
	`retire_year` integer,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recurring` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`account_id` text,
	`category_id` text,
	`name` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`frequency` text NOT NULL,
	`kind` text NOT NULL,
	`next_date` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`account_id` text,
	`category_id` text,
	`name` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`date` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`is_common` integer DEFAULT true NOT NULL,
	`imported_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'admin' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);