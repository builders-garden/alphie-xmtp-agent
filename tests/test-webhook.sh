#! /bin/bash

source .env

# sell 1 $USDC for $ZORA on Base Mainnet
curl -X POST $ALPHIE_URL/api/v1/copy-trade \
  -H "x-api-secret: $API_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user": {"fid": 189636, "username": "bianc8.eth"}, "transaction": {"chainId": 8453, "transactionHash": "0x3d4d44b40b5bbbd659c64ce16277f5a0ef2390afc9126b4932de7bb320769649", "buyToken": "0x1111111111166b7FE7bd91427724B487980aFc69", "sellToken": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "sellAmount": "1"}}'