# Graphviz Diagram Gallery

A comprehensive test of Graphviz diagrams rendered via `@hpcc-js/wasm-graphviz`.
Both `graphviz` and `dot` language tags are supported.

---

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
