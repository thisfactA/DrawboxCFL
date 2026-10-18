CREATE TABLE IF NOT EXISTS drawings(id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, name TEXT NOT NULL, strokes TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 0, visitor TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS drawings_public ON drawings(approved, created_at DESC);
CREATE INDEX IF NOT EXISTS drawings_visitor ON drawings(visitor, created_at DESC);

CREATE INDEX IF NOT EXISTS drawings_created ON drawings(created_at);

CREATE TABLE IF NOT EXISTS drawing_capacity (id INTEGER PRIMARY KEY CHECK(id=1), records INTEGER NOT NULL, bytes INTEGER NOT NULL);

INSERT OR IGNORE INTO drawing_capacity SELECT 1,(SELECT COUNT(*) FROM drawings),(SELECT COALESCE(SUM(length(strokes)),0) FROM drawings) WHERE NOT EXISTS(SELECT 1 FROM drawing_capacity WHERE id=1);

CREATE TRIGGER IF NOT EXISTS drawing_capacity_insert AFTER INSERT ON drawings BEGIN UPDATE drawing_capacity SET records=records+1,bytes=bytes+length(NEW.strokes) WHERE id=1; END;

CREATE TRIGGER IF NOT EXISTS drawing_capacity_delete AFTER DELETE ON drawings BEGIN UPDATE drawing_capacity SET records=records-1,bytes=bytes-length(OLD.strokes) WHERE id=1; END;

CREATE TRIGGER IF NOT EXISTS drawing_capacity_update AFTER UPDATE OF strokes ON drawings BEGIN UPDATE drawing_capacity SET bytes=bytes+length(NEW.strokes)-length(OLD.strokes) WHERE id=1; END;

CREATE TABLE IF NOT EXISTS drawing_messages (drawing_id TEXT PRIMARY KEY REFERENCES drawings(id) ON DELETE CASCADE, message TEXT NOT NULL DEFAULT '');
CREATE TRIGGER IF NOT EXISTS drawing_message_delete AFTER DELETE ON drawings BEGIN DELETE FROM drawing_messages WHERE drawing_id=OLD.id; END;

CREATE TABLE IF NOT EXISTS drawing_mail (drawing_id TEXT PRIMARY KEY REFERENCES drawings(id) ON DELETE CASCADE, state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, first_at INTEGER, next_at INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0, lease TEXT, provider_id TEXT, error TEXT);
CREATE TABLE IF NOT EXISTS drawing_mail_attempts (id TEXT PRIMARY KEY, day TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS drawing_mail_attempt_day ON drawing_mail_attempts(day);
CREATE TRIGGER IF NOT EXISTS drawing_mail_delete AFTER DELETE ON drawings BEGIN DELETE FROM drawing_mail WHERE drawing_id=OLD.id; END;

CREATE TABLE IF NOT EXISTS drawing_trash (drawing_id TEXT PRIMARY KEY REFERENCES drawings(id) ON DELETE CASCADE, trashed_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS drawing_trash_time ON drawing_trash(trashed_at);
INSERT OR IGNORE INTO drawing_trash(drawing_id,trashed_at) SELECT id,CAST(strftime('%s','now') AS INTEGER)*1000 FROM drawings WHERE approved<0;
CREATE TRIGGER IF NOT EXISTS drawing_trash_enter AFTER UPDATE OF approved ON drawings WHEN NEW.approved<0 AND OLD.approved>=0 BEGIN INSERT INTO drawing_trash(drawing_id,trashed_at) VALUES(NEW.id,CAST(strftime('%s','now') AS INTEGER)*1000) ON CONFLICT(drawing_id) DO UPDATE SET trashed_at=excluded.trashed_at; END;
CREATE TRIGGER IF NOT EXISTS drawing_trash_restore AFTER UPDATE OF approved ON drawings WHEN NEW.approved>=0 BEGIN DELETE FROM drawing_trash WHERE drawing_id=NEW.id; END;
CREATE TRIGGER IF NOT EXISTS drawing_trash_delete AFTER DELETE ON drawings BEGIN DELETE FROM drawing_trash WHERE drawing_id=OLD.id; END;
