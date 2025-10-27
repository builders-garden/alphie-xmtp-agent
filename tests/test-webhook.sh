#! /bin/bash

source .env

# Simulate Neynar trade.created webhook (sell 1 USDC on Base)
curl -X POST $BACKEND_URL/api/v1/neynar/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "type": "trade.created",
    "data": {
      "object": "trade",
      "trader": { "object": "user_dehydrated", "fid": 4461, "score": 0.9 },
      "pool": { "object": "pool", "address": "0x0000000000000000000000000000000000000000" },
      "transaction": {
        "hash": "0x3d4d44b40b5bbbd659c64ce16277f5a0ef2390afc9126b4932de7bb320769649",
        "network": { "object": "network", "name": "base" },
        "net_transfer": {
          "object": "net_transfer",
          "receiving_token": {
            "object": "token_balance",
            "token": {
              "object": "token",
              "address": "0x1111111111166b7FE7bd91427724B487980aFc69",
              "decimals": 18,
              "symbol": "ZORA",
              "name": "Zora"
            },
            "balance": { "in_usdc": 1, "in_token": "1" }
          },
          "sending_token": {
            "object": "token_balance",
            "token": {
              "object": "token",
              "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              "decimals": 6,
              "symbol": "USDC",
              "name": "USD Coin"
            },
            "balance": { "in_usdc": 1, "in_token": "1" }
          }
        }
      }
    }
  }'