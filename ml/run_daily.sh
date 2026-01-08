#!/bin/bash

while true; do
    echo "⏰ Starting Daily Cycle: $(date)"

    # 1. Run the ML Job (Updates Zones)
    echo "running ML Job..."
    # python3 ml_job.py

    # 2. Run the Automation Agent (Acts on Zones)
    echo "running AI Agent..."
    python3 automation_agent.py

    echo "💤 Cycle finished. Sleeping for 24 hours..."
    sleep 86400
done