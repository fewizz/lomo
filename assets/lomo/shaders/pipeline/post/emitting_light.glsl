vec3 emitting_light(vec3 color, float block_light, float emissive) {
	return color * mix(pow(block_light, 8.0), pow(length(color), 2.0) * 12.0, emissive);
}