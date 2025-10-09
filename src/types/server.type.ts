import type { Address, Hex } from "viem";
import { z } from "zod";

export const handleCopyTradeSchema = z.object({
	user: z.object({
		fid: z.number(),
	}),
	transaction: z.object({
		chainId: z.number(),
		transactionHash: z.custom<Hex>(),
		buyToken: z.custom<Address>(),
		sellToken: z.custom<Address>(),
		sellAmount: z.string(),
	}),
});

export type HandleCopyTradeSchema = z.infer<typeof handleCopyTradeSchema>;
