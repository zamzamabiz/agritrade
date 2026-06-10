CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS company (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES company(id),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email TEXT UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  preferred_columns JSONB DEFAULT '["id","company_id","trade_type","chapter_id","hs_code","item_name","item_description","ntn","origin_country_id","origin_country","port_of_shipment","importer_name","uom","agent_name","agent_number","terminal_sheds","exporter_name","period_date","quantity","value_usd"]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS country_dim (
  id SMALLSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS uploaded_file (
  id BIGSERIAL PRIMARY KEY,
  upload_id UUID NOT NULL UNIQUE,
  company_id BIGINT NOT NULL REFERENCES company(id),
  trade_type CHAR(1) NOT NULL CHECK (trade_type IN ('I','E')),
  chapter_id SMALLINT NOT NULL CHECK (chapter_id BETWEEN 1 AND 99),
  period_date DATE NOT NULL,
  original_filename TEXT,
  row_count INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Primary key now includes partitioning column (period_date)
CREATE TABLE IF NOT EXISTS trade_fact (
  id BIGSERIAL,
  company_id BIGINT NOT NULL REFERENCES company(id),
  trade_type CHAR(1) NOT NULL CHECK (trade_type IN ('I','E')),
  chapter_id SMALLINT NOT NULL CHECK (chapter_id BETWEEN 1 AND 99),
  upload_id UUID NOT NULL,
  hs_code TEXT,
  item_name TEXT,
  item_description TEXT,
  ntn TEXT,
  origin_country_id SMALLINT NOT NULL REFERENCES country_dim(id),
  port_of_shipment TEXT,
  importer_name TEXT,
  uom TEXT,
  agent_name TEXT,
  agent_number TEXT,
  terminal_sheds TEXT,
  exporter_name TEXT,
  period_date DATE NOT NULL,  -- Partitioning column
  quantity NUMERIC,
  value_usd NUMERIC,
  uploaded_file_id BIGINT NOT NULL REFERENCES uploaded_file(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id, period_date)  -- Ensures row-level uniqueness across partitions
) PARTITION BY RANGE (period_date);

-- Optional but recommended: Auto-create partitions on INSERT
CREATE OR REPLACE FUNCTION ensure_trade_fact_partition_for_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM ensure_trade_fact_partition(NEW.period_date);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_trade_fact_partition ON trade_fact;
CREATE TRIGGER trg_ensure_trade_fact_partition
  BEFORE INSERT ON trade_fact
  FOR EACH ROW
  EXECUTE FUNCTION ensure_trade_fact_partition_for_insert();

-- Partition management function 
CREATE OR REPLACE FUNCTION ensure_trade_fact_partition(p_date DATE) RETURNS void AS $$
DECLARE
  start_month DATE := date_trunc('month', p_date)::date;
  end_month   DATE := (start_month + INTERVAL '1 month')::date;
  part_name   TEXT := format('trade_fact_%s', to_char(start_month, 'YYYY_MM'));
  exists_part BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = part_name AND n.nspname = 'public'
  ) INTO exists_part;

  IF NOT exists_part THEN
    EXECUTE format('CREATE TABLE %I PARTITION OF trade_fact FOR VALUES FROM (%L) TO (%L);', 
                   part_name, start_month, end_month);
    EXECUTE format('CREATE INDEX %I_company_period_idx ON %I (company_id, period_date);', 
                   part_name, part_name);
    EXECUTE format('CREATE INDEX %I_trade_type_idx ON %I (trade_type);', 
                   part_name, part_name);
    EXECUTE format('CREATE INDEX %I_origin_country_idx ON %I (origin_country_id);', 
                   part_name, part_name);
    EXECUTE format('CREATE INDEX %I_hs_code_idx ON %I (hs_code);', 
                   part_name, part_name);
    EXECUTE format('CREATE INDEX %I_item_name_trgm_idx ON %I USING GIN (item_name gin_trgm_ops);', 
                   part_name, part_name);
  END IF;
END;
$$ LANGUAGE plpgsql;