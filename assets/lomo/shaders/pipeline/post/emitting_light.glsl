vec3 emitting_light(vec3 color, float block_light, float emissive) {
	return color * mix(pow(block_light, 6.0), pow(length(color), 2.0) * 4.0, clamp(emissive, 0.0, 1.0));
}