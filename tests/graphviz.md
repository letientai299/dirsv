# Graphviz Diagram Gallery

A comprehensive test of Graphviz diagrams rendered via `@hpcc-js/wasm-graphviz`.
Both `graphviz` and `dot` language tags are supported.

## 1. Directed Graph — Microservice Architecture

```graphviz
digraph microservices {
    rankdir=LR
    node [shape=box, style="rounded,filled", fontname="Helvetica", fontsize=11]
    edge [fontname="Helvetica", fontsize=9]

    subgraph cluster_gateway {
        label="API Gateway"
        style=filled
        color="#e8f4fd"
        gateway [label="nginx\nreverse proxy", fillcolor="#4a9eff", fontcolor=white]
    }

    subgraph cluster_services {
        label="Services"
        style=filled
        color="#f0f8e8"

        auth [label="Auth\nService", fillcolor="#7bc47f"]
        users [label="User\nService", fillcolor="#7bc47f"]
        orders [label="Order\nService", fillcolor="#7bc47f"]
        notify [label="Notification\nService", fillcolor="#7bc47f"]
        search [label="Search\nService", fillcolor="#7bc47f"]
    }

    subgraph cluster_data {
        label="Data Layer"
        style=filled
        color="#fef3e0"

        postgres [label="PostgreSQL", shape=cylinder, fillcolor="#336791", fontcolor=white]
        redis [label="Redis", shape=cylinder, fillcolor="#dc382d", fontcolor=white]
        elastic [label="Elasticsearch", shape=cylinder, fillcolor="#fed10a"]
        kafka [label="Kafka", shape=parallelogram, fillcolor="#231f20", fontcolor=white]
    }

    client [label="Client\nApps", shape=ellipse, fillcolor="#f5f5f5"]

    client -> gateway [label="HTTPS"]
    gateway -> auth [label="/auth/*"]
    gateway -> users [label="/users/*"]
    gateway -> orders [label="/orders/*"]
    gateway -> search [label="/search/*"]

    auth -> redis [label="sessions"]
    auth -> postgres [label="credentials"]
    users -> postgres [label="profiles"]
    orders -> postgres [label="transactions"]
    orders -> kafka [label="events"]
    kafka -> notify [label="consume"]
    kafka -> search [label="consume"]
    search -> elastic [label="index"]
    notify -> client [label="push", style=dashed]
}
```

## 2. Undirected Graph — Network Topology

```dot
graph network {
    layout=neato
    overlap=false
    splines=true
    node [shape=circle, style=filled, fontname="Helvetica", fontsize=10]

    // Core routers
    core1 [label="Core\nR1", fillcolor="#ff6b6b", fontcolor=white, width=1.2]
    core2 [label="Core\nR2", fillcolor="#ff6b6b", fontcolor=white, width=1.2]

    // Distribution switches
    dist1 [label="Dist\nSW1", fillcolor="#ffa94d", width=1]
    dist2 [label="Dist\nSW2", fillcolor="#ffa94d", width=1]
    dist3 [label="Dist\nSW3", fillcolor="#ffa94d", width=1]

    // Access switches
    node [shape=box, width=0.8]
    acc1 [label="Acc1", fillcolor="#69db7c"]
    acc2 [label="Acc2", fillcolor="#69db7c"]
    acc3 [label="Acc3", fillcolor="#69db7c"]
    acc4 [label="Acc4", fillcolor="#69db7c"]
    acc5 [label="Acc5", fillcolor="#69db7c"]
    acc6 [label="Acc6", fillcolor="#69db7c"]

    // Redundant core links
    core1 -- core2 [penwidth=3, color="#cc0000", label="10G"]

    // Distribution links
    core1 -- dist1 [penwidth=2]
    core1 -- dist2 [penwidth=2]
    core2 -- dist2 [penwidth=2]
    core2 -- dist3 [penwidth=2]
    dist1 -- dist2 [style=dashed, label="failover"]

    // Access links
    dist1 -- acc1
    dist1 -- acc2
    dist2 -- acc3
    dist2 -- acc4
    dist3 -- acc5
    dist3 -- acc6
}
```

## 3. Record Nodes — Database Schema

```graphviz
digraph schema {
    rankdir=LR
    node [shape=record, fontname="Courier", fontsize=10, style=filled, fillcolor="#f8f9fa"]
    edge [fontname="Helvetica", fontsize=9]

    users [label="{users|id : uuid PK\lname : varchar(255)\lemail : varchar(255) UNIQUE\lpassword_hash : text\lcreated_at : timestamptz\l}"]

    posts [label="{posts|id : uuid PK\lauthor_id : uuid FK\ltitle : varchar(500)\lbody : text\lstatus : enum(draft,published)\lpublished_at : timestamptz\l}"]

    comments [label="{comments|id : uuid PK\lpost_id : uuid FK\lauthor_id : uuid FK\lparent_id : uuid FK NULL\lbody : text\lcreated_at : timestamptz\l}"]

    tags [label="{tags|id : serial PK\lname : varchar(100) UNIQUE\lslug : varchar(100) UNIQUE\l}"]

    post_tags [label="{post_tags|post_id : uuid FK\ltag_id : int FK\l}", fillcolor="#fff3cd"]

    users -> posts [label="1:N", headlabel="*", taillabel="1"]
    users -> comments [label="1:N"]
    posts -> comments [label="1:N"]
    comments -> comments [label="self-ref\n(replies)", style=dashed]
    posts -> post_tags [label="1:N"]
    tags -> post_tags [label="1:N"]
}
```

## 4. State Machine — TCP Connection

```graphviz
digraph tcp {
    node [shape=ellipse, style="rounded,filled", fontname="Helvetica", fontsize=10, fillcolor="#e3f2fd"]
    edge [fontname="Helvetica", fontsize=9]

    CLOSED [fillcolor="#ffcdd2"]
    LISTEN [fillcolor="#c8e6c9"]
    SYN_SENT [fillcolor="#fff9c4"]
    SYN_RCVD [fillcolor="#fff9c4"]
    ESTABLISHED [fillcolor="#c8e6c9", penwidth=2]
    FIN_WAIT_1
    FIN_WAIT_2
    CLOSE_WAIT
    CLOSING
    LAST_ACK
    TIME_WAIT [fillcolor="#e1bee7"]

    CLOSED -> LISTEN [label="passive open"]
    CLOSED -> SYN_SENT [label="active open\nsend SYN"]
    LISTEN -> SYN_RCVD [label="recv SYN\nsend SYN+ACK"]
    SYN_SENT -> SYN_RCVD [label="recv SYN\nsend ACK"]
    SYN_SENT -> ESTABLISHED [label="recv SYN+ACK\nsend ACK"]
    SYN_RCVD -> ESTABLISHED [label="recv ACK"]
    ESTABLISHED -> FIN_WAIT_1 [label="close\nsend FIN"]
    ESTABLISHED -> CLOSE_WAIT [label="recv FIN\nsend ACK"]
    FIN_WAIT_1 -> FIN_WAIT_2 [label="recv ACK"]
    FIN_WAIT_1 -> CLOSING [label="recv FIN\nsend ACK"]
    FIN_WAIT_1 -> TIME_WAIT [label="recv FIN+ACK\nsend ACK"]
    FIN_WAIT_2 -> TIME_WAIT [label="recv FIN\nsend ACK"]
    CLOSING -> TIME_WAIT [label="recv ACK"]
    CLOSE_WAIT -> LAST_ACK [label="close\nsend FIN"]
    LAST_ACK -> CLOSED [label="recv ACK"]
    TIME_WAIT -> CLOSED [label="timeout\n(2MSL)"]
    LISTEN -> CLOSED [label="close", style=dashed]
}
```

## 5. Subgraphs — CI/CD Pipeline

```graphviz
digraph cicd {
    rankdir=LR
    compound=true
    node [shape=box, style="rounded,filled", fontname="Helvetica", fontsize=10]
    edge [fontname="Helvetica", fontsize=9]

    subgraph cluster_build {
        label="Build"
        style="rounded,filled"
        color="#e3f2fd"
        fillcolor="#e3f2fd"

        checkout [label="Checkout", fillcolor="#bbdefb"]
        deps [label="Install\nDeps", fillcolor="#bbdefb"]
        compile [label="Compile", fillcolor="#bbdefb"]
        checkout -> deps -> compile
    }

    subgraph cluster_test {
        label="Test"
        style="rounded,filled"
        color="#e8f5e9"
        fillcolor="#e8f5e9"

        unit [label="Unit\nTests", fillcolor="#c8e6c9"]
        integ [label="Integration\nTests", fillcolor="#c8e6c9"]
        lint [label="Lint &\nFormat", fillcolor="#c8e6c9"]
        unit -> integ [style=invis]
    }

    subgraph cluster_deploy {
        label="Deploy"
        style="rounded,filled"
        color="#fff3e0"
        fillcolor="#fff3e0"

        staging [label="Staging", fillcolor="#ffe0b2"]
        smoke [label="Smoke\nTests", fillcolor="#ffe0b2"]
        prod [label="Production", fillcolor="#ffcc80", penwidth=2]
        staging -> smoke -> prod
    }

    compile -> unit [lhead=cluster_test, label="artifacts"]
    compile -> lint [style=invis]
    integ -> staging [lhead=cluster_deploy, label="promote"]

    // Approval gate
    gate [label="Manual\nApproval", shape=diamond, fillcolor="#f3e5f5"]
    smoke -> gate -> prod [style=invis]
    smoke -> gate [label="request"]
    gate -> prod [label="approved"]
}
```

## 6. Cluster Layout — Compiler Phases

```graphviz
digraph compiler {
    node [shape=box, style="rounded,filled", fontname="Helvetica", fontsize=10]
    edge [fontname="Helvetica", fontsize=9]

    subgraph cluster_frontend {
        label="Frontend"
        style="rounded,filled"
        color="#e8eaf6"
        fillcolor="#e8eaf6"

        source [label="Source\nCode", shape=note, fillcolor=white]
        lexer [label="Lexer\n(Tokenizer)", fillcolor="#c5cae9"]
        parser [label="Parser", fillcolor="#c5cae9"]
        sema [label="Semantic\nAnalysis", fillcolor="#c5cae9"]
        source -> lexer [label="chars"]
        lexer -> parser [label="tokens"]
        parser -> sema [label="AST"]
    }

    subgraph cluster_middle {
        label="Middle End"
        style="rounded,filled"
        color="#e0f2f1"
        fillcolor="#e0f2f1"

        ir_gen [label="IR\nGeneration", fillcolor="#b2dfdb"]
        opt1 [label="Dead Code\nElimination", fillcolor="#b2dfdb"]
        opt2 [label="Constant\nFolding", fillcolor="#b2dfdb"]
        opt3 [label="Loop\nOptimization", fillcolor="#b2dfdb"]
        ir_gen -> opt1 -> opt2 -> opt3
    }

    subgraph cluster_backend {
        label="Backend"
        style="rounded,filled"
        color="#fce4ec"
        fillcolor="#fce4ec"

        isel [label="Instruction\nSelection", fillcolor="#f8bbd0"]
        regalloc [label="Register\nAllocation", fillcolor="#f8bbd0"]
        codegen [label="Code\nGeneration", fillcolor="#f8bbd0"]
        binary [label="Binary", shape=note, fillcolor=white]
        isel -> regalloc -> codegen -> binary
    }

    sema -> ir_gen [label="typed AST", minlen=2]
    opt3 -> isel [label="optimized IR", minlen=2]
}
```

## 7. HTML Labels — Rich Node Content

```graphviz
digraph html_labels {
    node [shape=plaintext]

    server [label=<
        <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="6">
            <TR><TD COLSPAN="2" BGCOLOR="#4a9eff"><FONT COLOR="white"><B>Web Server</B></FONT></TD></TR>
            <TR><TD PORT="http">HTTP :80</TD><TD PORT="https">HTTPS :443</TD></TR>
            <TR><TD COLSPAN="2">nginx 1.25</TD></TR>
        </TABLE>
    >]

    app [label=<
        <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="6">
            <TR><TD COLSPAN="2" BGCOLOR="#7bc47f"><B>Application</B></TD></TR>
            <TR><TD PORT="api">REST API</TD><TD PORT="ws">WebSocket</TD></TR>
            <TR><TD PORT="grpc" COLSPAN="2">gRPC :9090</TD></TR>
        </TABLE>
    >]

    db [label=<
        <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="6">
            <TR><TD BGCOLOR="#336791"><FONT COLOR="white"><B>PostgreSQL</B></FONT></TD></TR>
            <TR><TD PORT="rw">Primary :5432</TD></TR>
            <TR><TD PORT="ro">Replica :5433</TD></TR>
        </TABLE>
    >]

    cache [label=<
        <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="6">
            <TR><TD BGCOLOR="#dc382d"><FONT COLOR="white"><B>Redis</B></FONT></TD></TR>
            <TR><TD PORT="p">Port :6379</TD></TR>
        </TABLE>
    >]

    server:https -> app:api [label="reverse proxy"]
    server:https -> app:ws [label="upgrade"]
    app:grpc -> db:rw [label="read/write"]
    app:api -> db:ro [label="read-only", style=dashed]
    app:api -> cache:p [label="cache"]
}
```

## 8. Dot Language Tag

The `dot` language tag also works:

```dot
digraph G {
    rankdir=TB
    node [fontname="Helvetica"]
    a [label="This uses"]
    b [label="the dot tag"]
    c [label="instead of graphviz"]
    a -> b -> c
}
```

---

## Stress Tests — Advanced Features

### S1. Event-Driven Architecture — Dense Graph with Ports and Styling

HTML labels with ports, `concentrate`, mixed edge styles, subgraph nesting
(3 levels), `rank=same`, weighted edges, and 30+ nodes.

```graphviz
digraph event_arch {
    rankdir=TB
    concentrate=true
    compound=true
    splines=ortho
    nodesep=0.6
    ranksep=0.8
    node [shape=box, style="rounded,filled", fontname="Helvetica", fontsize=10]
    edge [fontname="Helvetica", fontsize=8]

    // --- Clients ---
    subgraph cluster_clients {
        label="Clients"
        style="rounded,filled"
        color="#E2E8F0"
        fillcolor="#F7FAFC"

        web [label="Web App\n(React)", fillcolor="#63B3ED"]
        mobile [label="Mobile App\n(Flutter)", fillcolor="#63B3ED"]
        cli [label="CLI Tool", fillcolor="#63B3ED"]
    }

    // --- Edge ---
    subgraph cluster_edge {
        label="Edge Layer"
        style="rounded,filled"
        color="#C6F6D5"
        fillcolor="#F0FFF4"

        cdn [label="CDN\n(CloudFlare)", shape=hexagon, fillcolor="#68D391"]
        waf [label="WAF", fillcolor="#68D391"]
        lb [label="Load Balancer\n(HAProxy)", fillcolor="#68D391"]

        cdn -> waf -> lb
    }

    // --- API ---
    subgraph cluster_api {
        label="API Gateway"
        style="rounded,filled"
        color="#BEE3F8"
        fillcolor="#EBF8FF"

        gw [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4">
                <TR><TD COLSPAN="3" BGCOLOR="#3182CE"><FONT COLOR="white"><B>API Gateway</B></FONT></TD></TR>
                <TR><TD PORT="rest">REST</TD><TD PORT="graphql">GraphQL</TD><TD PORT="ws">WebSocket</TD></TR>
                <TR><TD COLSPAN="3">Rate Limit | Auth | Logging</TD></TR>
            </TABLE>
        >, shape=plaintext]
    }

    // --- Services ---
    subgraph cluster_services {
        label="Domain Services"
        style="rounded,filled"
        color="#FEFCBF"
        fillcolor="#FFFFF0"

        subgraph cluster_ordering {
            label="Order Context"
            style="rounded,filled"
            color="#FED7AA"
            fillcolor="#FFFAF0"

            order_cmd [label="Order\nCommand", fillcolor="#FEEBC8"]
            order_query [label="Order\nQuery", fillcolor="#FEEBC8"]
            pricing [label="Pricing\nEngine", fillcolor="#FEEBC8"]
            order_saga [label="Order\nSaga", fillcolor="#FBD38D"]
        }

        subgraph cluster_payment {
            label="Payment Context"
            style="rounded,filled"
            color="#FED7D7"
            fillcolor="#FFF5F5"

            pay_cmd [label="Payment\nCommand", fillcolor="#FEB2B2"]
            pay_webhook [label="Webhook\nHandler", fillcolor="#FEB2B2"]
            refund [label="Refund\nService", fillcolor="#FEB2B2"]
        }

        subgraph cluster_inventory {
            label="Inventory Context"
            style="rounded,filled"
            color="#C6F6D5"
            fillcolor="#F0FFF4"

            stock [label="Stock\nManager", fillcolor="#9AE6B4"]
            reservation [label="Reservation\nEngine", fillcolor="#9AE6B4"]
            warehouse [label="Warehouse\nSync", fillcolor="#9AE6B4"]
        }

        subgraph cluster_notify {
            label="Notification Context"
            style="rounded,filled"
            color="#E9D8FD"
            fillcolor="#FAF5FF"

            router [label="Notification\nRouter", fillcolor="#D6BCFA"]
            email_svc [label="Email", fillcolor="#D6BCFA"]
            push_svc [label="Push", fillcolor="#D6BCFA"]
            sms_svc [label="SMS", fillcolor="#D6BCFA"]

            router -> email_svc
            router -> push_svc
            router -> sms_svc
        }
    }

    // --- Infrastructure ---
    subgraph cluster_infra {
        label="Infrastructure"
        style="rounded,filled"
        color="#E2E8F0"
        fillcolor="#F7FAFC"

        subgraph cluster_data {
            label="Data Stores"
            color="#FEFCBF"
            style="rounded,filled"
            fillcolor="#FFFFF0"

            orders_db [label="Orders\nDB", shape=cylinder, fillcolor="#D69E2E", fontcolor=white]
            payments_db [label="Payments\nDB", shape=cylinder, fillcolor="#D69E2E", fontcolor=white]
            inventory_db [label="Inventory\nDB", shape=cylinder, fillcolor="#D69E2E", fontcolor=white]
            cache [label="Redis\nCache", shape=cylinder, fillcolor="#E53E3E", fontcolor=white]
        }

        subgraph cluster_messaging {
            label="Messaging"
            color="#C6F6D5"
            style="rounded,filled"
            fillcolor="#F0FFF4"

            events [label="Event Bus\n(NATS)", shape=parallelogram, fillcolor="#38A169", fontcolor=white]
            dlq [label="Dead Letter\nQueue", shape=parallelogram, fillcolor="#E53E3E", fontcolor=white]
            jobs [label="Job Queue\n(BullMQ)", shape=parallelogram, fillcolor="#38A169", fontcolor=white]
        }

        subgraph cluster_observability {
            label="Observability"
            color="#E9D8FD"
            style="rounded,filled"
            fillcolor="#FAF5FF"

            metrics [label="Prometheus", fillcolor="#805AD5", fontcolor=white]
            logs [label="Loki", fillcolor="#805AD5", fontcolor=white]
            traces [label="Tempo", fillcolor="#805AD5", fontcolor=white]
            grafana [label="Grafana", fillcolor="#ED8936", fontcolor=white, penwidth=2]

            metrics -> grafana
            logs -> grafana
            traces -> grafana
        }
    }

    // --- External ---
    subgraph cluster_external {
        label="External Services"
        style="rounded,filled"
        color="#E2E8F0"
        fillcolor="#F7FAFC"

        stripe [label="Stripe", shape=diamond, fillcolor="#635BFF", fontcolor=white]
        sendgrid [label="SendGrid", shape=diamond, fillcolor="#1A82E2", fontcolor=white]
        twilio [label="Twilio", shape=diamond, fillcolor="#F22F46", fontcolor=white]
        s3 [label="S3", shape=diamond, fillcolor="#569A31", fontcolor=white]
    }

    // === Connections ===

    // Client to edge
    {rank=same; web; mobile; cli}
    web -> cdn [label="HTTPS"]
    mobile -> cdn [label="HTTPS"]
    cli -> lb [label="API key"]

    // Edge to gateway
    lb -> gw:rest
    lb -> gw:ws

    // Gateway to services
    gw:rest -> order_cmd [label="/orders", weight=5]
    gw:rest -> order_query [label="/orders\n(GET)", style=dashed]
    gw:rest -> pay_webhook [label="/webhooks"]
    gw:graphql -> order_query [label="query"]
    gw:ws -> router [label="subscribe", style=dashed]

    // Order flow
    order_cmd -> pricing
    order_cmd -> order_saga
    order_saga -> pay_cmd [label="charge"]
    order_saga -> reservation [label="reserve"]
    order_saga -> router [label="notify", style=dashed]

    // Payment flow
    pay_cmd -> stripe
    pay_webhook -> pay_cmd [label="confirm"]
    refund -> stripe

    // Inventory
    stock -> warehouse [dir=both, label="sync"]
    reservation -> stock

    // Notifications to external
    email_svc -> sendgrid
    sms_svc -> twilio

    // Data store connections
    order_cmd -> orders_db [weight=3]
    order_query -> orders_db [style=dashed]
    order_query -> cache [style=dashed, label="read-through"]
    pay_cmd -> payments_db
    stock -> inventory_db
    reservation -> inventory_db

    // Event bus
    order_cmd -> events [label="OrderPlaced", color="#38A169", fontcolor="#38A169"]
    pay_cmd -> events [label="PaymentProcessed", color="#38A169", fontcolor="#38A169"]
    stock -> events [label="StockReserved", color="#38A169", fontcolor="#38A169"]
    events -> order_saga [label="consume", style=dashed, color="#805AD5"]
    events -> router [label="consume", style=dashed, color="#805AD5"]
    events -> dlq [label="failed", color="#E53E3E"]

    // Jobs
    router -> jobs [label="enqueue"]
    jobs -> email_svc [label="process", style=dashed]
    jobs -> push_svc [label="process", style=dashed]

    // Observability (subtle connections)
    order_cmd -> metrics [style=dotted, color="#805AD5", arrowsize=0.5]
    order_cmd -> traces [style=dotted, color="#805AD5", arrowsize=0.5]
    gw -> logs [style=dotted, color="#805AD5", arrowsize=0.5]
}
```

### S2. Compiler Pipeline — Record Nodes with Ports

Complex record-shape nodes with port connections, rank constraints,
and weighted edges for layout control.

```graphviz
digraph compiler_ir {
    rankdir=TB
    node [shape=record, fontname="Courier", fontsize=9, style=filled, fillcolor="#F7FAFC"]
    edge [fontname="Helvetica", fontsize=8]

    // Source
    source [label="source.go|{package main\\l|func fibonacci(n int) int \{\\l\\ \\ if n \<= 1 \{\\l\\ \\ \\ \\ return n\\l\\ \\ \}\\l\\ \\ return fibonacci(n-1) + fibonacci(n-2)\\l\}\\l}", shape=record, fillcolor="#EBF8FF"]

    // Tokens
    tokens [label="{Token Stream|{PACKAGE|IDENT\\nmain}|{FUNC|IDENT\\nfibonacci}|{LPAREN|IDENT\\nn|INT|RPAREN}|{IF|IDENT\\nn|LEQ|INT_LIT\\n1}|{RETURN|IDENT\\nn}|{RETURN|CALL|ADD|CALL}}", fillcolor="#FFF5F5"]

    // AST
    ast [label="{AST|{FuncDecl|{name: fibonacci|params: [(n, int)]|returns: int}|{Body|{IfStmt|{cond: n \<= 1|then: Return(n)}|{ReturnStmt|{BinaryExpr|{op: +|left: Call(fib, n-1)|right: Call(fib, n-2)}}}}}}}", fillcolor="#F0FFF4"]

    // SSA
    ssa [label="{SSA Form|{entry:|{%0 = param n : int|br %cond}}|{cond:|{%1 = icmp sle %0, 1|br %1, %base, %recurse}}|{base:|{ret %0}}|{recurse:|{%2 = sub %0, 1|%3 = call @fib(%2)|%4 = sub %0, 2|%5 = call @fib(%4)|%6 = add %3, %5|ret %6}}}", fillcolor="#FEFCBF"]

    // Optimized
    opt [label="{Optimized IR|{entry:|%0 = param n}|{check:|br (%0 sle 1), ret_base, compute}|{ret_base:|ret %0}|{compute:|{%1 = call @fib_memo(%0)|ret %1}}|{memo_table: [0: 0, 1: 1, ...]}}", fillcolor="#FAF5FF"]

    // Output
    output [label="{x86-64 Assembly|{fibonacci:|push rbp\\lmov rbp, rsp\\l}|{cmp edi, 1\\ljle .base\\l}|{.recurse:|lea edi, [rdi-1]\\lcall fibonacci\\l...|add eax, ebx\\l}|{.base:|mov eax, edi\\lpop rbp\\lret\\l}}", fillcolor="#FFF5F5"]

    source -> tokens [label="Lexer", weight=5]
    tokens -> ast [label="Parser", weight=5]
    ast -> ssa [label="SSA Builder", weight=5]
    ssa -> opt [label="Optimizer", weight=5]
    opt -> output [label="Code Gen", weight=5]
}
```

### S3. Shapes Gallery — All Graphviz Node Shapes

Every built-in node shape in a grid layout using `rank=same`.

```dot
digraph shapes {
    node [style=filled, fillcolor="#F7FAFC", fontname="Helvetica", fontsize=9, width=1.2, height=0.6]

    {rank=same
        a [label="box", shape=box]
        b [label="ellipse", shape=ellipse]
        c [label="circle", shape=circle]
        d [label="diamond", shape=diamond]
        e [label="polygon\nsides=6", shape=polygon, sides=6]
    }

    {rank=same
        f [label="record", shape=record]
        g [label="plaintext", shape=plaintext]
        h [label="point", shape=point]
        i [label="triangle", shape=triangle]
        j [label="pentagon", shape=pentagon]
    }

    {rank=same
        k [label="hexagon", shape=hexagon]
        l [label="octagon", shape=octagon]
        m [label="doublecircle", shape=doublecircle]
        n [label="doubleoctagon", shape=doubleoctagon]
        o [label="tripleoctagon", shape=tripleoctagon]
    }

    {rank=same
        p [label="house", shape=house]
        q [label="invhouse", shape=invhouse]
        r [label="trapezium", shape=trapezium]
        s [label="invtrapezium", shape=invtrapezium]
        t [label="parallelogram", shape=parallelogram]
    }

    {rank=same
        u [label="cylinder", shape=cylinder, fillcolor="#FEFCBF"]
        v [label="note", shape=note, fillcolor="#EBF8FF"]
        w [label="tab", shape=tab]
        x [label="folder", shape=folder]
        y [label="box3d", shape=box3d]
    }

    {rank=same
        z [label="component", shape=component]
        aa [label="cds", shape=cds]
        bb [label="Mdiamond", shape=Mdiamond]
        cc [label="Msquare", shape=Msquare]
        dd [label="Mcircle", shape=Mcircle]
    }

    {rank=same
        ee [label="star", shape=star, fillcolor="#FED7E2"]
        ff [label="underline", shape=underline]
        gg [label="septagon", shape=septagon]
        hh [label="egg", shape=egg]
        ii [label="assembly", shape=assembly]
    }

    // Invisible edges for vertical spacing
    a -> f -> k -> p -> u -> z -> ee [style=invis]
}
```
