-module(hello).
-export([greet/0]).
greet() -> io:format("hello~n").
