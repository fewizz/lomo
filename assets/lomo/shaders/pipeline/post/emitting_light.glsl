vec3 emitting_light(vec3 color, float block_light, float emissive) {
	return color *
		mix(
			0.5 * pow(block_light, 2.0),
			pow(length(color), 1.0) * 2.0,
			clamp(emissive, 0.0, 1.0)
		);
}