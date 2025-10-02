import { z } from "zod";

// Common interfaces used by both price and quote responses
export const zeroXFeesSchema = z.object({
	integratorFee: z.string().nullable(),
	zeroExFee: z.string().nullable(),
	gasFee: z.string().nullable(),
});
export type ZeroXFees = z.infer<typeof zeroXFeesSchema>;

export const zeroXAllowanceIssueSchema = z.object({
	actual: z.string(),
	spender: z.string(),
});
export type ZeroXAllowanceIssue = z.infer<typeof zeroXAllowanceIssueSchema>;

export const zeroXBalanceIssueSchema = z.object({
	token: z.string(),
	actual: z.string(),
	expected: z.string(),
});
export type ZeroXBalanceIssue = z.infer<typeof zeroXBalanceIssueSchema>;

export const zeroXIssuesSchema = z.object({
	allowance: z.union([
		zeroXAllowanceIssueSchema,
		z.object({}).strict(),
		z.null(),
	]),
	balance: z.union([zeroXBalanceIssueSchema, z.object({}).strict(), z.null()]),
	simulationIncomplete: z.boolean(),
	invalidSourcesPassed: z.array(z.string()),
});
export type ZeroXIssues = z.infer<typeof zeroXIssuesSchema>;

export const zeroXRouteFillSchema = z.object({
	from: z.string(),
	to: z.string(),
	source: z.string(),
	proportionBps: z.string(),
});
export type ZeroXRouteFill = z.infer<typeof zeroXRouteFillSchema>;

export const zeroXRouteTokenSchema = z.object({
	address: z.string(),
	symbol: z.string(),
});
export type ZeroXRouteToken = z.infer<typeof zeroXRouteTokenSchema>;

export const zeroXRouteSchema = z.object({
	fills: z.array(zeroXRouteFillSchema),
	tokens: z.array(zeroXRouteTokenSchema),
});
export type ZeroXRoute = z.infer<typeof zeroXRouteSchema>;

export const zeroXTokenTaxSchema = z.object({
	buyTaxBps: z.string(),
	sellTaxBps: z.string(),
});
export type ZeroXTokenTax = z.infer<typeof zeroXTokenTaxSchema>;

export const zeroXTokenMetadataSchema = z.object({
	buyToken: zeroXTokenTaxSchema,
	sellToken: zeroXTokenTaxSchema,
});
export type ZeroXTokenMetadata = z.infer<typeof zeroXTokenMetadataSchema>;

export const zeroXTransactionSchema = z.object({
	to: z.string(),
	data: z.string(),
	gas: z.string(),
	gasPrice: z.string(),
	value: z.string().optional(),
});
export type ZeroXTransaction = z.infer<typeof zeroXTransactionSchema>;

// Base response interface with common fields
export const zeroXBaseResponseSchema = z.object({
	blockNumber: z.string(),
	buyAmount: z.string(),
	buyToken: z.string(),
	fees: zeroXFeesSchema,
	issues: zeroXIssuesSchema,
	liquidityAvailable: z.boolean(),
	minBuyAmount: z.string(),
	route: zeroXRouteSchema,
	sellAmount: z.string(),
	sellToken: z.string(),
	tokenMetadata: zeroXTokenMetadataSchema,
	totalNetworkFee: z.string(),
	zid: z.string(),
});
export type ZeroXBaseResponse = z.infer<typeof zeroXBaseResponseSchema>;

// Price response (no transaction field, has gas and gasPrice at root)
export const zeroXPriceResponseSchema = zeroXBaseResponseSchema.extend({
	gas: z.string(),
	gasPrice: z.string(),
});
export type ZeroXPriceResponse = z.infer<typeof zeroXPriceResponseSchema>;

export const priceSuccessSchema = z.object({
	status: z.literal("ok"),
	data: zeroXPriceResponseSchema,
});

export const priceErrorSchema = z.object({
	status: z.literal("nok"),
	error: z.string(),
});

export const priceResponse = z.union([priceSuccessSchema, priceErrorSchema]);
export type PriceResponse = z.infer<typeof priceResponse>;

// Quote response (has transaction field)
export const zeroXQuoteResponseSchema = zeroXBaseResponseSchema.extend({
	transaction: zeroXTransactionSchema,
	allowanceTarget: z.string().optional(),
});
export type ZeroXQuoteResponse = z.infer<typeof zeroXQuoteResponseSchema>;

// Simplified transaction response for our quote endpoint
export const zeroXQuoteTransactionResponseSchema = z.object({
	to: z.string(),
	data: z.string(),
	value: z.string().optional(),
	gas: z.string(),
	allowanceTarget: z.string().optional(),
	needsApprove: z.boolean(),
});
export type ZeroXQuoteTransactionResponse = z.infer<
	typeof zeroXQuoteTransactionResponseSchema
>;

export const quoteSuccessSchema = z.object({
	status: z.literal("ok"),
	data: zeroXQuoteTransactionResponseSchema,
});

export const quoteErrorSchema = z.object({
	status: z.literal("nok"),
	error: z.string(),
});

export const quoteResponse = z.union([quoteSuccessSchema, quoteErrorSchema]);
export type QuoteResponse = z.infer<typeof quoteResponse>;
