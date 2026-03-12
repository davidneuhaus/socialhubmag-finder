-- =====================================================
-- SocialHub Mag Finder — Supabase Schema Setup
-- Run this in the Supabase SQL Editor (Dashboard > SQL)
-- =====================================================

-- 1. Admins table (custom auth)
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Magazines table
CREATE TABLE IF NOT EXISTS magazines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  page_count INT DEFAULT 0,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Magazine pages table with full-text search
CREATE TABLE IF NOT EXISTS magazine_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  magazine_id UUID NOT NULL REFERENCES magazines(id) ON DELETE CASCADE,
  page_number INT NOT NULL,
  text_content TEXT NOT NULL,
  text_search TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', text_content)) STORED
);

CREATE INDEX IF NOT EXISTS idx_magazine_pages_search ON magazine_pages USING GIN (text_search);
CREATE INDEX IF NOT EXISTS idx_magazine_pages_magazine_id ON magazine_pages (magazine_id);

-- 4. Full-text search RPC function
CREATE OR REPLACE FUNCTION search_magazine_pages(search_query TEXT, result_limit INT DEFAULT 50)
RETURNS TABLE (
  id UUID,
  magazine_id UUID,
  magazine_name TEXT,
  page_number INT,
  total_pages INT,
  text_content TEXT,
  rank REAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mp.id,
    mp.magazine_id,
    m.name AS magazine_name,
    mp.page_number,
    m.page_count AS total_pages,
    mp.text_content,
    ts_rank(mp.text_search, websearch_to_tsquery('english', search_query)) AS rank
  FROM magazine_pages mp
  JOIN magazines m ON m.id = mp.magazine_id
  WHERE mp.text_search @@ websearch_to_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT result_limit;
END;
$$;

-- 5. Disable RLS for simplicity (anon key access)
-- If you want to restrict access, add policies as needed.
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE magazines ENABLE ROW LEVEL SECURITY;
ALTER TABLE magazine_pages ENABLE ROW LEVEL SECURITY;

-- Allow anon to read magazines and pages (for public search)
CREATE POLICY "Public can read magazines" ON magazines FOR SELECT USING (true);
CREATE POLICY "Public can read magazine_pages" ON magazine_pages FOR SELECT USING (true);

-- Allow anon to read/insert/update/delete admins (auth handled app-side with bcrypt)
CREATE POLICY "Admins full access" ON admins FOR ALL USING (true);

-- Allow anon to insert/update/delete magazines (admin operations)
CREATE POLICY "Admin magazine write" ON magazines FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin magazine update" ON magazines FOR UPDATE USING (true);
CREATE POLICY "Admin magazine delete" ON magazines FOR DELETE USING (true);

-- Allow anon to insert/delete magazine_pages
CREATE POLICY "Admin pages write" ON magazine_pages FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin pages delete" ON magazine_pages FOR DELETE USING (true);

-- 6. Create storage bucket for magazine PDFs
-- NOTE: Do this manually in Supabase Dashboard > Storage > New Bucket
-- Bucket name: magazines
-- Public: true (so PDFs can be accessed directly)

-- 7. Seed initial admin (password: rtemPPf337!)
INSERT INTO admins (email, password_hash)
VALUES ('david.neuhaus@maloon.de', '$2b$10$onXVVz.BxVS67WYdJSCr8uWJLziA5Jz9l1zCoG4E9YJYsKwzpBxta')
ON CONFLICT (email) DO NOTHING;
