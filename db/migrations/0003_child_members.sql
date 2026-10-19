ALTER TABLE members ADD COLUMN is_child INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE members ADD COLUMN allowance_cents INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE goals ADD COLUMN member_id TEXT REFERENCES members(id);
