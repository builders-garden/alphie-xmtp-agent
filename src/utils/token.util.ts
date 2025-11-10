import { formatUnits } from "viem";

export const getTokenPriceAndFdv = ({
	amount,
	amountInUsd,
	totalSupply,
	digits,
}: {
	amount: string;
	amountInUsd: string;
	totalSupply: string;
	digits: number;
}): { price: number; fdv: number } => {
	const price = Number.parseFloat(amountInUsd) / Number.parseFloat(amount);
	const fdv =
		price * Number.parseFloat(formatUnits(BigInt(totalSupply), digits));
	return { price, fdv };
};
