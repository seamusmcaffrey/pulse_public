#!/bin/bash

# Array of migration versions to repair
migrations=(
  "20240320000000"
  "20240320000000"
  "20240320000001"
  "20240328000000"
  "20240328000001"
  "20240328010000"
  "20240328020000"
  "20240328030000"
  "20240330000000"
  "20240331000000"
  "20240331000001"
  "20240331000002"
)

# Repair each migration
for migration in "${migrations[@]}"
do
  echo "Repairing migration: $migration"
  npx supabase migration repair --status applied "$migration"
done

# Pull the latest schema
npx supabase db pull

# Push our changes
npx supabase db push 