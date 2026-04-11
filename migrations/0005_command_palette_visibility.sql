-- Add command palette visibility flag for CMS content items
ALTER TABLE content_items ADD COLUMN show_in_command_palette INTEGER NOT NULL DEFAULT 1;