float increase_ratio(float ratio, float mx) {
	float ratio_reverted = 1.0 / (1.0 - ratio);
	ratio_reverted += 1.0;
	ratio_reverted = min(ratio_reverted, mx);
	return ratio_reverted / (1.0 + ratio_reverted);
}