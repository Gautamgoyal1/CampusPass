-- 004_performance_indexes.sql
-- Add foreign key and composite query indexes for query scalability

CREATE INDEX IF NOT EXISTS events_organiser_id_idx ON events(organiser_id);
CREATE INDEX IF NOT EXISTS bookings_event_id_status_idx ON bookings(event_id, status);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS notifications_event_id_idx ON notifications(event_id);
CREATE INDEX IF NOT EXISTS notifications_booking_id_idx ON notifications(booking_id);
