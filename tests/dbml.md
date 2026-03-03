# DBML Diagrams

## Basic tables

```dbml
Table users {
  id integer [primary key]
  username varchar
  email varchar
  created_at timestamp
}

Table posts {
  id integer [primary key]
  title varchar
  body text
  user_id integer
  created_at timestamp
}

Ref: posts.user_id > users.id
```

## E-commerce schema

```dbml
Table products {
  id integer [primary key]
  name varchar
  price decimal
  category_id integer
}

Table categories {
  id integer [primary key]
  name varchar
  parent_id integer
}

Table orders {
  id integer [primary key]
  user_id integer
  status varchar
  total decimal
  created_at timestamp
}

Table order_items {
  id integer [primary key]
  order_id integer
  product_id integer
  quantity integer
  price decimal
}

Ref: products.category_id > categories.id
Ref: categories.parent_id > categories.id
Ref: order_items.order_id > orders.id
Ref: order_items.product_id > products.id
```
