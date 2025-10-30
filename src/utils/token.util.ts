export const getTokenPriceAndFdv = ({
	amount,
	amountInUsd,
	totalSupply,
}: {
	amount: string;
	amountInUsd: string;
	totalSupply: string;
}): { price: number; fdv: number } => {
	const price = Number.parseFloat(amountInUsd) / Number.parseFloat(amount);
	const fdv = Number.parseFloat(amountInUsd) * Number.parseFloat(totalSupply);
	return { price, fdv };
};
