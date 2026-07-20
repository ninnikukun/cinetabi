// 無料の共有インフラ（Nominatim/Overpass/wiki）へのリクエスト間隔を空けるための共通sleep。
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
