#!/bin/bash

echo "Starting Cloudflare Tunnel for Backend..."
cloudflared tunnel run --url http://localhost:8000 vivi-backend
