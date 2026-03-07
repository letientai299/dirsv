# DBML Diagrams

A comprehensive test of DBML diagram features. Used to verify the renderer
handles all supported syntax correctly.

## 1. Tables, Columns, and References

Column settings (`pk`, `not null`, `unique`, `default`, `increment`, `note`),
inline refs, standalone refs (all cardinalities), and aliases.

```dbml
Table users as U {
  id integer [pk, increment]
  username varchar(255) [unique, not null]
  email varchar(255) [unique, not null, note: 'Must be verified']
  role varchar(20) [not null, default: 'viewer']
  is_active boolean [not null, default: true]
  created_at timestamp [default: `now()`]
  updated_at timestamp
}

Table profiles {
  id integer [pk, increment]
  user_id integer [not null, ref: - U.id]
  bio text
  avatar_url varchar(512)
}

Table posts {
  id integer [pk, increment]
  author_id integer [not null]
  title varchar(255) [not null]
  body text
  status varchar(20) [not null, default: 'draft']
  view_count integer [default: 0]
  published_at timestamp [null]
  created_at timestamp [default: `now()`]
}

Table comments {
  id integer [pk, increment]
  post_id integer [not null]
  user_id integer [not null]
  parent_id integer [null, note: 'Self-ref for threaded comments']
  body text [not null]
  created_at timestamp [default: `now()`]
}

Table tags {
  id integer [pk, increment]
  name varchar(100) [unique, not null]
}

Table post_tags {
  post_id integer [not null]
  tag_id integer [not null]

  indexes {
    (post_id, tag_id) [pk]
  }
}

// Standalone refs — all cardinalities
Ref: posts.author_id > U.id          // many-to-one
Ref: comments.post_id > posts.id     // many-to-one
Ref: comments.user_id > U.id         // many-to-one
Ref: comments.parent_id > comments.id // self-referencing
Ref: post_tags.post_id > posts.id
Ref: post_tags.tag_id > tags.id
```

## 2. Indexes and Enums

Composite indexes, expression indexes, btree/hash types, and enums with notes.

```dbml
Enum order_status {
  pending [note: 'Order placed, awaiting payment']
  processing
  shipped
  delivered
  cancelled
  refunded [note: 'Full or partial refund issued']
}

Enum payment_method {
  credit_card
  debit_card
  paypal
  bank_transfer
  crypto
}

Table orders {
  id integer [pk, increment]
  user_id integer [not null]
  status order_status [not null, default: 'pending']
  payment payment_method [not null]
  subtotal_cents integer [not null]
  tax_cents integer [not null, default: 0]
  total_cents integer [not null]
  shipping_address_id integer
  notes text
  placed_at timestamp [default: `now()`]
  shipped_at timestamp [null]
  delivered_at timestamp [null]

  indexes {
    user_id [name: 'idx_orders_user']
    status [name: 'idx_orders_status']
    (user_id, status) [name: 'idx_orders_user_status']
    placed_at [type: btree]
  }

  Note: 'Core orders table. Amounts stored in cents to avoid floating point.'
}

Table order_items {
  id integer [pk, increment]
  order_id integer [not null]
  product_id integer [not null]
  quantity integer [not null, default: 1]
  unit_price_cents integer [not null]
  discount_cents integer [default: 0]

  indexes {
    (order_id, product_id) [unique]
  }
}

Table products {
  id integer [pk, increment]
  sku varchar(50) [unique, not null]
  name varchar(255) [not null]
  description text
  price_cents integer [not null]
  stock_count integer [not null, default: 0]
  category_id integer
  is_active boolean [default: true]
  created_at timestamp [default: `now()`]

  indexes {
    sku [type: hash]
    category_id
    (is_active, category_id) [name: 'idx_products_active_cat']
  }
}

Table categories {
  id integer [pk, increment]
  name varchar(100) [not null]
  parent_id integer [null]
  sort_order integer [default: 0]
}

Ref: order_items.order_id > orders.id
Ref: order_items.product_id > products.id
Ref: products.category_id > categories.id
Ref: categories.parent_id > categories.id
```

## Stress Tests

### S1. Multi-Tenant SaaS Platform

Dense schema with 12 tables, enums, indexes, table notes, column notes,
self-references, composite keys, and all ref cardinalities.

```dbml
// === Auth & Identity ===

Enum tenant_plan {
  free
  team
  enterprise
}

Enum user_role {
  owner
  admin
  member
  viewer
}

Table tenants {
  id uuid [pk, not null]
  slug varchar(63) [unique, not null, note: 'URL-safe identifier']
  name varchar(255) [not null]
  plan tenant_plan [not null, default: 'free']
  feature_flags jsonb [default: '{}']
  max_seats integer [not null, default: 5]
  created_at timestamptz [default: `now()`]
  suspended_at timestamptz [null, note: 'Non-null = suspended']

  indexes {
    slug [type: hash]
  }

  Note: 'Root entity for multi-tenancy. All data is scoped by tenant.'
}

Table users {
  id uuid [pk, not null]
  tenant_id uuid [not null]
  email varchar(255) [not null]
  password_hash text [not null, note: 'argon2id']
  role user_role [not null, default: 'member']
  mfa_secret text [null]
  last_login_ip inet [null]
  last_login_at timestamptz [null]
  created_at timestamptz [default: `now()`]

  indexes {
    (tenant_id, email) [unique, name: 'uq_users_tenant_email']
    tenant_id
    last_login_at [type: btree]
  }
}

Table sessions {
  id uuid [pk, not null]
  user_id uuid [not null]
  token_hash text [unique, not null]
  ip_address inet
  user_agent text
  expires_at timestamptz [not null]
  created_at timestamptz [default: `now()`]

  indexes {
    user_id
    expires_at [type: btree]
  }
}

Table api_keys {
  id uuid [pk, not null]
  user_id uuid [not null]
  tenant_id uuid [not null]
  key_prefix varchar(8) [unique, not null, note: 'First 8 chars for lookup']
  key_hash text [not null]
  scopes text [not null, default: 'read']
  expires_at timestamptz [null]
  last_used_at timestamptz [null]
  created_at timestamptz [default: `now()`]

  indexes {
    key_prefix [type: hash]
    (user_id, tenant_id)
  }
}

// === Projects & Resources ===

Enum project_status {
  active
  archived
  deleted
}

Table projects {
  id uuid [pk, not null]
  tenant_id uuid [not null]
  name varchar(255) [not null]
  status project_status [not null, default: 'active']
  config jsonb [default: '{}']
  created_by uuid [not null]
  created_at timestamptz [default: `now()`]

  indexes {
    (tenant_id, name) [unique]
    (tenant_id, status)
  }
}

Table environments {
  id uuid [pk, not null]
  project_id uuid [not null]
  name varchar(50) [not null, note: 'dev / staging / prod']
  region varchar(50) [not null]
  auto_deploy boolean [not null, default: false]
  locked boolean [not null, default: false]

  indexes {
    (project_id, name) [unique]
  }
}

Enum deploy_status {
  pending
  building
  deploying
  success
  failed
  rolled_back
}

Table deployments {
  id uuid [pk, not null]
  env_id uuid [not null]
  triggered_by uuid [not null]
  git_sha varchar(40) [not null]
  git_branch varchar(255)
  status deploy_status [not null, default: 'pending']
  duration_ms integer [null]
  error_log text [null]
  started_at timestamptz [default: `now()`]
  finished_at timestamptz [null]

  indexes {
    env_id [type: btree]
    (env_id, status) [name: 'idx_deploys_env_status']
    started_at [type: btree]
  }

  Note: 'Immutable deployment records. Never updated after completion.'
}

// === Team Collaboration ===

Table teams {
  id uuid [pk, not null]
  tenant_id uuid [not null]
  name varchar(100) [not null]
  description text

  indexes {
    (tenant_id, name) [unique]
  }
}

Enum team_role {
  lead
  member
}

Table team_members {
  team_id uuid [not null]
  user_id uuid [not null]
  role team_role [not null, default: 'member']
  joined_at timestamptz [default: `now()`]

  indexes {
    (team_id, user_id) [pk]
  }
}

Table addresses {
  id integer [pk, increment]
  user_id uuid [not null]
  line1 varchar(255) [not null]
  line2 varchar(255)
  city varchar(100) [not null]
  state varchar(100)
  postal_code varchar(20) [not null]
  country varchar(2) [not null, note: 'ISO 3166-1 alpha-2']
  is_default boolean [default: false]

  indexes {
    user_id
  }
}

// === Audit ===

Enum audit_action {
  create
  update
  delete
  login
  logout
  deploy
  invite
  revoke
}

Table audit_events {
  id bigint [pk, increment]
  tenant_id uuid [not null]
  actor_id uuid [not null, note: 'user or api_key owner']
  action audit_action [not null]
  resource_type varchar(50) [not null]
  resource_id uuid [not null]
  diff jsonb [null, note: 'before/after snapshot']
  ip_address inet
  created_at timestamptz [default: `now()`]

  indexes {
    (tenant_id, created_at) [type: btree]
    (tenant_id, resource_type, resource_id) [name: 'idx_audit_resource']
    actor_id
  }

  Note: 'Append-only audit log for compliance (SOC 2, GDPR).'
}

// === Relationships ===

// Auth
Ref: users.tenant_id > tenants.id
Ref: sessions.user_id > users.id
Ref: api_keys.user_id > users.id
Ref: api_keys.tenant_id > tenants.id

// Projects
Ref: projects.tenant_id > tenants.id
Ref: projects.created_by > users.id
Ref: environments.project_id > projects.id
Ref: deployments.env_id > environments.id
Ref: deployments.triggered_by > users.id

// Teams
Ref: teams.tenant_id > tenants.id
Ref: team_members.team_id > teams.id
Ref: team_members.user_id > users.id

// Addresses
Ref: addresses.user_id > users.id

// Audit
Ref: audit_events.tenant_id > tenants.id
Ref: audit_events.actor_id > users.id
```
