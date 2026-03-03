# Typst Diagrams

## Hello World

```typst
#set page(width: auto, height: auto, margin: 1em)
#set text(size: 24pt)

*Hello* from _Typst_!
```

## Table

```typst
#set page(width: auto, height: auto, margin: 1em)

#table(
  columns: (auto, auto, auto),
  [*Name*], [*Age*], [*City*],
  [Alice], [30], [New York],
  [Bob], [25], [London],
  [Carol], [35], [Tokyo],
)
```

## Math

```typst
#set page(width: auto, height: auto, margin: 1em)

The quadratic formula:

$ x = (-b plus.minus sqrt(b^2 - 4 a c)) / (2a) $

Euler's identity:

$ e^(i pi) + 1 = 0 $
```
