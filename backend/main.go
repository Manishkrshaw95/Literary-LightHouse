package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	_ "github.com/mattn/go-sqlite3"
)

func main() {
	db, err := sql.Open("sqlite3", "./library.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// Create categories table if not exists
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS categories (
	   id INTEGER PRIMARY KEY AUTOINCREMENT,
	   name TEXT NOT NULL UNIQUE
   )`)
	if err != nil {
		log.Fatal(err)
	}

	// Insert default categories if not present
	categories := []string{
		"Fiction",
		"Non-Fiction",
		"Academic/Professional",
		"Age-Based",
		"Subject-Specific",
		"Religious/Spiritual",
		"Culinary",
		"Arts & Photography",
		"Health/Medical",
		"Business/Economics",
		"International & Cultural",
		"Format-Based",
		"Special Collections",
		"General",
	}
	for _, cat := range categories {
		_, err := db.Exec("INSERT OR IGNORE INTO categories (name) VALUES (?)", cat)
		if err != nil {
			log.Fatal(err)
		}
	}

	// API endpoint to get all categories
	http.HandleFunc("/api/categories", func(w http.ResponseWriter, r *http.Request) {
		// --- CORS HEADERS (Point 1) ---
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		// --- Handle preflight OPTIONS request (Point 2) ---
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		rows, err := db.Query("SELECT id, name FROM categories ORDER BY id")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Category struct {
			ID   int    `json:"id"`
			Name string `json:"name"`
		}
		var result []Category
		for rows.Next() {
			var c Category
			if err := rows.Scan(&c.ID, &c.Name); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			result = append(result, c)
		}

		w.Header().Set("Content-Type", "application/json")
		if len(result) == 0 {
			w.Write([]byte("[]"))
			return
		}
		// Use encoding/json to marshal
		writeJson(w, result)
	})

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Library Management System Backend (Go + SQLite) updated."))
	})

	log.Println("Server started at :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

// Helper to marshal JSON with error handling
func writeJson(w http.ResponseWriter, v interface{}) {

	enc := json.NewEncoder(w)
	if err := enc.Encode(v); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
