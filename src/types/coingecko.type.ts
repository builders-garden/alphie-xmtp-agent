export type StringMap = Record<string, string>;
export type NumberMap = Record<string, number>;

export interface CoingeckoDetailPlatformInfo {
	decimal_place: number | null;
	contract_address: string;
}

export interface CoingeckoLinks {
	homepage: string[];
	whitepaper: string;
	blockchain_site: string[];
	official_forum_url: string[];
	chat_url: string[];
	announcement_url: string[];
	snapshot_url: string | null;
	twitter_screen_name: string;
	facebook_username: string;
	bitcointalk_thread_identifier: number | null;
	telegram_channel_identifier: string;
	subreddit_url: string;
	repos_url: {
		github: string[];
		bitbucket: string[];
	};
}

export interface CoingeckoImage {
	thumb: string;
	small: string;
	large: string;
}

export interface CoingeckoMarketData {
	current_price: NumberMap;
	total_value_locked: number | null;
	mcap_to_tvl_ratio: number | null;
	fdv_to_tvl_ratio: number | null;
	roi: unknown | null;
	ath: NumberMap;
	ath_change_percentage: NumberMap;
	ath_date: StringMap;
	atl: NumberMap;
	atl_change_percentage: NumberMap;
	atl_date: StringMap;
	market_cap: NumberMap;
	market_cap_rank: number;
	fully_diluted_valuation: NumberMap;
	market_cap_fdv_ratio: number;
	total_volume: NumberMap;
	high_24h: NumberMap;
	low_24h: NumberMap;
	price_change_24h: number;
	price_change_percentage_24h: number;
	price_change_percentage_7d: number;
	price_change_percentage_14d: number;
	price_change_percentage_30d: number;
	price_change_percentage_60d: number;
	price_change_percentage_200d: number;
	price_change_percentage_1y: number;
	market_cap_change_24h: number;
	market_cap_change_percentage_24h: number;
	price_change_24h_in_currency: NumberMap;
	price_change_percentage_1h_in_currency: NumberMap;
	price_change_percentage_24h_in_currency: NumberMap;
	price_change_percentage_7d_in_currency: NumberMap;
	price_change_percentage_14d_in_currency: NumberMap;
	price_change_percentage_30d_in_currency: NumberMap;
	price_change_percentage_60d_in_currency: NumberMap;
	price_change_percentage_200d_in_currency: NumberMap;
	price_change_percentage_1y_in_currency: NumberMap;
	market_cap_change_24h_in_currency: NumberMap;
	market_cap_change_percentage_24h_in_currency: NumberMap;
	total_supply: number;
	max_supply: number | null;
	circulating_supply: number;
	last_updated: string;
}

export interface CoingeckoCommunityData {
	facebook_likes: number | null;
	reddit_average_posts_48h: number;
	reddit_average_comments_48h: number;
	reddit_subscribers: number;
	reddit_accounts_active_48h: number;
	telegram_channel_user_count: number | null;
}

export interface CoingeckoDeveloperData {
	forks: number;
	stars: number;
	subscribers: number;
	total_issues: number;
	closed_issues: number;
	pull_requests_merged: number;
	pull_request_contributors: number;
	code_additions_deletions_4_weeks: {
		additions: number;
		deletions: number;
	};
	commit_count_4_weeks: number;
	last_4_weeks_commit_activity_series: number[];
}

export interface CoingeckoTickerMarket {
	name: string;
	identifier: string;
	has_trading_incentive: boolean;
}

export interface CoingeckoTicker {
	base: string;
	target: string;
	market: CoingeckoTickerMarket;
	last: number;
	volume: number;
	converted_last: NumberMap;
	converted_volume: NumberMap;
	trust_score: string;
	bid_ask_spread_percentage: number;
	timestamp: string;
	last_traded_at: string;
	last_fetch_at: string;
	is_anomaly: boolean;
	is_stale: boolean;
	trade_url: string | null;
	token_info_url: string | null;
	coin_id: string;
	target_coin_id: string;
}

export interface CoingeckoCoinResponse {
	id: string;
	symbol: string;
	name: string;
	web_slug: string;
	asset_platform_id: string;
	platforms: Record<string, string>;
	detail_platforms: Record<string, CoingeckoDetailPlatformInfo>;
	block_time_in_minutes: number;
	hashing_algorithm: string | null;
	categories: string[];
	preview_listing: boolean;
	public_notice: string;
	additional_notices: unknown[];
	localization: StringMap;
	description: StringMap;
	links: CoingeckoLinks;
	image: CoingeckoImage;
	country_origin: string;
	genesis_date: string | null;
	contract_address: string;
	sentiment_votes_up_percentage: number;
	sentiment_votes_down_percentage: number;
	watchlist_portfolio_users: number;
	market_cap_rank: number;
	market_data: CoingeckoMarketData;
	community_data: CoingeckoCommunityData;
	developer_data: CoingeckoDeveloperData;
	status_updates: unknown[];
	last_updated: string;
	tickers: CoingeckoTicker[];
}
