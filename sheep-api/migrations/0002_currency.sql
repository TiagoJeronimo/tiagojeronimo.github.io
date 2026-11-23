-- The currency each gift was paid in: euros, or Swiss francs (for TWINT). Every sheep before this was in euros.
ALTER TABLE sheep ADD COLUMN currency TEXT NOT NULL DEFAULT 'eur';
