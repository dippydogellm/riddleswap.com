#!/bin/bash
# Deployment script for production
export NODE_ENV=production
export PORT=5000
node dist/index.js
