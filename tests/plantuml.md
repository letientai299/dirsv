# PlantUML Diagram Gallery

A showcase of all diagram types supported by PlantUML, rendered via the public
server.

## Sequence Diagram

```plantuml
@startuml
actor User
participant "Auth Service" as Auth
database "User DB" as DB

User -> Auth: Login(username, password)
Auth -> DB: SELECT * FROM users
DB --> Auth: user record
Auth --> User: JWT token

User -> Auth: Request with JWT
Auth -> Auth: Validate token
Auth --> User: 200 OK
@enduml
```

## Use Case Diagram

```plantuml
@startuml
left to right direction
actor Customer
actor Admin

rectangle "Online Store" {
  Customer -- (Browse Products)
  Customer -- (Place Order)
  Customer -- (Track Order)
  Admin -- (Manage Inventory)
  Admin -- (Process Refund)
  (Place Order) .> (Send Confirmation) : <<include>>
}
@enduml
```

## Class Diagram

```plantuml
@startuml
abstract class Animal {
  +name: String
  +age: int
  +makeSound(): void
}

class Dog extends Animal {
  +breed: String
  +fetch(): void
}

class Cat extends Animal {
  +indoor: boolean
  +purr(): void
}

interface Trainable {
  +train(command: String): boolean
}

Dog ..|> Trainable
@enduml
```

## Object Diagram

```plantuml
@startuml
object Server {
  hostname = "web-01"
  ip = "10.0.1.5"
  status = "running"
}

object Database {
  engine = "PostgreSQL"
  version = "16.2"
  port = 5432
}

Server --> Database : connects to
@enduml
```

## Activity Diagram

```plantuml
@startuml
start
:Receive HTTP request;
if (Authenticated?) then (yes)
  if (Authorized?) then (yes)
    :Process request;
    :Return 200 OK;
  else (no)
    :Return 403 Forbidden;
  endif
else (no)
  :Return 401 Unauthorized;
endif
stop
@enduml
```

## Component Diagram

```plantuml
@startuml
package "Frontend" {
  [React App] as app
  [API Client] as client
}

package "Backend" {
  [REST API] as api
  [Auth Middleware] as auth
  [Business Logic] as logic
}

database "PostgreSQL" as db

app --> client
client --> api : HTTPS
api --> auth
api --> logic
logic --> db
@enduml
```

## Deployment Diagram

```plantuml
@startuml
node "Load Balancer" as lb
node "Web Server 1" as web1
node "Web Server 2" as web2
database "Primary DB" as primary
database "Replica DB" as replica

lb --> web1
lb --> web2
web1 --> primary
web2 --> primary
primary --> replica : replication
@enduml
```

## State Diagram

```plantuml
@startuml
[*] --> Draft
Draft --> Review : submit
Review --> Approved : approve
Review --> Draft : request changes
Approved --> Published : publish
Published --> Archived : archive
Archived --> [*]

state Review {
  [*] --> Pending
  Pending --> InReview : assign reviewer
  InReview --> [*]
}
@enduml
```

## Timing Diagram

```plantuml
@startuml
robust "Web Browser" as WB
concise "Web User" as WU

@0
WB is Initializing
WU is Absent

@100
WB is Processing

@300
WB is Waiting
WU is ok
@enduml
```

## Entity Relationship (IE Notation)

```plantuml
@startuml
entity "User" {
  *user_id : bigint <<PK>>
  --
  *email : varchar
  name : varchar
  created_at : timestamp
}

entity "Post" {
  *post_id : bigint <<PK>>
  --
  *user_id : bigint <<FK>>
  title : varchar
  body : text
  published : boolean
}

entity "Comment" {
  *comment_id : bigint <<PK>>
  --
  *post_id : bigint <<FK>>
  *user_id : bigint <<FK>>
  body : text
}

User ||--o{ Post
User ||--o{ Comment
Post ||--o{ Comment
@enduml
```

## Gantt Chart

```plantuml
@startgantt
Project starts 2025-01-06
[Requirements] requires 10 days
[Design] requires 15 days
[Design] starts at [Requirements]'s end
[Backend Dev] requires 30 days
[Backend Dev] starts at [Design]'s end
[Frontend Dev] requires 25 days
[Frontend Dev] starts at [Design]'s end
[Testing] requires 15 days
[Testing] starts at [Backend Dev]'s end
[Deployment] requires 5 days
[Deployment] starts at [Testing]'s end
@endgantt
```

## Mind Map

```plantuml
@startmindmap
* System Design
** Frontend
*** React
*** TypeScript
*** Vite
** Backend
*** Go
*** REST API
*** gRPC
** Infrastructure
*** Docker
*** Kubernetes
*** Terraform
** Observability
*** Prometheus
*** Grafana
*** OpenTelemetry
@endmindmap
```

## Work Breakdown Structure (WBS)

```plantuml
@startwbs
* Product Launch
** Planning
*** Market Research
*** Competitor Analysis
*** Define Requirements
** Development
*** Backend Services
*** Frontend App
*** API Integration
** Testing
*** Unit Tests
*** Integration Tests
*** UAT
** Release
*** Staging Deploy
*** Production Deploy
*** Monitoring Setup
@endwbs
```

## Network Diagram (nwdiag)

```plantuml
@startnwdiag
network internet {
  address = "203.0.113.0/24"
  web01 [address = "203.0.113.1"]
  web02 [address = "203.0.113.2"]
}

network dmz {
  address = "172.16.0.0/24"
  web01 [address = "172.16.0.1"]
  web02 [address = "172.16.0.2"]
  lb [address = "172.16.0.10"]
}

network internal {
  address = "10.0.0.0/8"
  lb [address = "10.0.0.1"]
  db01 [address = "10.0.0.100"]
  db02 [address = "10.0.0.101"]
}
@endnwdiag
```

## Wireframe (Salt)

```plantuml
@startsalt
{+
  {* File | Edit | View | Help }
  {
    Name     | "John Doe        "
    Email    | "john@example.com "
    Role     | ^Admin^
    --
    [Cancel] | [  Save  ]
  }
}
@endsalt
```

## JSON Visualization

```plantuml
@startjson
{
  "name": "dirsv",
  "version": "0.1.0",
  "features": {
    "markdown": true,
    "mermaid": true,
    "plantuml": true,
    "katex": true
  },
  "stack": ["Go", "Preact", "Vite"],
  "license": "MIT"
}
@endjson
```

## YAML Visualization

```plantuml
@startyaml
service:
  name: api-gateway
  port: 8080
  replicas: 3
  env:
    - name: DATABASE_URL
      value: postgres://db:5432/app
    - name: LOG_LEVEL
      value: info
  healthCheck:
    path: /healthz
    interval: 30s
@endyaml
```

## EBNF Diagram

```plantuml
@startebnf
expression = term , { ("+" | "-") , term } ;
term = factor , { ("*" | "/") , factor } ;
factor = number | "(" , expression , ")" ;
number = digit , { digit } ;
digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" ;
@endebnf
```

## Regex Visualization

```plantuml
@startregex
^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$
@endregex
```
