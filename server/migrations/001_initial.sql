CREATE TABLE IF NOT EXISTS workspaces (id text PRIMARY KEY, name text NOT NULL);
CREATE TABLE IF NOT EXISTS services (workspace_id text NOT NULL REFERENCES workspaces(id), id text NOT NULL, name text NOT NULL, description text NOT NULL DEFAULT '', PRIMARY KEY (workspace_id,id));
CREATE TABLE IF NOT EXISTS incidents (
  workspace_id text NOT NULL REFERENCES workspaces(id), id uuid NOT NULL, fingerprint text NOT NULL,
  title text NOT NULL, service_id text NOT NULL, severity text NOT NULL CHECK (severity IN ('SEV-1','SEV-2','SEV-3')),
  impact text NOT NULL, next_action text NOT NULL DEFAULT '', owner text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('Investigating','Acknowledged','Mitigating','Resolved')),
  version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds', now()),
  PRIMARY KEY(workspace_id,id), FOREIGN KEY(workspace_id,service_id) REFERENCES services(workspace_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_incident_per_fingerprint ON incidents(workspace_id,fingerprint) WHERE status <> 'Resolved';
CREATE INDEX IF NOT EXISTS incident_queue_idx ON incidents(workspace_id,status,updated_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS incident_service_idx ON incidents(workspace_id,service_id,status,updated_at DESC);
CREATE TABLE IF NOT EXISTS incident_events (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, id uuid NOT NULL UNIQUE, workspace_id text NOT NULL,
  incident_id uuid NOT NULL, kind text NOT NULL, actor text NOT NULL, body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(workspace_id,incident_id) REFERENCES incidents(workspace_id,id)
);
CREATE INDEX IF NOT EXISTS incident_timeline_idx ON incident_events(workspace_id,incident_id,seq);
CREATE TABLE IF NOT EXISTS alert_deliveries (
  workspace_id text NOT NULL REFERENCES workspaces(id), delivery_id text NOT NULL, payload_hash text NOT NULL,
  incident_id uuid NOT NULL, event_id uuid NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,delivery_id), FOREIGN KEY(workspace_id,incident_id) REFERENCES incidents(workspace_id,id), FOREIGN KEY(event_id) REFERENCES incident_events(id)
);
