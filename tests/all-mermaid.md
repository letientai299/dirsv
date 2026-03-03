# Mermaid Diagram Gallery

A comprehensive test of every Mermaid diagram type. Used to verify the renderer
handles all supported diagrams correctly.

---

## 1. Flowchart

```mermaid
flowchart TD
    start([Request Received])
    auth{Authenticated?}
    ratelimit{Rate Limit OK?}
    process[Process Request]
    cache[(Cache DB)]
    respond(Return Response)
    err403[403 Forbidden]
    err429[429 Too Many Requests]

    start --> auth
    auth -->|Yes| ratelimit
    auth -->|No| err403
    ratelimit -->|Yes| process
    ratelimit -->|No| err429
    process --> cache
    cache --> respond

    subgraph infra[Infrastructure]
        cache
    end
```

## 2. Sequence Diagram

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant AuthSvc
    participant DB

    User->>+Browser: Submit login form
    Browser->>+AuthSvc: POST /auth (credentials)
    AuthSvc->>+DB: SELECT user WHERE email=?
    DB-->>-AuthSvc: user row

    alt Invalid credentials
        AuthSvc-->>Browser: 401 Unauthorized
        Browser-->>User: Show error message
    else Valid credentials
        AuthSvc->>AuthSvc: Sign JWT
        AuthSvc-->>-Browser: 200 OK + token
        Note over Browser: Store token in httpOnly cookie
        Browser-->>-User: Redirect to dashboard
    end
```

## 3. Class Diagram

```mermaid
classDiagram
    class Repository~T~ {
        <<interface>>
        +findById(id: UUID) T
        +save(entity: T) T
        +delete(id: UUID) void
    }
    class UserRepository {
        -db: Database
        +findById(id: UUID) User
        +findByEmail(email: string) User
        +save(user: User) User
        +delete(id: UUID) void
    }
    class User {
        +id: UUID
        +email: string
        -passwordHash: string
        +verifyPassword(plain: string) bool
        +toPublicDTO() UserDTO
    }
    class UserDTO {
        +id: UUID
        +email: string
    }

    Repository~T~ <|.. UserRepository : implements
    UserRepository --> User : manages
    User ..> UserDTO : creates
```

## 4. State Diagram

```mermaid
stateDiagram-v2
    [*] --> Idle

    state OrderLifecycle {
        Idle --> Pending: submit_order
        Pending --> Processing: payment_confirmed

        state Processing {
            [*] --> Picking
            Picking --> Packing: items_picked
            Packing --> Shipped: dispatched
            Shipped --> [*]
        }

        Processing --> Delivered: delivery_confirmed
        Processing --> Cancelled: cancellation_requested
        Pending --> Cancelled: payment_failed
        Delivered --> [*]
        Cancelled --> [*]
    }

    note right of Processing
        Warehouse sub-states
    end note
```

## 5. Entity Relationship Diagram

```mermaid
erDiagram
    TENANT ||--o{ USER : "has"
    TENANT ||--o{ PROJECT : "owns"
    USER ||--o{ PROJECT_MEMBER : "participates in"
    PROJECT ||--o{ PROJECT_MEMBER : "has"
    PROJECT ||--o{ ISSUE : "contains"
    USER ||--o{ ISSUE : "assigned to"

    TENANT { uuid id PK; string slug UK; string plan }
    USER { uuid id PK; uuid tenant_id FK; string email UK; string role }
    PROJECT { uuid id PK; uuid tenant_id FK; string name; string status }
    ISSUE { uuid id PK; uuid project_id FK; uuid assignee_id FK; string priority; string status }
```

## 6. User Journey

```mermaid
journey
    title Customer Support Flow
    section Self-Service
      Search knowledge base: 4: Customer
      Read article: 3: Customer
      Attempt fix: 3: Customer
    section Live Support
      Open chat: 4: Customer
      Wait for agent: 2: Customer
      Agent diagnoses: 4: Agent
      Implement fix: 4: Agent, System
    section Resolution
      Confirm resolution: 5: Customer
      Rate interaction: 4: Customer
      Close ticket: 5: System
```

## 7. Gantt Chart

```mermaid
gantt
    title API v2 Release Plan
    dateFormat YYYY-MM-DD
    excludes weekends

    section Discovery
    Stakeholder interviews :done, interviews, 2024-01-08, 5d
    API contract draft     :done, contract, after interviews, 4d

    section Development
    Auth endpoints         :done, auth, after contract, 7d
    Core CRUD endpoints    :active, crud, after auth, 10d
    Rate limiting          :crit, ratelimit, after auth, 5d
    Webhook system         :webhooks, after crud, 6d

    section Quality
    Integration tests      :crit, tests, after webhooks ratelimit, 5d
    Security audit         :crit, audit, after tests, 5d

    section Release
    GA release             :milestone, after audit, 0d
```

## 8. Pie Chart

```mermaid
pie showData title Error Budget Consumption (Last 30 Days)
    "Successful requests" : 99210
    "5xx Server errors"   : 312
    "4xx Client errors"   : 428
    "Timeouts"            : 50
```

## 9. Quadrant Chart

```mermaid
quadrantChart
    title Feature Prioritization Matrix
    x-axis Low Implementation Effort --> High Implementation Effort
    y-axis Low Business Value --> High Business Value
    quadrant-1 Quick Wins
    quadrant-2 Major Bets
    quadrant-3 Low Priority
    quadrant-4 Reconsider
    SSO Integration: [0.25, 0.90]
    Audit Logging: [0.35, 0.75]
    AI Suggestions: [0.85, 0.88]
    CSV Export: [0.30, 0.55]
    Mobile App: [0.90, 0.70]
    Dark Mode: [0.20, 0.40]
    Custom Reports: [0.75, 0.45]
```

## 10. Requirement Diagram

```mermaid
requirementDiagram

    functionalRequirement data_isolation {
        id: FR-101
        text: Each tenant's data must be logically isolated
        risk: High
        verifymethod: Test
    }

    performanceRequirement query_latency {
        id: NFR-201
        text: 95th-percentile query latency under 100ms at 1000 rps
        risk: Medium
        verifymethod: Test
    }

    element tenant_middleware {
        type: Middleware Component
        docref: docs/arch/tenancy.md
    }

    element query_optimizer {
        type: Database Layer
        docref: docs/arch/db.md
    }

    data_isolation - satisfies -> tenant_middleware
    query_latency - satisfies -> query_optimizer
    query_latency - derives -> data_isolation
```

## 11. Git Graph

```mermaid
gitgraph LR
    commit id: "init" tag: "v1.0.0"
    commit id: "chore: ci setup"

    branch develop
    checkout develop
    commit id: "feat: user auth"
    commit id: "feat: JWT refresh"

    branch feature/payments
    checkout feature/payments
    commit id: "feat: Stripe integration"
    commit id: "test: payment flows"

    checkout develop
    merge feature/payments id: "merge payments"

    checkout main
    branch hotfix/xss
    commit id: "fix: sanitize output" type: HIGHLIGHT
    checkout main
    merge hotfix/xss tag: "v1.0.1"

    checkout develop
    cherry-pick id: "fix: sanitize output"
    commit id: "feat: invoice PDF"
    checkout main
    merge develop tag: "v2.0.0"
```

## 12. C4 Container Diagram

```mermaid
C4Container
    Person(user, "End User", "Accesses the platform via browser")

    System_Boundary(platform, "SaaS Platform") {
        Container(spa, "Single Page App", "React + TypeScript", "User-facing UI")
        Container(api, "API Gateway", "Node.js / Express", "Routes requests, enforces auth")
        Container(worker, "Background Worker", "BullMQ", "Async job processing")
        ContainerDb(pg, "PostgreSQL", "Primary datastore", "Relational data")
        ContainerDb(redis, "Redis", "Cache + job queue", "Fast ephemeral state")
    }

    System_Ext(smtp, "SendGrid", "Transactional email delivery")
    System_Ext(s3, "AWS S3", "Object storage for uploads")

    Rel(user, spa, "Uses", "HTTPS")
    Rel(spa, api, "Calls", "REST / HTTPS")
    Rel(api, pg, "Reads/writes", "SQL")
    Rel(api, redis, "Caches", "Redis protocol")
    Rel(api, worker, "Enqueues jobs", "BullMQ")
    Rel(worker, smtp, "Sends email via")
    Rel(worker, s3, "Uploads files to")
```

## 13. Mindmap

```mermaid
mindmap
  root((System Design))
    Scalability
      Horizontal scaling
      Load balancing
        Round-robin
        Least connections
      Caching
        CDN
        Redis
    Reliability
      Redundancy
      Health checks
      Circuit breakers
    Data
      SQL
        PostgreSQL
        MySQL
      NoSQL
        MongoDB
        DynamoDB
    Observability
      Metrics
      Logging
      Tracing
```

## 14. Timeline

```mermaid
timeline
    title Evolution of JavaScript Runtimes
    section Browser Era
        1995 : Netscape introduces JavaScript
        2008 : V8 engine released by Google
    section Server Era
        2009 : Node.js created by Ryan Dahl
        2010 : npm registry launched
        2016 : Yarn released
    section Modern Runtimes
        2018 : Deno announced
        2021 : Bun development begins
        2022 : Deno 1.0 stable : Bun 0.1 released
        2023 : Bun 1.0 released : Deno 2.0 announced
```

## 15. ZenUML

```mermaid
zenuml
    title Checkout Flow
    @Actor Client
    @Boundary PaymentAPI
    @Entity OrderSvc
    @Database DB

    Client -> PaymentAPI: POST /checkout(cart, token)
    PaymentAPI -> OrderSvc: createOrder(cart)
    OrderSvc -> DB: INSERT order
    DB --> OrderSvc: orderId
    OrderSvc --> PaymentAPI: orderId

    if (token valid) {
        PaymentAPI -> PaymentAPI: chargeCard(token, amount)
        PaymentAPI -> OrderSvc: confirmOrder(orderId)
        PaymentAPI --> Client: 200 OK {orderId}
    } else {
        PaymentAPI -> OrderSvc: cancelOrder(orderId)
        PaymentAPI --> Client: 402 Payment Required
    }
```

## 16. Sankey Diagram

```mermaid
sankey-beta
Renewables,Grid,450
Nuclear,Grid,200
Natural Gas,Grid,180
Grid,Residential,280
Grid,Industrial,320
Grid,Commercial,180
Grid,Transmission Loss,50
Residential,Heating,110
Residential,Appliances,95
Residential,Lighting,75
Industrial,Manufacturing,200
Industrial,HVAC,120
```

## 17. XY Chart

```mermaid
xychart-beta
    title "API Latency vs Throughput (Last 7 Days)"
    x-axis [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    y-axis "p95 Latency (ms)" 0 --> 300
    line [145, 162, 138, 201, 189, 95, 88]
    bar [210, 225, 198, 242, 237, 110, 95]
```

## 18. Block Diagram

```mermaid
block-beta
    columns 3

    Client["Browser / Mobile"]:1  space:1  CDN["CDN Edge"]:1
    space:3
    LB["Load Balancer"]:1  space:1  WAF["WAF"]:1
    space:3
    API1["API Server 1"]:1  API2["API Server 2"]:1  API3["API Server 3"]:1
    space:3
    DB[("Primary DB")]:1  Cache[("Redis")]:1  Queue[("Message Queue")]:1

    Client --> CDN
    CDN --> WAF
    WAF --> LB
    LB --> API1
    LB --> API2
    LB --> API3
    API1 --> DB
    API2 --> Cache
    API3 --> Queue
```

## 19. Packet Diagram

```mermaid
packet-beta
    0-3: "Version"
    4-7: "IHL"
    8-15: "DSCP / ECN"
    16-31: "Total Length"
    32-47: "Identification"
    48-50: "Flags"
    51-63: "Fragment Offset"
    64-71: "TTL"
    72-79: "Protocol"
    80-95: "Header Checksum"
    96-127: "Source IP Address"
    128-159: "Destination IP Address"
    160-191: "Options (if IHL > 5)"
```

## 20. Kanban

```mermaid
kanban
    backlog[Backlog]
        t1[Implement OAuth2 PKCE flow]@{ ticket: ENG-201, priority: High }
        t2[Add rate limiting middleware]@{ ticket: ENG-198, priority: High }
        t3[Migrate to Postgres 16]@{ ticket: ENG-185, priority: Low }

    inprogress[In Progress]
        t4[Refactor auth service]@{ assigned: alice, ticket: ENG-194 }
        t5[Write OpenAPI spec]@{ assigned: bob, ticket: ENG-196 }

    review[In Review]
        t6[Add request tracing]@{ assigned: carol, ticket: ENG-190 }

    done[Done]
        t7[Set up CI pipeline]@{ ticket: ENG-180 }
```

## 21. Architecture Diagram

```mermaid
architecture-beta
    group vpc(cloud)[AWS VPC]
    group public_subnet(internet)[Public Subnet] in vpc
    group private_subnet(server)[Private Subnet] in vpc

    service igw(internet)[Internet Gateway] in public_subnet
    service alb(server)[Application Load Balancer] in public_subnet
    service api1(server)[API Server 1] in private_subnet
    service api2(server)[API Server 2] in private_subnet
    service rds(database)[RDS PostgreSQL] in private_subnet
    service cache(disk)[ElastiCache Redis] in private_subnet
    service users(internet)[Users]

    users:R --> L:igw
    igw:R --> L:alb
    alb:B --> T:api1
    alb:B --> T:api2
    api1:R --> L:rds
    api2:R --> L:rds
    api1:B --> T:cache
    api2:B --> T:cache
```

## 22. Radar Chart

```mermaid
radar-beta
    title Engineering Candidate Evaluation
    axis SystemDesign["System Design"], Algorithms["Algorithms"], Coding["Coding"], Communication["Communication"], Ownership["Ownership"]
    curve candidate_a["Candidate A"]{8, 6, 9, 7, 8}
    curve candidate_b["Candidate B"]{6, 9, 7, 8, 6}
    curve candidate_c["Candidate C"]{9, 7, 8, 9, 9}
    showLegend true
    max 10
    graticule polygon
    ticks 5
```

## 23. Treemap

```mermaid
treemap-beta
    "JavaScript Ecosystem Bundle"
        "React"
            "react": 7
            "react-dom": 130
            "react-router": 25
        "State Management"
            "zustand": 8
            "immer": 14
        "UI Components"
            "radix-ui": 45
            "tailwind-merge": 4
        "Utilities"
            "date-fns": 72
            "zod": 18
            "axios": 20
```
