#!/bin/sh
# Copy seed data into the ChromaDB volume on first boot only.
# If chroma.sqlite3 already exists, the volume has been initialized.

DATA_DIR="/data"

if [ ! -f "$DATA_DIR/chroma.sqlite3" ]; then
  echo "ChromaDB: seeding from bundled data..."
  cp -r /chroma-seed/* "$DATA_DIR/"
  echo "ChromaDB: seed complete."
else
  echo "ChromaDB: existing data found, skipping seed."
fi

# Hand off to the original ChromaDB entrypoint
exec chroma run /config.yaml
