// Package main is the entry point for the dirsv server.
package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"

	"github.com/tai/dirsv/internal/server"
)

func main() {
	addr := flag.String("addr", ":8080", "listen address")
	root := flag.String("root", ".", "root directory to serve")
	flag.Parse()

	srv, err := server.New(*root)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("serving %s on %s\n", *root, *addr)
	if err := http.ListenAndServe(*addr, srv); err != nil {
		log.Fatal(err)
	}
}
