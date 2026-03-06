#!/usr/bin/env bash
cd "$(dirname "$0")"
JWT=$(cat .nuclei-jwt.txt 2>/dev/null)
if [ -z "$JWT" ]; then echo "No JWT in .nuclei-jwt.txt"; exit 1; fi
nuclei -l urls.txt -H "Authorization: Bearer $JWT" -severity critical,high,medium
